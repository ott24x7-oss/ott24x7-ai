import { Brain, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, ConfirmDialog, Input, Switch } from '@cherrystudio/ui'
import { useMutation, useQuery } from '@data/hooks/useDataApi'
import { usePreference } from '@data/hooks/usePreference'
import {
  SettingDescription,
  SettingDivider,
  SettingGroup,
  SettingRow,
  SettingRowTitle,
  SettingsContentBody,
  SettingTitle
} from '@renderer/components/SettingsPrimitives'
import { useTabs } from '@renderer/hooks/tab'
import { useTheme } from '@renderer/hooks/useTheme'
import type { Memory } from '@shared/data/types/memory'

export function MemorySettings() {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { openTab } = useTabs()
  const [enabled, setEnabled] = usePreference('feature.memory.enabled')
  const [learn, setLearn] = usePreference('feature.memory.learn_from_messages')
  const { data: memories = [], isLoading } = useQuery('/memories', {})
  const { trigger: updateMemory } = useMutation('PATCH', '/memories/:id', { refresh: ['/memories'] })
  const { trigger: deleteMemory } = useMutation('DELETE', '/memories/:id', { refresh: ['/memories'] })
  const { trigger: forgetAll } = useMutation('DELETE', '/memories', { refresh: ['/memories'] })
  const [editing, setEditing] = useState<{ id: string; content: string } | null>(null)
  const [forgetting, setForgetting] = useState(false)

  return (
    <SettingsContentBody>
      <SettingTitle>{t('settings.memory.title')}</SettingTitle>
      <SettingDescription>{t('settings.memory.description')}</SettingDescription>
      <SettingGroup theme={theme}>
        <SettingRow>
          <div>
            <SettingRowTitle>{t('settings.memory.use.label')}</SettingRowTitle>
            <SettingDescription>{t('settings.memory.use.description')}</SettingDescription>
          </div>
          <Switch checked={enabled} onCheckedChange={(value) => void setEnabled(value)} />
        </SettingRow>
        <SettingDivider />
        <SettingRow>
          <div>
            <SettingRowTitle>{t('settings.memory.learn.label')}</SettingRowTitle>
            <SettingDescription>{t('settings.memory.learn.description')}</SettingDescription>
          </div>
          <Switch checked={learn} disabled={!enabled} onCheckedChange={(value) => void setLearn(value)} />
        </SettingRow>
      </SettingGroup>
      <SettingGroup theme={theme}>
        <div className="flex items-center justify-between gap-4">
          <SettingRowTitle>{t('settings.memory.notes')}</SettingRowTitle>
          <Button variant="outline" size="sm" disabled={memories.length === 0} onClick={() => setForgetting(true)}>
            {t('settings.memory.forget_all')}
          </Button>
        </div>
        <SettingDescription>
          {isLoading ? t('common.loading') : t('settings.memory.notes_description')}
        </SettingDescription>
        <div className="mt-4 space-y-2">
          {memories.map((memory) => (
            <MemoryRow
              key={memory.id}
              memory={memory}
              editing={editing?.id === memory.id ? editing.content : undefined}
              onEdit={(content) => setEditing({ id: memory.id, content })}
              onCancel={() => setEditing(null)}
              onSave={async () => {
                if (!editing?.content.trim()) return
                await updateMemory({ params: { id: memory.id }, body: { content: editing.content.trim() } })
                setEditing(null)
              }}
              onDelete={() => void deleteMemory({ params: { id: memory.id } })}
              onOpenTopic={memory.sourceTopicId ? () => openTab(`/app?topicId=${memory.sourceTopicId}`) : undefined}
              t={t}
            />
          ))}
          {!isLoading && memories.length === 0 && (
            <div className="text-sm text-muted-foreground">{t('settings.memory.empty')}</div>
          )}
        </div>
      </SettingGroup>
      <ConfirmDialog
        open={forgetting}
        onOpenChange={setForgetting}
        title={t('settings.memory.forget_all')}
        description={t('settings.memory.forget_all_confirm')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        destructive
        onConfirm={async () => {
          await forgetAll({})
          setForgetting(false)
        }}
      />
    </SettingsContentBody>
  )
}

function MemoryRow({
  memory,
  editing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  onOpenTopic,
  t
}: {
  memory: Memory
  editing?: string
  onEdit: (content: string) => void
  onCancel: () => void
  onSave: () => void
  onDelete: () => void
  onOpenTopic?: () => void
  t: (key: string) => string
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      {editing !== undefined ? (
        <div className="flex gap-2">
          <Input value={editing} onChange={(event) => onEdit(event.target.value)} autoFocus />
          <Button size="sm" onClick={onSave}>
            {t('common.save')}
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <Brain className="mt-0.5 size-4 shrink-0 text-(--cs-theme-primary)" />
          <div className="min-w-0 flex-1 text-sm">{memory.content}</div>
          {onOpenTopic && (
            <Button size="sm" variant="ghost" onClick={onOpenTopic}>
              {t('settings.memory.source')}
            </Button>
          )}
          <Button size="icon-sm" variant="ghost" aria-label={t('common.edit')} onClick={() => onEdit(memory.content)}>
            <Pencil className="size-4" />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label={t('common.delete')} onClick={onDelete}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

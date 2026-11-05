import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Avatar, AvatarImage, Button, ColFlex, EmojiAvatar } from '@cherrystudio/ui'
import { usePreference } from '@data/hooks/usePreference'
import { CommandShortcut } from '@renderer/components/command'
import useAvatar from '@renderer/hooks/useAvatar'
import { openSettingsTab } from '@renderer/services/mainWindowNavigation'
import { isEmoji } from '@renderer/utils/naming'

import { AppearanceMenu } from './layout/AppearanceMenu'

export function UserAccountPanel({ onRequestClose, children }: { onRequestClose?: () => void; children?: ReactNode }) {
  const [userName] = usePreference('app.user.name')
  const { t } = useTranslation()
  const avatar = useAvatar()

  return (
    <ColFlex className="w-56 p-1.5">
      <ColFlex className="flex-row items-center gap-2 px-2 py-2">
        {isEmoji(avatar) ? (
          <EmojiAvatar size={20} fontSize={12} className="shrink-0">
            {avatar}
          </EmojiAvatar>
        ) : (
          <Avatar className="size-5 shrink-0 rounded-full">
            <AvatarImage src={avatar} className="object-cover" />
          </Avatar>
        )}
        <span className="truncate font-medium text-[13px] text-foreground leading-[18px]">
          {userName || t('chat.user', { defaultValue: t('export.user', { defaultValue: 'User' }) })}
        </span>
      </ColFlex>
      <ColFlex className="border-border-subtle gap-0.5 border-t py-1">
        <AppearanceMenu onRequestClose={onRequestClose} />
        {children}
      </ColFlex>
      <ColFlex className="border-border-subtle border-t pt-1">
        <Button
          className="h-8 min-h-8 w-full justify-start gap-2 rounded-md bg-transparent px-2 py-0 text-[13px] text-foreground leading-5"
          onClick={() => {
            onRequestClose?.()
            openSettingsTab()
          }}
          size="sm"
          variant="ghost">
          <span className="min-w-0 flex-1 text-left">{t('common.settings')}</span>
          <CommandShortcut
            command="app.settings.open"
            className="ml-auto h-auto min-w-0 rounded-none bg-transparent p-0 text-[13px] shadow-none"
          />
        </Button>
      </ColFlex>
    </ColFlex>
  )
}

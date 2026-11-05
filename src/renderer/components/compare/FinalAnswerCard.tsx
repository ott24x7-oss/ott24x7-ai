import { ChevronDown, ChevronUp, Copy, RefreshCw, Send, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Tooltip } from '@cherrystudio/ui'
import ChatMarkdown from '@renderer/components/chat/messages/markdown/ChatMarkdown'

export interface FinalAnswerCardState {
  content: string
  status: 'streaming' | 'done' | 'error'
  judgeName: string
  error?: string
}

interface FinalAnswerCardProps {
  answer?: FinalAnswerCardState
  canCombine: boolean
  onCombine: () => void
  onCopy: () => void
  onContinue: () => void
}

export function FinalAnswerCard({ answer, canCombine, onCombine, onCopy, onContinue }: FinalAnswerCardProps) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(false)
  const isStreaming = answer?.status === 'streaming'
  const hasAnswer = Boolean(answer?.content)

  return (
    <section className="shrink-0 overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex min-h-11 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-primary" />
          <h2 className="text-sm font-semibold">{t('compare.final_answer.title')}</h2>
          {answer?.judgeName && <span className="truncate text-xs text-muted-foreground">{answer.judgeName}</span>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canCombine && (
            <Button type="button" size="sm" variant="outline" disabled={isStreaming} onClick={onCombine}>
              {hasAnswer ? <RefreshCw className="size-3.5" /> : <Sparkles className="size-3.5" />}
              {hasAnswer ? t('compare.final_answer.rerun') : t('compare.combine')}
            </Button>
          )}
          {hasAnswer && (
            <>
              <Tooltip content={t('compare.final_answer.copy')}>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t('compare.final_answer.copy')}
                  onClick={onCopy}>
                  <Copy className="size-3.5" />
                </Button>
              </Tooltip>
              {answer?.status === 'done' && (
                <Tooltip content={t('compare.final_answer.continue')}>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t('compare.final_answer.continue')}
                    onClick={onContinue}>
                    <Send className="size-3.5" />
                  </Button>
                </Tooltip>
              )}
            </>
          )}
          {hasAnswer && (
            <Tooltip content={collapsed ? t('compare.final_answer.expand') : t('compare.final_answer.collapse')}>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={collapsed ? t('compare.final_answer.expand') : t('compare.final_answer.collapse')}
                aria-expanded={!collapsed}
                onClick={() => setCollapsed((value) => !value)}>
                {collapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
              </Button>
            </Tooltip>
          )}
        </div>
      </header>
      {!collapsed && (
        <div className="min-h-20 p-4">
          {answer?.error && (
            <p role="alert" className="mb-2 text-sm text-error">
              {answer.error}
            </p>
          )}
          {hasAnswer ? (
            <ChatMarkdown
              block={{
                id: 'compare-final-answer',
                content: answer?.content ?? '',
                status: answer?.status === 'streaming' ? 'streaming' : answer?.status === 'error' ? 'error' : 'success'
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t('compare.final_answer.empty')}</p>
          )}
        </div>
      )}
    </section>
  )
}

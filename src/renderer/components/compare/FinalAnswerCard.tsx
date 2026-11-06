import { Copy, RefreshCw, Send, Sparkles, X } from 'lucide-react'
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
  onClose: () => void
}

export function FinalAnswerCard({ answer, canCombine, onCombine, onCopy, onContinue, onClose }: FinalAnswerCardProps) {
  const { t } = useTranslation()
  const isStreaming = answer?.status === 'streaming' || (!answer && canCombine)
  const hasAnswer = Boolean(answer?.content)
  const title = answer?.judgeName
    ? `${t('compare.final_answer.title')} · ${answer.judgeName}`
    : t('compare.final_answer.title')

  return (
    <section
      aria-label={title}
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden border-l border-border bg-background">
      <header className="flex min-h-11 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <h2 className="truncate text-sm font-semibold">
            {t('compare.final_answer.title')}
            {answer?.judgeName && <span className="font-normal text-muted-foreground"> · {answer.judgeName}</span>}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {(canCombine || hasAnswer) && (
            <Tooltip content={hasAnswer ? t('compare.final_answer.rerun') : t('compare.combine')}>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={hasAnswer ? t('compare.final_answer.rerun') : t('compare.combine')}
                disabled={!canCombine || isStreaming}
                onClick={onCombine}>
                {hasAnswer ? <RefreshCw className="size-3.5" /> : <Sparkles className="size-3.5" />}
              </Button>
            </Tooltip>
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
                    size="sm"
                    variant="ghost"
                    aria-label={t('compare.final_answer.continue')}
                    className="h-8 gap-1 px-2 text-xs text-muted-foreground"
                    onClick={onContinue}>
                    <Send className="size-3.5" />
                    {t('compare.final_answer.continue')}
                  </Button>
                </Tooltip>
              )}
            </>
          )}
          <Tooltip content={t('common.close')}>
            <Button type="button" size="icon-sm" variant="ghost" aria-label={t('common.close')} onClick={onClose}>
              <X className="size-3.5" />
            </Button>
          </Tooltip>
        </div>
      </header>
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-3">
        {answer?.error && (
          <p role="alert" className="mb-2 text-sm text-error">
            {answer.error}
          </p>
        )}
        {isStreaming && (
          <div role="status" className="mb-4 space-y-3" aria-label={t('compare.status.streaming')}>
            <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        )}
        {hasAnswer ? (
          <div className="min-w-0 max-w-full overflow-x-auto">
            <ChatMarkdown
              block={{
                id: 'compare-final-answer',
                content: answer?.content ?? '',
                status: answer?.status === 'streaming' ? 'streaming' : answer?.status === 'error' ? 'error' : 'success'
              }}
            />
          </div>
        ) : !isStreaming ? (
          <p className="text-sm text-muted-foreground">{t('compare.final_answer.empty')}</p>
        ) : null}
      </div>
    </section>
  )
}

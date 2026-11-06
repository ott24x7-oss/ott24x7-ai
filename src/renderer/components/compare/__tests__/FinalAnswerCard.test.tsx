import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { FinalAnswerCard } from '../FinalAnswerCard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@renderer/components/chat/messages/markdown/ChatMarkdown', () => ({
  default: ({ block }: { block: { content: string } }) => <div>{block.content}</div>
}))

describe('FinalAnswerCard', () => {
  it('shows the judge, rerun action, and close action beside the answer', () => {
    const onCombine = vi.fn()
    const onClose = vi.fn()
    render(
      <FinalAnswerCard
        answer={{ content: 'Merged answer', status: 'done', judgeName: 'Claude' }}
        canCombine
        onCombine={onCombine}
        onCopy={vi.fn()}
        onContinue={vi.fn()}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'compare.final_answer.rerun' }))
    expect(onCombine).toHaveBeenCalledOnce()
    expect(screen.getByText('Merged answer')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'compare.final_answer.title · Claude' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'common.close' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('keeps answer actions tied to the displayed answer', () => {
    const onCopy = vi.fn()
    const onContinue = vi.fn()
    render(
      <FinalAnswerCard
        answer={{ content: 'Ready answer', status: 'done', judgeName: 'ChatGPT' }}
        canCombine={false}
        onCombine={vi.fn()}
        onCopy={onCopy}
        onContinue={onContinue}
        onClose={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'compare.final_answer.copy' }))
    fireEvent.click(screen.getByRole('button', { name: 'compare.final_answer.continue' }))
    expect(onCopy).toHaveBeenCalledOnce()
    expect(onContinue).toHaveBeenCalledOnce()
  })

  it('shows progress instead of the empty-state copy while combining', () => {
    render(<FinalAnswerCard canCombine onCombine={vi.fn()} onCopy={vi.fn()} onContinue={vi.fn()} onClose={vi.fn()} />)

    expect(screen.getByRole('status', { name: 'compare.status.streaming' })).toBeInTheDocument()
    expect(screen.queryByText('compare.final_answer.empty')).not.toBeInTheDocument()
  })
})

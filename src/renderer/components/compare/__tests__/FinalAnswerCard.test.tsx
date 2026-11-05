import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { FinalAnswerCard } from '../FinalAnswerCard'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@renderer/components/chat/messages/markdown/ChatMarkdown', () => ({
  default: ({ block }: { block: { content: string } }) => <div>{block.content}</div>
}))

describe('FinalAnswerCard', () => {
  it('offers rerun when an answer exists and collapses a completed answer', () => {
    const onCombine = vi.fn()
    render(
      <FinalAnswerCard
        answer={{ content: 'Merged answer', status: 'done', judgeName: 'Claude' }}
        canCombine
        onCombine={onCombine}
        onCopy={vi.fn()}
        onContinue={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'compare.final_answer.rerun' }))
    expect(onCombine).toHaveBeenCalledOnce()
    expect(screen.getByText('Merged answer')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'compare.final_answer.collapse' }))
    expect(screen.queryByText('Merged answer')).not.toBeInTheDocument()
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
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'compare.final_answer.copy' }))
    fireEvent.click(screen.getByRole('button', { name: 'compare.final_answer.continue' }))
    expect(onCopy).toHaveBeenCalledOnce()
    expect(onContinue).toHaveBeenCalledOnce()
  })
})

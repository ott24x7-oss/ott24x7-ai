import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { getStudioTemplatePrompt } from '../studioGeneration'
import StudioPromptShelf from '../StudioPromptShelf'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

describe('Studio inspiration templates', () => {
  it('fills the prompt from a template chip without starting generation', async () => {
    const user = userEvent.setup()
    const onSelectPrompt = vi.fn()
    render(<StudioPromptShelf onSelectPrompt={onSelectPrompt} />)

    await user.click(screen.getByRole('button', { name: 'studio.templates.poster' }))

    expect(onSelectPrompt).toHaveBeenCalledWith(getStudioTemplatePrompt('poster', (key) => key))
  })
})

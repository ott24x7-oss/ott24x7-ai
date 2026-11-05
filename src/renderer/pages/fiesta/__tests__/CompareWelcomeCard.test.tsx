import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CompareWelcomeCard } from '../CompareWelcomeCard'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'compare.welcome.title': 'Welcome to Compare',
        'compare.welcome.dismiss': 'Dismiss welcome guide',
        'compare.welcome.step1': 'Sign in once in each panel (Claude, ChatGPT, Gemini, DeepSeek).',
        'compare.welcome.step2':
          'Optional: Sign in with ChatGPT in Settings → Providers for a native chat and a faster final answer.',
        'compare.welcome.step3': 'Ask anything — then press ✦ Combine for one final answer.',
        'compare.welcome.panels_link': 'Go to panels',
        'compare.welcome.providers_link': 'Open Providers',
        'compare.welcome.prompt_link': 'Focus prompt bar'
      })[key] ?? key
  })
}))

describe('CompareWelcomeCard', () => {
  it('shows the three login-first steps and routes each link to its destination', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    const onGoToPanels = vi.fn()
    const onOpenProviders = vi.fn()
    const onFocusPrompt = vi.fn()

    render(
      <CompareWelcomeCard
        onDismiss={onDismiss}
        onGoToPanels={onGoToPanels}
        onOpenProviders={onOpenProviders}
        onFocusPrompt={onFocusPrompt}
      />
    )

    expect(screen.getByRole('heading', { name: 'Welcome to Compare' })).toBeInTheDocument()
    expect(screen.getByText('Sign in once in each panel (Claude, ChatGPT, Gemini, DeepSeek).')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Optional: Sign in with ChatGPT in Settings → Providers for a native chat and a faster final answer.'
      )
    ).toBeInTheDocument()
    expect(screen.getByText('Ask anything — then press ✦ Combine for one final answer.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Go to panels' }))
    await user.click(screen.getByRole('button', { name: 'Open Providers' }))
    await user.click(screen.getByRole('button', { name: 'Focus prompt bar' }))
    await user.click(screen.getByRole('button', { name: 'Dismiss welcome guide' }))

    expect(onGoToPanels).toHaveBeenCalledOnce()
    expect(onOpenProviders).toHaveBeenCalledOnce()
    expect(onFocusPrompt).toHaveBeenCalledOnce()
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})

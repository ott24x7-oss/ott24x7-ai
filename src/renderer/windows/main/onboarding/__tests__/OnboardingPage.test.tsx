import '@testing-library/jest-dom/vitest'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import OnboardingPage from '../OnboardingPage'

describe('disabled onboarding compatibility route', () => {
  it('renders no gate or onboarding content', () => {
    const { container } = render(<OnboardingPage />)
    expect(container).toBeEmptyDOMElement()
  })
})

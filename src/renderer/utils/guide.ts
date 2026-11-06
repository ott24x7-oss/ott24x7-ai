export const GUIDE_STEPS = [
  {
    title: 'guide.steps.1.title',
    description: 'guide.steps.1.description',
    tip: 'guide.steps.1.tip',
    image: '05-home-empty.webp',
    caption: 'guide.steps.1.caption',
    action: 'compare'
  },
  {
    title: 'guide.steps.2.title',
    description: 'guide.steps.2.description',
    tip: 'guide.steps.2.tip',
    image: '11-web-panels-replies-dark.webp',
    caption: 'guide.steps.2.caption'
  },
  {
    title: 'guide.steps.3.title',
    description: 'guide.steps.3.description',
    tip: 'guide.steps.3.tip',
    image: '01-compare-4-ai-answers.webp',
    caption: 'guide.steps.3.caption'
  },
  {
    title: 'guide.steps.4.title',
    description: 'guide.steps.4.description',
    tip: 'guide.steps.4.tip',
    image: '12-compare-dark.webp',
    caption: 'guide.steps.4.caption'
  },
  {
    title: 'guide.steps.5.title',
    description: 'guide.steps.5.description',
    tip: 'guide.steps.5.tip',
    image: '02-final-answer-panel.webp',
    caption: 'guide.steps.5.caption'
  },
  {
    title: 'guide.steps.6.title',
    description: 'guide.steps.6.description',
    tip: 'guide.steps.6.tip',
    image: '03-web-search-with-citations.webp',
    caption: 'guide.steps.6.caption'
  },
  {
    title: 'guide.steps.7.title',
    description: 'guide.steps.7.description',
    tip: 'guide.steps.7.tip',
    image: '10-settings-custom-api.webp',
    caption: 'guide.steps.7.caption',
    action: 'provider'
  },
  {
    title: 'guide.steps.8.title',
    description: 'guide.steps.8.description',
    tip: 'guide.steps.8.tip',
    image: '09-studio-image-generation.webp',
    caption: 'guide.steps.8.caption',
    action: 'studio'
  },
  {
    title: 'guide.steps.9.title',
    description: 'guide.steps.9.description',
    tip: 'guide.steps.9.tip',
    image: '07-final-answer-dark.webp',
    caption: 'guide.steps.9.caption'
  }
] as const

export const GUIDE_CHECKLIST = [
  { label: 'guide.checklist.sign_in', step: 2 },
  { label: 'guide.checklist.first_prompt', step: 3 },
  { label: 'guide.checklist.columns', step: 4 },
  { label: 'guide.checklist.combine', step: 5 },
  { label: 'guide.checklist.judge', step: 5 },
  { label: 'guide.checklist.web_search', step: 6 },
  { label: 'guide.checklist.provider', step: 7 },
  { label: 'guide.checklist.studio', step: 8 }
] as const

export const GUIDE_AUTO_CHECKLIST_ITEMS = {
  firstCompareSend: 1,
  firstCombine: 3,
  webSearchEnabled: 5,
  customProviderAdded: 6
} as const

export const GUIDE_CHECKLIST_LENGTH = GUIDE_CHECKLIST.length

export function completeGuideChecklistItem(done: readonly boolean[], index: number): boolean[] {
  return Array.from(
    { length: GUIDE_CHECKLIST_LENGTH },
    (_, itemIndex) => itemIndex === index || done[itemIndex] === true
  )
}

export function resetGuideChecklist(): boolean[] {
  return Array.from({ length: GUIDE_CHECKLIST_LENGTH }, () => false)
}

export function getGuideChecklistProgress(done: readonly boolean[]): number {
  return done.slice(0, GUIDE_CHECKLIST_LENGTH).filter(Boolean).length
}

export function isGuideChecklistComplete(done: readonly boolean[]): boolean {
  return getGuideChecklistProgress(done) === GUIDE_CHECKLIST_LENGTH
}

export function shouldShowGuideBanner(dismissed: boolean, done: readonly boolean[]): boolean {
  return !dismissed && !isGuideChecklistComplete(done)
}

export function markGuideChecklistOnCompareSend(targetIds: readonly string[], markDone: (index: number) => void): void {
  if (targetIds.length > 0) markDone(GUIDE_AUTO_CHECKLIST_ITEMS.firstCompareSend)
}

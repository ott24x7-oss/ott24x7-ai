export function formatCompareColumnErrorMessage(columnName: string, reason: string, chatModelHint: string): string {
  const readableReason = /vectorization failed/i.test(reason) ? chatModelHint : reason
  return `${columnName}: ${readableReason}`
}

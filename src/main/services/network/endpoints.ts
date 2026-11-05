import type { NetworkEndpoint } from './types'

/** No vendor endpoints are probed by the built-in network check. */
export async function builtinEndpoints(): Promise<readonly NetworkEndpoint[]> {
  return []
}

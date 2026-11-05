import { BaseService, Injectable, Phase, ServicePhase } from '@main/core/lifecycle'

/** Kept as a compatibility surface; provider metadata remains bundled and is never downloaded. */
export const REGISTRY_URL_GITHUB = ''
export const REGISTRY_URL_GITCODE = ''

export async function resolveRegistryBaseUrl(): Promise<string> {
  return ''
}

@Injectable('ProviderRegistryUpdaterService')
@ServicePhase(Phase.WhenReady)
export class ProviderRegistryUpdaterService extends BaseService {
  protected onReady(): void {}

  public async check(): Promise<void> {}
}

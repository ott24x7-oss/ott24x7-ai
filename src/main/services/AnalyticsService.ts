import type { TokenUsageData } from '@cherrystudio/analytics-client'
import { BaseService, Injectable, Phase, ServicePhase } from '@main/core/lifecycle'

/** Analytics stays registered for callers, but this build never creates a client or sends events. */
@Injectable('AnalyticsService')
@ServicePhase(Phase.WhenReady)
export class AnalyticsService extends BaseService {
  protected async onInit(): Promise<void> {}

  protected async onReady(): Promise<void> {}

  public trackTokenUsage(_data: TokenUsageData): void {
    void _data
  }

  public async trackAppUpdate(): Promise<void> {}
}

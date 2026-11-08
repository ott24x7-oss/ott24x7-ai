import type { OllamaClient, OllamaPullProgress } from './ollamaClient'

export class OllamaPullManager {
  private readonly controllers = new Map<string, AbortController>()

  constructor(
    private readonly client: OllamaClient,
    private readonly onProgress: (jobId: string, modelName: string, progress: OllamaPullProgress) => void
  ) {}

  async pull(jobId: string, modelName: string): Promise<{ cancelled: boolean }> {
    if (this.controllers.has(jobId)) throw new Error('A download with this id is already active')
    const controller = new AbortController()
    this.controllers.set(jobId, controller)
    try {
      await this.client.pull(modelName, controller.signal, (progress) => this.onProgress(jobId, modelName, progress))
      return { cancelled: false }
    } catch (error) {
      if (controller.signal.aborted) return { cancelled: true }
      throw error
    } finally {
      this.controllers.delete(jobId)
    }
  }

  cancel(jobId: string): boolean {
    const controller = this.controllers.get(jobId)
    if (!controller) return false
    controller.abort()
    return true
  }

  cancelAll(): void {
    for (const controller of this.controllers.values()) controller.abort()
  }
}

export const OLLAMA_API_BASE_URL = 'http://127.0.0.1:11434'

export interface OllamaTag {
  name: string
  size?: number
}

export interface OllamaPullProgress {
  status: string
  percent: number | null
}

export type OllamaInstallState = 'running' | 'stopped' | 'not-installed'

export interface OllamaInstallation {
  serverPath?: string
  appPath?: string
}

export async function detectOllamaState(
  client: Pick<OllamaClient, 'getVersion'>,
  findInstallation: () => Promise<OllamaInstallation | null>
): Promise<{ state: OllamaInstallState; version: string | null }> {
  try {
    const version = await client.getVersion()
    if (version) return { state: 'running', version }
  } catch {
    // A refused or malformed response means the server is not available.
  }
  return { state: (await findInstallation()) ? 'stopped' : 'not-installed', version: null }
}

interface OllamaProgressMessage {
  status?: unknown
  completed?: unknown
  total?: unknown
  error?: unknown
}

export class OllamaClient {
  constructor(
    private readonly baseUrl = OLLAMA_API_BASE_URL,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  async getVersion(): Promise<string | null> {
    const response = await this.fetcher(`${this.baseUrl}/api/version`, { signal: AbortSignal.timeout(2_000) })
    if (!response.ok) return null
    const body: unknown = await response.json()
    if (typeof body !== 'object' || body === null || !('version' in body) || typeof body.version !== 'string') {
      return null
    }
    return body.version
  }

  async getTags(): Promise<OllamaTag[]> {
    const response = await this.fetcher(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) throw await responseError(response)
    const body: unknown = await response.json()
    if (typeof body !== 'object' || body === null || !('models' in body) || !Array.isArray(body.models)) {
      throw new Error('Ollama returned an invalid model list')
    }

    return body.models.map((item: unknown) => {
      if (typeof item !== 'object' || item === null) throw new Error('Ollama returned an invalid model tag')
      const record = item as Record<string, unknown>
      const name = typeof record.name === 'string' ? record.name : record.model
      if (typeof name !== 'string') throw new Error('Ollama returned a model tag without a name')
      return { name, ...(typeof record.size === 'number' && { size: record.size }) }
    })
  }

  async pull(name: string, signal: AbortSignal, onProgress: (progress: OllamaPullProgress) => void): Promise<void> {
    const response = await this.fetcher(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, stream: true }),
      signal
    })
    if (!response.ok) throw await responseError(response)
    if (!response.body) throw new Error('Ollama did not return download progress')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      let newline = buffer.indexOf('\n')
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        if (line) this.handleProgressLine(line, onProgress)
        newline = buffer.indexOf('\n')
      }
      if (done) break
    }

    if (buffer.trim()) this.handleProgressLine(buffer.trim(), onProgress)
  }

  async delete(name: string): Promise<void> {
    const response = await this.fetcher(`${this.baseUrl}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
      signal: AbortSignal.timeout(30_000)
    })
    if (!response.ok) throw await responseError(response)
  }

  private handleProgressLine(line: string, onProgress: (progress: OllamaPullProgress) => void): void {
    let message: OllamaProgressMessage
    try {
      message = JSON.parse(line) as OllamaProgressMessage
    } catch {
      throw new Error('Ollama returned malformed download progress')
    }
    if (typeof message.error === 'string' && message.error) throw new Error(message.error)
    const status = typeof message.status === 'string' ? message.status : 'Downloading'
    const total = typeof message.total === 'number' && message.total > 0 ? message.total : null
    const completed = typeof message.completed === 'number' ? message.completed : null
    const percent =
      status === 'success'
        ? 100
        : total && completed !== null
          ? Math.min(100, Math.floor((completed / total) * 100))
          : null
    onProgress({ status, percent })
  }
}

async function responseError(response: Response): Promise<Error> {
  try {
    const body: unknown = await response.json()
    if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
      return new Error(body.error)
    }
  } catch {
    // Keep the HTTP status as the useful fallback for a non-JSON error response.
  }
  return new Error(`Ollama request failed (${response.status})`)
}

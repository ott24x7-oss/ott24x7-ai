import http from 'node:http'
import https from 'node:https'
import { urlToHttpOptions } from 'node:url'

import axios from 'axios'
import { socksDispatcher } from 'fetch-socks'
import { Dispatcher, EnvHttpProxyAgent, getGlobalDispatcher, ProxyAgent, setGlobalDispatcher } from 'undici'

import { type NodeProxyLogger, ProxyBypassRuleMatcher } from './bypassRules'
import { findSiteProxyRule, type SiteProxyRule } from '@shared/utils/siteProxy'
import { normalizeProxyEndpoint, type ProxyEndpoint } from './proxyRouting'

const SOCKS_DISPATCHER_SYMBOL = Symbol.for('undici.globalDispatcher.1')
const globalDispatcherRegistry = globalThis as typeof globalThis & Record<symbol, Dispatcher | undefined>

interface HttpProxyAgents {
  http: http.Agent
  https: http.Agent
}

class SelectiveDispatcher extends Dispatcher {
  constructor(
    private proxyDispatcher: Dispatcher | null,
    private directDispatcher: Dispatcher,
    private siteProxyDispatchers: Array<{ rule: SiteProxyRule; dispatcher: Dispatcher }>,
    private shouldByPass: (url: string) => boolean,
    private logger?: NodeProxyLogger
  ) {
    super()
  }

  dispatch(opts: Dispatcher.DispatchOptions, handler: Dispatcher.DispatchHandlers) {
    const origin = opts.origin?.toString()
    if (!origin || this.shouldByPass(origin)) {
      return this.directDispatcher.dispatch(opts, handler)
    }
    const siteRule = findSiteProxyRule(new URL(origin).hostname, this.siteProxyDispatchers.map(({ rule }) => rule))
    const siteDispatcher = this.siteProxyDispatchers.find(({ rule }) => rule.id === siteRule?.id)?.dispatcher
    return (siteDispatcher ?? this.proxyDispatcher ?? this.directDispatcher).dispatch(opts, handler)
  }

  async close(): Promise<void> {
    for (const dispatcher of new Set([
      ...(this.proxyDispatcher ? [this.proxyDispatcher] : []),
      ...this.siteProxyDispatchers.map(({ dispatcher }) => dispatcher)
    ])) {
      try {
        await dispatcher.close()
      } catch (error) {
        this.logger?.error?.('Failed to close dispatcher:', error)
        void dispatcher.destroy()
      }
    }
  }

  async destroy(): Promise<void> {
    for (const dispatcher of new Set([
      ...(this.proxyDispatcher ? [this.proxyDispatcher] : []),
      ...this.siteProxyDispatchers.map(({ dispatcher }) => dispatcher)
    ])) {
      try {
        await dispatcher.destroy()
      } catch (error) {
        this.logger?.error?.('Failed to destroy dispatcher:', error)
      }
    }
  }
}

interface SiteProxyHttpRoute {
  rule: SiteProxyRule
  agents: HttpProxyAgents
}

export class NodeProxyBackend {
  private proxyDispatcher: Dispatcher | null = null
  private httpProxyAgents: HttpProxyAgents | null = null
  private siteHttpProxyAgents: SiteProxyHttpRoute[] = []
  private readonly proxyBypassRuleMatcher = new ProxyBypassRuleMatcher()
  private readonly originalGlobalDispatcher: Dispatcher
  private readonly originalSocksDispatcher: Dispatcher
  private readonly originalHttpGet: typeof http.get
  private readonly originalHttpRequest: typeof http.request
  private readonly originalHttpsGet: typeof https.get
  private readonly originalHttpsRequest: typeof https.request
  private readonly originalAxiosAdapter

  constructor(private logger?: NodeProxyLogger) {
    this.originalGlobalDispatcher = getGlobalDispatcher()
    this.originalSocksDispatcher = globalDispatcherRegistry[SOCKS_DISPATCHER_SYMBOL] ?? this.originalGlobalDispatcher
    this.originalHttpGet = http.get
    this.originalHttpRequest = http.request
    this.originalHttpsGet = https.get
    this.originalHttpsRequest = https.request
    this.originalAxiosAdapter = axios.defaults.adapter
  }

  async configure(
    proxyUrl: string | undefined,
    endpoint: ProxyEndpoint | null,
    bypassRules: string[],
    applyEnvironment: () => void,
    siteProxyRules: SiteProxyRule[] = []
  ): Promise<void> {
    const httpProxyAgents = endpoint ? await this.createHttpProxyAgents(proxyUrl!, endpoint) : null
    const siteRoutes = await Promise.all(
      siteProxyRules.map(async (rule) => {
        const ruleEndpoint = normalizeProxyEndpoint(rule.proxyUrl)
        if (!ruleEndpoint) throw new Error('Missing per-site proxy URL')
        return {
          rule,
          agents: await this.createHttpProxyAgents(rule.proxyUrl, ruleEndpoint),
          dispatcher: this.createProxyDispatcher(rule.proxyUrl, ruleEndpoint)
        }
      })
    )
    this.proxyBypassRuleMatcher.updateByPassRules(bypassRules, this.logger)
    applyEnvironment()
    this.setGlobalFetchProxy(proxyUrl, endpoint, siteRoutes.map(({ rule, dispatcher }) => ({ rule, dispatcher })))
    this.setGlobalHttpProxy(httpProxyAgents, siteRoutes.map(({ rule, agents }) => ({ rule, agents })))
  }

  private async createHttpProxyAgents(proxyUrl: string, endpoint: ProxyEndpoint): Promise<HttpProxyAgents> {
    if (endpoint.kind === 'socks') {
      const { SocksProxyAgent } = await import('socks-proxy-agent')
      return { http: new SocksProxyAgent(proxyUrl), https: new SocksProxyAgent(proxyUrl) }
    }

    const [{ HttpProxyAgent }, { HttpsProxyAgent }] = await Promise.all([
      import('http-proxy-agent'),
      import('https-proxy-agent')
    ])
    return { http: new HttpProxyAgent(endpoint.url), https: new HttpsProxyAgent(endpoint.url) }
  }

  private setGlobalHttpProxy(agents: HttpProxyAgents | null, siteRoutes: SiteProxyHttpRoute[]): void {
    const previousAgents = this.httpProxyAgents
    const previousSiteAgents = this.siteHttpProxyAgents
    this.httpProxyAgents = agents
    this.siteHttpProxyAgents = siteRoutes

    if (!agents && siteRoutes.length === 0) {
      http.get = this.originalHttpGet
      http.request = this.originalHttpRequest
      https.get = this.originalHttpsGet
      https.request = this.originalHttpsRequest
    } else {
      http.get = this.bindHttpMethod(this.originalHttpGet, agents, siteRoutes)
      http.request = this.bindHttpMethod(this.originalHttpRequest, agents, siteRoutes)
      https.get = this.bindHttpMethod(this.originalHttpsGet, agents, siteRoutes, 'https:')
      https.request = this.bindHttpMethod(this.originalHttpsRequest, agents, siteRoutes, 'https:')
    }

    const oldAgents = [
      ...(previousAgents ? [previousAgents.http, previousAgents.https] : []),
      ...previousSiteAgents.flatMap(({ agents: previous }) => [previous.http, previous.https])
    ]
    for (const agent of new Set(oldAgents)) {
      try {
        agent.destroy()
      } catch (error) {
        this.logger?.error?.('Failed to destroy proxy agent:', error)
      }
    }
  }

  private bindHttpMethod(
    originalMethod: (...args: never[]) => http.ClientRequest,
    fallbackAgentOrAgents: HttpProxyAgents | http.Agent | null,
    siteRoutesOrProtocol: SiteProxyHttpRoute[] | string = [],
    defaultProtocol = 'http:'
  ) {
    const fallbackAgents =
      fallbackAgentOrAgents instanceof http.Agent
        ? { http: fallbackAgentOrAgents, https: fallbackAgentOrAgents }
        : fallbackAgentOrAgents
    const siteRoutes = typeof siteRoutesOrProtocol === 'string' ? [] : siteRoutesOrProtocol
    if (typeof siteRoutesOrProtocol === 'string') defaultProtocol = siteRoutesOrProtocol
    const invokeOriginal = (...args: unknown[]) => Reflect.apply(originalMethod, undefined, args) as http.ClientRequest

    return (...args: any[]) => {
      let url: string | URL | undefined
      let options: http.RequestOptions | https.RequestOptions
      let callback: ((res: http.IncomingMessage) => void) | undefined

      if (typeof args[0] === 'string' || args[0] instanceof URL) {
        url = args[0]
        if (typeof args[1] === 'function') {
          options = {}
          callback = args[1]
        } else {
          options = { ...args[1] }
          callback = args[2]
        }
      } else {
        options = { ...args[0] }
        callback = args[1]
      }

      const targetOptions = url
        ? { ...urlToHttpOptions(typeof url === 'string' ? new URL(url) : url), ...options }
        : options
      const defaultAgent =
        targetOptions._defaultAgent || (defaultProtocol === 'https:' ? https.globalAgent : http.globalAgent)
      const protocol = targetOptions.protocol || (Reflect.get(defaultAgent, 'protocol') as string)
      const hostname = targetOptions.hostname || targetOptions.host || 'localhost'
      const host = hostname.includes(':') && !hostname.startsWith('[') ? `[${hostname}]` : hostname
      const targetAgent = typeof targetOptions.agent === 'boolean' ? defaultAgent : targetOptions.agent || defaultAgent
      const port =
        targetOptions.port || targetOptions.defaultPort || (Reflect.get(targetAgent, 'defaultPort') as number) || 80

      if (this.proxyBypassRuleMatcher.isByPass(`${protocol}//${host}:${port}`, this.logger)) {
        return url ? invokeOriginal(url, options, callback) : invokeOriginal(options, callback)
      }
      const siteRoute = findSiteProxyRule(hostname, siteRoutes.map(({ rule }) => rule))
      const selectedAgents = siteRoutes.find(({ rule }) => rule.id === siteRoute?.id)?.agents ?? fallbackAgents
      if (!selectedAgents) return url ? invokeOriginal(url, options, callback) : invokeOriginal(options, callback)
      if (options.agent instanceof https.Agent) {
        // Per-request TLS option — mutating the shared proxy agent would leak
        // the caller's rejectUnauthorized to later unrelated requests.
        const tlsStance = options.agent.options.rejectUnauthorized
        if (typeof tlsStance === 'boolean') {
          ;(options as https.RequestOptions).rejectUnauthorized = tlsStance
        }
      }
      options.agent = protocol === 'https:' ? selectedAgents.https : selectedAgents.http
      return url ? invokeOriginal(url, options, callback) : invokeOriginal(options, callback)
    }
  }

  private createProxyDispatcher(proxyUrl: string, endpoint: ProxyEndpoint): Dispatcher {
    if (endpoint.kind === 'socks') {
      return socksDispatcher({
        port: endpoint.port,
        type: endpoint.version,
        host: endpoint.host,
        userId: endpoint.userId,
        password: endpoint.password
      })
    }
    return new ProxyAgent({ uri: proxyUrl })
  }

  private setGlobalFetchProxy(
    fallbackProxyUrl: string | undefined,
    endpoint: ProxyEndpoint | null,
    siteProxyDispatchers: Array<{ rule: SiteProxyRule; dispatcher: Dispatcher }>
  ): void {
    const previousDispatcher = this.proxyDispatcher
    if (!endpoint && siteProxyDispatchers.length === 0) {
      setGlobalDispatcher(this.originalGlobalDispatcher)
      globalDispatcherRegistry[SOCKS_DISPATCHER_SYMBOL] = this.originalSocksDispatcher
      void this.proxyDispatcher?.close()
      this.proxyDispatcher = null
      axios.defaults.adapter = this.originalAxiosAdapter
      return
    }

    axios.defaults.adapter = 'fetch'
    const proxyDispatcher = endpoint
      ? endpoint.kind === 'http'
        ? new EnvHttpProxyAgent({ noProxy: '' })
        : this.createProxyDispatcher(fallbackProxyUrl ?? '', endpoint)
      : null
    this.proxyDispatcher = new SelectiveDispatcher(
      proxyDispatcher,
      this.originalSocksDispatcher,
      siteProxyDispatchers,
      (origin) => this.proxyBypassRuleMatcher.isByPass(origin, this.logger),
      this.logger
    )
    setGlobalDispatcher(this.proxyDispatcher)
    if (endpoint?.kind === 'socks') globalDispatcherRegistry[SOCKS_DISPATCHER_SYMBOL] = this.proxyDispatcher
    else globalDispatcherRegistry[SOCKS_DISPATCHER_SYMBOL] = this.originalSocksDispatcher
    if (previousDispatcher && previousDispatcher !== this.proxyDispatcher) void previousDispatcher.close()
  }
}

import { Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Input, Switch } from '@cherrystudio/ui'
import { ipcApi } from '@renderer/ipc'
import { toast } from '@renderer/services/toast'
import { parseSiteProxyUrl, validateProxyDomains, type SiteProxyRuleDraft } from '@shared/utils/siteProxy'
import type { OutputFor } from '@shared/ipc/types'

import { SettingDescription, SettingDivider, SettingRowTitle } from '@renderer/components/SettingsPrimitives'

const emptyRule = (name = ''): SiteProxyRuleDraft => ({
  id: crypto.randomUUID(),
  name,
  enabled: false,
  domains: [],
  proxyUrl: '',
  password: ''
})

function splitPasswordFromProxyUrl(value: string): { proxyUrl: string; password?: string } {
  const match = value.match(/^([a-z][a-z\d+.-]*:\/\/)([^:@/]+):([^@/]*)@(.+)$/i)
  if (!match) return { proxyUrl: value }
  let password = match[3]
  try {
    password = decodeURIComponent(password)
  } catch {
    // Keep partially typed credentials editable until the URL becomes valid.
  }
  return { proxyUrl: `${match[1]}${match[2]}@${match[4]}`, password }
}

function getProxyTestErrorMessageKey(error: NonNullable<OutputFor<'proxy.test_site_rule'>['error']>): string {
  switch (error) {
    case 'invalid_config':
      return 'settings.proxy.test.error.invalid_config'
    case 'authentication_required':
      return 'settings.proxy.test.error.authentication_required'
    case 'timeout':
      return 'settings.proxy.test.error.timeout'
    case 'unreachable':
      return 'settings.proxy.test.error.unreachable'
    case 'http_error':
      return 'settings.proxy.test.error.http_error'
    case 'connection_failed':
      return 'settings.proxy.test.error.connection_failed'
  }
}

const PerSiteProxySettings = () => {
  const { t } = useTranslation()
  const [rules, setRules] = useState<SiteProxyRuleDraft[]>([])
  const [loaded, setLoaded] = useState(false)
  const [testLoadingId, setTestLoadingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, OutputFor<'proxy.test_site_rule'>>>({})
  const [invalidRuleId, setInvalidRuleId] = useState<string | null>(null)
  const rulesRef = useRef(rules)

  useEffect(() => {
    let active = true
    void ipcApi
      .request('proxy.get_site_rules')
      .then((storedRules) => {
        if (!active) return
        rulesRef.current = storedRules
        setRules(storedRules)
      })
      .catch(() => toast.error(t('settings.proxy.site.load_error')))
      .finally(() => {
        if (active) setLoaded(true)
      })
    return () => {
      active = false
    }
  }, [t])

  const updateRules = (nextRules: SiteProxyRuleDraft[]) => {
    rulesRef.current = nextRules
    setRules(nextRules)
    setTestResults({})
  }

  const saveRules = async () => {
    try {
      await ipcApi.request('proxy.save_site_rules', rulesRef.current)
      setInvalidRuleId(null)
    } catch {
      toast.error(t('settings.proxy.site.save_error'))
    }
  }

  const updateRule = (id: string, update: Partial<SiteProxyRuleDraft>) => {
    updateRules(rulesRef.current.map((rule) => (rule.id === id ? { ...rule, ...update } : rule)))
  }

  const saveRuleOnBlur = (id: string) => {
    const rule = rulesRef.current.find((candidate) => candidate.id === id)
    if (!rule) return
    try {
      if (rule.domains.length) validateProxyDomains(rule.domains)
      if (rule.proxyUrl) parseSiteProxyUrl(rule.proxyUrl)
      if (rule.enabled) {
        validateProxyDomains(rule.domains)
        parseSiteProxyUrl(rule.proxyUrl)
      }
      setInvalidRuleId(null)
      void saveRules()
    } catch {
      setInvalidRuleId(id)
    }
  }

  const addRule = (rule: SiteProxyRuleDraft) => {
    const nextRules = [...rulesRef.current, rule]
    updateRules(nextRules)
    void ipcApi.request('proxy.save_site_rules', nextRules).catch(() => {
      toast.error(t('settings.proxy.site.save_error'))
    })
  }

  const toggleRule = (rule: SiteProxyRuleDraft, enabled: boolean) => {
    if (enabled) {
      try {
        validateProxyDomains(rule.domains)
        parseSiteProxyUrl(rule.proxyUrl)
      } catch {
        setInvalidRuleId(rule.id)
        return
      }
    }
    const nextRules = rulesRef.current.map((candidate) =>
      candidate.id === rule.id ? { ...candidate, enabled } : candidate
    )
    updateRules(nextRules)
    void ipcApi.request('proxy.save_site_rules', nextRules).catch(() => toast.error(t('settings.proxy.site.save_error')))
  }

  const deleteRule = (id: string) => {
    const nextRules = rulesRef.current.filter((rule) => rule.id !== id)
    updateRules(nextRules)
    void ipcApi.request('proxy.save_site_rules', nextRules).catch(() => toast.error(t('settings.proxy.site.save_error')))
  }

  const testRule = async (rule: SiteProxyRuleDraft) => {
    setTestLoadingId(rule.id)
    setTestResults((current) => {
      const next = { ...current }
      delete next[rule.id]
      return next
    })
    try {
      const result = await ipcApi.request('proxy.test_site_rule', rule)
      setTestResults((current) => ({ ...current, [rule.id]: result }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('settings.proxy.test.error.connection_failed'))
    } finally {
      setTestLoadingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-3 py-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <SettingRowTitle>{t('settings.proxy.site.title')}</SettingRowTitle>
          <SettingDescription>{t('settings.proxy.site.description')}</SettingDescription>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => addRule(emptyRule())} disabled={!loaded}>
            {t('common.add')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              addRule({
                ...emptyRule('Perplexity'),
                domains: ['perplexity.ai', 'www.perplexity.ai', 'pplx.ai', 'perplexity.com']
              })
            }
            disabled={!loaded}>
            {t('settings.proxy.site.perplexity_preset')}
          </Button>
        </div>
      </div>
      <SettingDivider />
      {rules.map((rule) => {
        const testResult = testResults[rule.id]
        let socks5HasCredentials = false
        try {
          const parsed = parseSiteProxyUrl(rule.proxyUrl)
          socks5HasCredentials = parsed.protocol === 'socks5:' && (Boolean(parsed.username) || Boolean(rule.password))
        } catch {
          socks5HasCredentials = rule.proxyUrl.startsWith('socks5:') && Boolean(rule.password)
        }

        return (
          <div key={rule.id} className="flex flex-col gap-3 rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <Switch
                checked={rule.enabled}
                onCheckedChange={(enabled) => toggleRule(rule, enabled)}
                aria-label={t('common.enabled')}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => deleteRule(rule.id)}
                aria-label={t('common.delete')}>
                <Trash2 size={16} />
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span>{t('common.name')}</span>
                <Input
                  value={rule.name}
                  onChange={(event) => updateRule(rule.id, { name: event.target.value })}
                  onBlur={() => saveRuleOnBlur(rule.id)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>{t('settings.proxy.site.domains')}</span>
                <Input
                  value={rule.domains.join(', ')}
                  placeholder={t('settings.proxy.site.domains_placeholder')}
                  onChange={(event) =>
                    updateRule(rule.id, {
                      domains: event.target.value.split(',').map((domain) => domain.trim()).filter(Boolean)
                    })
                  }
                  onBlur={() => saveRuleOnBlur(rule.id)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>{t('settings.proxy.site.proxy_url')}</span>
                <Input
                  value={rule.proxyUrl}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="socks5://127.0.0.1:1080"
                  onChange={(event) => {
                    const split = splitPasswordFromProxyUrl(event.target.value)
                    updateRule(rule.id, {
                      proxyUrl: split.proxyUrl,
                      ...(split.password !== undefined && { password: split.password })
                    })
                  }}
                  onBlur={() => saveRuleOnBlur(rule.id)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>{t('settings.proxy.site.password')}</span>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={rule.password}
                  onChange={(event) => updateRule(rule.id, { password: event.target.value })}
                  onBlur={() => saveRuleOnBlur(rule.id)}
                />
              </label>
            </div>
            {socks5HasCredentials && (
              <SettingDescription role="note">{t('settings.proxy.site.socks5_auth_warning')}</SettingDescription>
            )}
            {invalidRuleId === rule.id && (
              <SettingDescription role="alert">{t('settings.proxy.site.validation')}</SettingDescription>
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                loading={testLoadingId === rule.id}
                disabled={testLoadingId !== null}
                onClick={() => void testRule(rule)}>
                {t('settings.proxy.test.action')}
              </Button>
              {testResult && (
                <SettingDescription role="status">
                  {testResult.success
                    ? t('settings.proxy.site.test.success', {
                        target: testResult.target,
                        latency: testResult.latencyMs ?? 0,
                        country: testResult.country
                          ? ` (${t('settings.proxy.site.test.country', { country: testResult.country })})`
                          : ''
                      })
                    : t('settings.proxy.site.test.failure', {
                        target: testResult.target,
                        reason: testResult.error
                          ? t(getProxyTestErrorMessageKey(testResult.error))
                          : t('settings.proxy.test.error.connection_failed')
                      })}
                </SettingDescription>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default PerSiteProxySettings

import { useLocation, useNavigate, useSearch } from '@tanstack/react-router'
import { Bug } from 'lucide-react'
import type { FC, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge, Button, Divider } from '@cherrystudio/ui'
import AppLogo from '@renderer/assets/images/logo.png'
import { useDesktopUpdate } from '@renderer/components/app/DesktopUpdateProvider'
import { PromoDetails, PromoExternalLink } from '@renderer/components/app/PromoCard'
import { usePromos } from '@renderer/components/app/PromosProvider'
import { DoctorPopup } from '@renderer/components/doctor'
import LogoAvatar from '@renderer/components/icons/LogoAvatar'
import {
  SettingGroup,
  SettingRow,
  SettingRowTitle,
  SettingsContentColumn
} from '@renderer/components/SettingsPrimitives'
import { useTheme } from '@renderer/hooks/useTheme'
import { ipcApi } from '@renderer/ipc'
import { SOURCE_CODE_URL } from '@renderer/utils/promos'
import { OTT_DESKTOP_BUILD } from '@shared/utils/desktopUpdate'
import { DOCTOR_OPEN_QUERY_PARAM, type DoctorPanel } from '@shared/utils/doctor'

import { OpenSourceLicensesDialog } from './OpenSourceLicensesDialog'

const AboutSettings: FC = () => {
  const [version, setVersion] = useState('')
  const [licensesOpen, setLicensesOpen] = useState(false)
  const [updateCheck, setUpdateCheck] = useState<
    { state: 'idle' | 'checking' | 'latest' | 'error' } | { state: 'available'; version: string }
  >({ state: 'idle' })
  const { t } = useTranslation()
  const { checkForUpdates } = useDesktopUpdate()
  const promos = usePromos()
  const { theme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as Partial<Record<typeof DOCTOR_OPEN_QUERY_PARAM, DoctorPanel>>
  const consumedDoctorPanelRef = useRef<DoctorPanel | undefined>(undefined)

  useEffect(() => {
    void ipcApi.request('app.get_info').then((appInfo) => setVersion(appInfo.version))
  }, [])

  const handleUpdateCheck = async () => {
    setUpdateCheck({ state: 'checking' })
    try {
      const status = await checkForUpdates()
      setUpdateCheck(
        status.decision === 'NONE' ? { state: 'latest' } : { state: 'available', version: status.manifest.version }
      )
    } catch {
      setUpdateCheck({ state: 'error' })
    }
  }

  useEffect(() => {
    const initialPanel = search[DOCTOR_OPEN_QUERY_PARAM]
    if (!initialPanel) {
      consumedDoctorPanelRef.current = undefined
      return
    }
    if (consumedDoctorPanelRef.current === initialPanel) return
    consumedDoctorPanelRef.current = initialPanel

    void navigate({
      to: location.pathname,
      search: (previous: Record<string, unknown>) => {
        const remaining = { ...previous }
        delete remaining[DOCTOR_OPEN_QUERY_PARAM]
        return remaining
      },
      replace: true
    })
    void DoctorPopup.show({ initialPanel })
  }, [location.pathname, navigate, search])

  return (
    <SettingsContentColumn theme={theme}>
      <SettingGroup theme={theme}>
        <div className="flex items-center gap-4 py-1">
          <LogoAvatar logo={AppLogo} size={72} className="rounded-2xl" alt="OTT24x7 AI" />
          <div className="flex min-h-18 flex-col items-start justify-center">
            <h1 className="mb-1 text-lg font-bold text-foreground">OTT24x7 AI</h1>
            <div className="text-muted-foreground text-sm">{t('settings.about.description')}</div>
            <Badge className="mt-1.5 rounded-md border-primary/20 bg-primary/10 px-1.5 py-0 text-[11px] leading-4 text-primary">
              v{version}
            </Badge>
          </div>
        </div>
        <Divider className="my-3" />
        <SettingRow className="items-start gap-3">
          <div className="space-y-1">
            <SettingRowTitle>{t('desktop_update.check_for_updates')}</SettingRowTitle>
            <p className="text-sm text-muted-foreground">
              {t('desktop_update.version_and_build', { version, build: OTT_DESKTOP_BUILD })}
            </p>
            {updateCheck.state === 'checking' && (
              <p role="status" className="text-sm text-muted-foreground">
                {t('desktop_update.checking')}
              </p>
            )}
            {updateCheck.state === 'latest' && (
              <p role="status" className="text-sm text-muted-foreground">
                {t('desktop_update.latest')}
              </p>
            )}
            {updateCheck.state === 'available' && (
              <p role="status" className="text-sm text-muted-foreground">
                {t('desktop_update.available', { version: updateCheck.version })}
              </p>
            )}
            {updateCheck.state === 'error' && (
              <p role="alert" className="text-sm text-destructive">
                {t('desktop_update.check_error')}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={updateCheck.state === 'checking'}
            onClick={() => void handleUpdateCheck()}>
            {updateCheck.state === 'checking'
              ? t('desktop_update.checking')
              : updateCheck.state === 'error'
                ? t('desktop_update.retry')
                : t('desktop_update.check_for_updates')}
          </Button>
        </SettingRow>
        <Divider className="my-3" />
        <AboutActionRow
          id="setting-about-debug-tools"
          icon={<Bug className="size-4.5" />}
          title={t('settings.about.debug.title')}
          actionLabel={t('settings.about.debug.open')}
          onAction={() => ipcApi.request('system.toggle_dev_tools')}
        />
        <Divider className="my-3" />
        <SettingRow className="items-start gap-3">
          <div className="space-y-1">
            <SettingRowTitle>{t('settings.about.release_notice_title')}</SettingRowTitle>
            <p className="text-sm text-muted-foreground">{t('settings.about.license_notice')}</p>
          </div>
          <PromoExternalLink href={SOURCE_CODE_URL} className="text-sm">
            {t('settings.about.source_code')}
          </PromoExternalLink>
        </SettingRow>
        <Divider className="my-3" />
        <SettingRow className="gap-3">
          <SettingRowTitle>{t('settings.about.open_source_licenses')}</SettingRowTitle>
          <Button size="sm" variant="outline" onClick={() => setLicensesOpen(true)}>
            {t('settings.about.open_source_licenses')}
          </Button>
        </SettingRow>
      </SettingGroup>
      <SettingGroup theme={theme}>
        <h2 className="text-sm font-medium text-foreground">{t('promos.our_stores')}</h2>
        {promos.map((promo) => (
          <SettingRow key={promo.id} className="items-start gap-3">
            <PromoDetails promo={promo} />
          </SettingRow>
        ))}
      </SettingGroup>
      <OpenSourceLicensesDialog open={licensesOpen} onOpenChange={setLicensesOpen} />
    </SettingsContentColumn>
  )
}

function AboutActionRow({
  actionLabel,
  icon,
  id,
  onAction,
  title
}: {
  actionLabel: ReactNode
  icon: ReactNode
  id?: string
  onAction: () => void | Promise<void>
  title: string
}) {
  return (
    <SettingRow id={id} className={id ? 'scroll-mt-6 gap-3' : 'gap-3'}>
      <SettingRowTitle className="gap-2.5">
        {icon}
        {title}
      </SettingRowTitle>
      <Button size="sm" onClick={() => void onAction()} variant="outline">
        {actionLabel}
      </Button>
    </SettingRow>
  )
}

export default AboutSettings

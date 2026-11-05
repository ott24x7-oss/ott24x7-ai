import { useTranslation } from 'react-i18next'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, ScrollArea } from '@cherrystudio/ui'
import licenseText from '../../../../../LICENSE?raw'

export function OpenSourceLicensesDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('settings.about.open_source_licenses')}</DialogTitle>
          <DialogDescription>{t('settings.about.licenses.agpl_notice')}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-hidden rounded-md border border-border-subtle">
          <ScrollArea className="h-[60vh]">
            <pre className="whitespace-pre-wrap break-words p-4 font-mono text-xs leading-5">{licenseText}</pre>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}

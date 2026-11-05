import { ChevronRight, CircleQuestionMark, Stethoscope } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, MenuItem, MenuList, Popover, PopoverContent, PopoverTrigger } from '@cherrystudio/ui'
import { DoctorPopup } from '@renderer/components/doctor'
import { useAccountSubmenu } from '@renderer/hooks/useAccountSubmenu'

export function HelpMenu({ onRequestClose }: { onRequestClose?: () => void }) {
  const { t } = useTranslation()
  const {
    open: menuOpen,
    onOpenChange: setMenuOpen,
    initialFocusRef: firstActionRef,
    triggerProps,
    contentProps
  } = useAccountSubmenu()
  const pendingActionRef = useRef<(() => void | Promise<void>) | null>(null)

  const trigger = (
    <Button
      type="button"
      variant="ghost"
      aria-label={t('help.title')}
      size="sm"
      {...triggerProps}
      className="h-8 min-h-8 w-full justify-start gap-2 rounded-md bg-transparent px-2 py-0 text-[13px] text-foreground leading-5">
      <CircleQuestionMark className="!text-muted-foreground size-4" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-left">{t('help.title')}</span>
      <ChevronRight className="!text-muted-foreground size-4" aria-hidden />
    </Button>
  )

  return (
    <Popover open={menuOpen} onOpenChange={setMenuOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        side="right"
        sideOffset={8}
        className="w-52 rounded-md p-1.5"
        {...contentProps}
        onCloseAutoFocus={(event) => {
          contentProps.onCloseAutoFocus(event)
          const action = pendingActionRef.current
          if (!action) return
          pendingActionRef.current = null
          event.preventDefault()
          onRequestClose?.()
          void action()
        }}>
        <MenuList className="gap-0.5">
          <MenuItem
            size="sm"
            className="h-8 gap-2 rounded-md border-0 bg-transparent px-2 py-0 text-[13px] leading-5 [&_svg]:text-muted-foreground"
            ref={firstActionRef}
            icon={<Stethoscope size={16} />}
            label={t('settings.doctor.entry.title')}
            onClick={() => {
              pendingActionRef.current = async () => {
                await DoctorPopup.show({ initialPanel: 'checks' })
              }
              setMenuOpen(false)
            }}
          />
        </MenuList>
      </PopoverContent>
    </Popover>
  )
}

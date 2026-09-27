import { SidebarItem, SidebarLabel } from '@/components/catalyst/sidebar'
import { readPref, writePref } from '@/lib/prefs'
import { ChevronDownIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import { useEffect, useId, useState } from 'react'

export interface SidebarGroupItem {
  href: string
  label: string
  current: boolean
  badge?: React.ReactNode
}

/**
 * A sidebar item that folds out into sub-items (e.g. Forms → All forms, Responses).
 * It opens by itself when one of its pages is current, otherwise remembers how it was left.
 * While folded, the sub-items' badge shows on the group so nothing waiting is hidden.
 */
export function SidebarGroup({
  id,
  icon,
  label,
  badge,
  items,
}: {
  /** Key for remembering open/closed in this browser. */
  id: string
  icon: React.ReactNode
  label: string
  badge?: React.ReactNode
  items: SidebarGroupItem[]
}) {
  const panelId = useId()
  const active = items.some((i) => i.current)
  const prefKey = `sidebar.${id}`
  const [open, setOpen] = useState(() => active || readPref(prefKey, ['open', 'closed'] as const, 'open') === 'open')
  useEffect(() => {
    if (active) setOpen(true)
  }, [active])

  const toggle = () =>
    setOpen((was) => {
      writePref(prefKey, was ? 'closed' : 'open')
      return !was
    })

  return (
    <>
      <SidebarItem onClick={toggle} aria-expanded={open} aria-controls={panelId}>
        {icon}
        <SidebarLabel>{label}</SidebarLabel>
        {!open && badge}
        <ChevronDownIcon
          data-slot="icon"
          className={clsx('transition-transform duration-150', open ? 'rotate-180' : '', !open && badge ? 'ms-2!' : '')}
        />
      </SidebarItem>
      {open && (
        <div
          id={panelId}
          className="relative ms-5 flex flex-col gap-0.5 border-s border-zinc-950/10 ps-2 dark:border-white/10"
        >
          {items.map((item) => (
            <SidebarItem key={item.href} href={item.href} current={item.current}>
              <SidebarLabel>{item.label}</SidebarLabel>
              {item.badge}
            </SidebarItem>
          ))}
        </div>
      )}
    </>
  )
}

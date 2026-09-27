import { SidebarItem, SidebarLabel } from '@/components/catalyst/sidebar'
import { readPref, writePref } from '@/lib/prefs'
import { ChevronDownIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import { useEffect, useId, useState } from 'react'

/** A small count pill for sidebar items; nothing when there's nothing to count. */
export function CountBadge({ count }: { count: number }) {
  if (!count) return null
  return (
    <span className="ms-auto min-w-5 rounded-full bg-brand-600 px-1.5 text-center text-xs/5 font-semibold text-white tabular-nums">
      {count}
    </span>
  )
}

export interface SidebarGroupItem {
  href: string
  label: string
  current: boolean
  count?: number
}

/**
 * A sidebar item that folds out into sub-items (e.g. Forms → All forms, Responses).
 * It opens by itself when one of its pages is current, otherwise remembers how it was left.
 * While folded, it carries its sub-items' counts and marks itself current, so neither what's
 * waiting nor where you are is hidden.
 */
export function SidebarGroup({
  id,
  icon,
  label,
  items,
}: {
  /** Key for remembering open/closed in this browser. */
  id: string
  icon: React.ReactNode
  label: string
  items: SidebarGroupItem[]
}) {
  const panelId = useId()
  const active = items.some((i) => i.current)
  const total = items.reduce((sum, i) => sum + (i.count ?? 0), 0)
  const prefKey = `sidebar.${id}`
  const [open, setOpen] = useState(() => active || readPref(prefKey, ['open', 'closed'] as const, 'open') === 'open')
  useEffect(() => {
    if (active) setOpen(true)
  }, [active])

  const toggle = () => {
    const next = !open
    setOpen(next)
    writePref(prefKey, next ? 'open' : 'closed')
  }
  const folded = !open

  return (
    <>
      <SidebarItem
        onClick={toggle}
        current={active && folded}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
      >
        {icon}
        <SidebarLabel>{label}</SidebarLabel>
        {folded && <CountBadge count={total} />}
        <ChevronDownIcon
          data-slot="icon"
          className={clsx('transition-transform duration-150', open && 'rotate-180', folded && total > 0 && 'ms-2!')}
        />
      </SidebarItem>
      {open && (
        <div id={panelId} className="flex flex-col gap-0.5">
          {items.map((item) => (
            // Indented through the label only, so the current-page bar stays at the sidebar edge
            // like every other item's.
            <SidebarItem key={item.href} href={item.href} current={item.current}>
              <SidebarLabel className="ps-8">{item.label}</SidebarLabel>
              <CountBadge count={item.count ?? 0} />
            </SidebarItem>
          ))}
        </div>
      )}
    </>
  )
}

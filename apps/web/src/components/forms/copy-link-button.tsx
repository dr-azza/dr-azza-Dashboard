import { Button } from '@/components/catalyst/button'
import { useLang } from '@/i18n'
import { CheckIcon, LinkIcon } from '@heroicons/react/16/solid'
import clsx from 'clsx'
import { useEffect, useState } from 'react'

/** Copies text, falling back to a hidden textarea where the Clipboard API is unavailable. */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.append(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

/**
 * "Copy link" with a short "Copied" confirmation. `compact` is the small outline version used in
 * lists; it sits above a table row's link overlay so clicking it copies instead of navigating.
 */
export function CopyLinkButton({
  url,
  compact = false,
  disabled = false,
  className,
}: {
  url: string
  compact?: boolean
  disabled?: boolean
  className?: string
}) {
  const { t } = useLang()
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const onClick = async (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (await copyText(url)) setCopied(true)
  }
  const label = copied ? t('forms.copied') : t('forms.copy')
  const icon = copied ? <CheckIcon /> : <LinkIcon />

  return compact ? (
    <Button
      outline
      disabled={disabled}
      onClick={onClick}
      aria-live="polite"
      className={clsx('relative z-10 shrink-0 whitespace-nowrap', className)}
    >
      {icon}
      {label}
    </Button>
  ) : (
    <Button
      color="brand"
      disabled={disabled}
      onClick={onClick}
      aria-live="polite"
      className={clsx('shrink-0 whitespace-nowrap', className)}
    >
      {icon}
      {label}
    </Button>
  )
}

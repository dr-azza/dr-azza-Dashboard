import clsx from 'clsx'
import DOMPurify from 'dompurify'
import { useMemo } from 'react'

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'u',
  's',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'blockquote',
  'hr',
  'a',
  'code',
]

/**
 * Renders stored rich text. The API already sanitizes it with the same allow-list; this second
 * pass means a bad row (or a future API bug) still can't run script in the dashboard.
 */
/**
 * Each top-level block (paragraph, heading, list, quote) takes its direction from its own text,
 * so an Arabic paragraph reads right-to-left inside an English entry and vice versa. Lists take
 * one direction for the whole list, so numbers and bullets stay on the same side as the text.
 */
function withBlockDirection(html: string) {
  const template = document.createElement('template')
  template.innerHTML = html
  for (const el of template.content.children) el.setAttribute('dir', 'auto')
  return template.innerHTML
}

export function RichText({ html, className }: { html: string; className?: string }) {
  const clean = useMemo(
    () =>
      withBlockDirection(
        DOMPurify.sanitize(html, {
          ALLOWED_TAGS,
          ALLOWED_ATTR: ['href', 'rel', 'target'],
          ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:)/i,
        }),
      ),
    [html],
  )
  return <div className={clsx('rich-text', className)} dangerouslySetInnerHTML={{ __html: clean }} />
}

import sanitizeHtml from 'sanitize-html'

/**
 * The only markup a history entry may contain: what the editor produces, nothing else.
 * No attributes except link targets, no styles, no images, no scripts — so stored HTML is
 * safe to render as-is in any client.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'br', 'strong', 'em', 'u', 's', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'hr', 'a', 'code'],
  // rel/target are always overwritten by the transform below; only href comes from the input.
  allowedAttributes: { a: ['href', 'rel', 'target'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowProtocolRelative: false,
  // Links always open safely in a new tab.
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }),
    b: 'strong',
    i: 'em',
    strike: 's',
    del: 's',
    h1: 'h2',
    h4: 'h3',
    h5: 'h3',
    h6: 'h3',
  },
  disallowedTagsMode: 'discard',
}

export function sanitizeRichText(html: string) {
  const clean = sanitizeHtml(html, OPTIONS).trim()
  // Plain text: block ends become line breaks, entities decoded, whitespace tidied.
  const text = sanitizeHtml(clean.replace(/<\/(p|h2|h3|li|blockquote)>|<br\s*\/?>/g, '$&\n'), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { html: text ? clean : '', text }
}

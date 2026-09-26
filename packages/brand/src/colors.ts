/**
 * AZZAH brand colours, from the brand guidelines (AzzahGuideBookx.pdf, pages 14–16).
 * Values were sampled from the artwork itself: the guide's printed hex for "Plum" (#2A9D8F)
 * is a typo, since that code is a teal.
 */
export const brandColors = {
  /** Logo plum, the primary accent. */
  plum: '#9B176A',
  /** Palette plum swatch (lighter, more violet). */
  plumSoft: '#8F3985',
  /** Primary dark. Text, dark surfaces, the Space Cadet logo variant. */
  spaceCadet: '#25283D',
  /** Heading colour used throughout the guide. */
  slate: '#264653',
} as const

/** Secondary palette: soft tints "to add differentiation to content". */
export const secondaryColors = {
  melon: '#FFB5A7',
  paleDogwood: '#FCD5CE',
  seashell: '#F8EDEB',
  champagnePink: '#F9DCC4',
  peach: '#FEC89A',
} as const

/** Sub-branding palette, reserved for sub-brands and shows. */
export const subBrandColors = {
  darkPurple: '#32213A',
  midnightGreen: '#07464C',
  mulberry: '#BE3E82',
  orchidPink: '#F2BAC9',
  cream: '#F2F6D0',
} as const

export const BRAND_NAME = 'AZZAH'
export const BRAND_TAGLINE = 'All about her'

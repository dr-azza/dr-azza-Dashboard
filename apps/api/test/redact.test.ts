import { describe, expect, it } from 'vitest'
import { redactTokens } from '../src/app'

describe('request log redaction', () => {
  it('masks one-time link tokens and leaves other paths alone', () => {
    expect(redactTokens('/api/v1/public/invites/abcDEF123_-x')).toBe('/api/v1/public/invites/[token]')
    expect(redactTokens('/api/v1/public/forms/Ces9WJJ5xMXx/responses?x=1')).toBe(
      '/api/v1/public/forms/[token]/responses?x=1',
    )
    expect(redactTokens('/api/v1/patients/123/forms')).toBe('/api/v1/patients/123/forms')
  })
})

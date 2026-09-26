import * as Headless from '@headlessui/react'
import React, { forwardRef } from 'react'
import { Link as RouterLink } from 'react-router'

// Internal paths go through React Router; anything else (http, mailto, tel, #hash) stays a plain anchor.
const EXTERNAL = /^(https?:|mailto:|tel:|#)/

export const Link = forwardRef(function Link(
  { href, ...props }: { href: string } & React.ComponentPropsWithoutRef<'a'>,
  ref: React.ForwardedRef<HTMLAnchorElement>
) {
  return (
    <Headless.DataInteractive>
      {EXTERNAL.test(href) ? <a href={href} {...props} ref={ref} /> : <RouterLink to={href} {...props} ref={ref} />}
    </Headless.DataInteractive>
  )
})

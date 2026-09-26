# AZZAH

A monorepo for the clinic's operations platform:

- **Phase 1:** a web dashboard for the doctor and staff. Patients answer forms through private links.
- **Next:** the API (Node + Postgres).
- **Later:** a patient mobile app.

## Run locally

The UI uses the [Catalyst UI Kit](https://catalyst.tailwindui.com), a paid Tailwind Plus product whose source can't be published, so it isn't in this repository. Before the first run:

1. Download Catalyst from your Tailwind Plus account and unzip it into `./catalyst-ui-kit` (this folder is git-ignored).
2. Run `pnpm setup:catalyst`. This copies the components into `apps/web/src/components/catalyst` (also git-ignored) and applies the AZZAH adaptations: right-to-left classes, brand colours and the router link.

```sh
pnpm install
pnpm setup:catalyst # once, and again after updating the kit
pnpm dev            # web dashboard at http://localhost:5173
pnpm build          # build everything (cached by Turborepo)
pnpm typecheck      # type-check every package
pnpm lint           # ESLint
pnpm format         # Prettier (sorts Tailwind classes too)
```

Requires Node 20.19+ (see `.nvmrc`) and pnpm 10.

## Structure

```
apps/
  web/              React 19 + Vite + Tailwind v4 dashboard (@azza/web)
  api/              (next) Node + Postgres API
  mobile/           (later) patient app
packages/
  shared/           Domain types, pregnancy maths and clinical flag rules (@azza/shared)
  i18n/             English and Arabic messages (@azza/i18n)
  brand/            AZZAH logo (vector paths + SVG files) and brand colours (@azza/brand)
  tsconfig/         Base TypeScript configs: base, react, node (@azza/tsconfig)
scripts/            setup-catalyst.mjs (builds the Catalyst copy from a licensed kit)
catalyst-ui-kit/    Your licensed Catalyst download (git-ignored)
```

Anything that the web app, the API and the mobile app must agree on lives in `packages/`. That includes what counts as high blood pressure, how gestational age is calculated, the translations and the data shapes. Apps never import from each other.

Internal packages are consumed as TypeScript source (`exports` points to `src/index.ts`), so there is no build step between packages and edits show up instantly in dev.

## Web app notes

- **UI:** Catalyst components live in `apps/web/src/components/catalyst`. They have been converted to logical CSS properties (`ps-`, `ms-`, `start-`…), so Arabic right-to-left works. Keep using logical classes. Clinic-specific components live in `components/app`.
- **Theme:** Light, Dark and System, saved per browser. It is applied before first paint by the inline script in `index.html`, which must stay in sync with `src/lib/theme.ts`. Brand colours come from the AZZAH guidelines: plum `#9B176A` (`brand-600`), Space Cadet `#25283D` (`zinc-900`, also the dark-mode surface) and the secondary palette (`melon`, `dogwood`, `seashell`, `champagne`, `peach`), all defined in `src/styles/tailwind.css`. Latin page headings use the `headline` utility (uppercase, 0.1em tracking), per the brand rules.
- **Performance:** every route is lazy-loaded, so the patient form (`/f/:token`) never downloads the staff dashboard. Fonts are self-hosted: IBM Plex Sans Arabic (free, OFL), which includes matching Latin, for both Arabic and English.
- **Logo:** use `AzzahSymbol`, `AzzahLockup` or `AzzahAppIcon` from `components/brand/logo`. They are drawn from the official `LogoFf.ai` artwork. Don't redraw, recolor outside the official variants, or add effects.
- **Data:** `src/data/mock.ts` stands in for the API until it exists.

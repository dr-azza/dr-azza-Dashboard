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
pnpm dev:api        # API at http://localhost:4100/api (docs at /api/docs), see "API" below
pnpm build          # build everything (cached by Turborepo)
pnpm typecheck      # type-check every package
pnpm test           # unit and API tests (Vitest)
pnpm lint           # ESLint
pnpm format         # Prettier (sorts Tailwind classes too)
```

Requires Node 20.19+ (see `.nvmrc`) and pnpm 10.

## Structure

```
apps/
  web/              React 19 + Vite + Tailwind v4 dashboard (@azza/web)
  api/              NestJS 11 (Fastify) + Prisma 7 + PostgreSQL API (@azza/api)
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

Internal packages are built with tsdown to ESM + CJS in `dist/` for Node (the API). The web app, the type checker and the tests read the TypeScript source directly through the custom `source` export condition, so edits show up instantly without rebuilding. Relative imports inside packages use `.js` extensions, as Node's ESM rules require.

## API

Stack: NestJS 11 on Fastify, Prisma 7 with the `pg` driver adapter, PostgreSQL 17 and Zod validation (`nestjs-zod`).

```sh
cp apps/api/.env.example apps/api/.env
pnpm db:up                                   # Postgres 17 in Docker on localhost:5440
pnpm --filter @azza/api db:migrate           # apply migrations
pnpm --filter @azza/api db:seed              # sample clinic, staff and patients (fictional)
pnpm dev:api
```

- **Routes** are versioned under `/api/v1/…`. Health is at `/api/health`, and OpenAPI docs are at `/api/docs` (not served in production). The mobile app can generate its client from `/api/docs-json`.
- **Schema:** `apps/api/prisma/schema.prisma`. Every clinical record belongs to a clinic (multi-clinic ready), IDs are UUIDv7, patients are archived rather than deleted, form links store only a hash of their token, and there is an append-only `audit_logs` table.
- **Clinical rules** (blood-pressure limits, red-flag symptoms, pregnancy dating) come from `@azza/shared`, so the API, the web form and the mobile app always agree. `POST /api/v1/checkins/evaluate` exposes them.
- **Environment** is validated at startup (`src/config/env.ts`). The API refuses to start with missing or invalid config.
- **Security:** Helmet headers, CORS limited to `CORS_ORIGINS`, rate limiting (300 requests per minute per IP) and a 1 MB body limit.
- **Not yet built:** staff authentication and role-based access. Until it exists, no endpoint returns patient data.

## Web app notes

- **UI:** Catalyst components live in `apps/web/src/components/catalyst`. They have been converted to logical CSS properties (`ps-`, `ms-`, `start-`…), so Arabic right-to-left works. Keep using logical classes. Clinic-specific components live in `components/app`.
- **Theme:** Light, Dark and System, saved per browser. It is applied before first paint by the inline script in `index.html`, which must stay in sync with `src/lib/theme.ts`. Brand colours come from the AZZAH guidelines: plum `#9B176A` (`brand-600`), Space Cadet `#25283D` (`zinc-900`, also the dark-mode surface) and the secondary palette (`melon`, `dogwood`, `seashell`, `champagne`, `peach`), all defined in `src/styles/tailwind.css`. Latin page headings use the `headline` utility (uppercase, 0.1em tracking), per the brand rules.
- **Performance:** every route is lazy-loaded, so the patient form (`/f/:token`) never downloads the staff dashboard. Fonts are self-hosted: IBM Plex Sans Arabic (free, OFL), which includes matching Latin, for both Arabic and English.
- **Logo:** use `AzzahSymbol`, `AzzahLockup` or `AzzahAppIcon` from `components/brand/logo`. They are drawn from the official `LogoFf.ai` artwork. Don't redraw, recolor outside the official variants, or add effects.
- **Data:** `src/data/mock.ts` stands in for the API until it exists.

## Contributing

- **Branches:** `main` is always deployable and protected. Work on a short-lived branch named `feat/…`, `fix/…` or `chore/…`, then open a pull request.
- **Commits:** use [Conventional Commits](https://www.conventionalcommits.org), for example `feat(web): add visit form` or `fix(shared): correct EDD rounding`. Scopes are `web`, `api`, `mobile`, `shared`, `i18n`, `brand` and `repo`.
- **Pull requests:** CI must pass (lint, formatting, type-check and build for everything except the web app, which needs the licensed Catalyst kit). Run the web checks locally, fill in the PR template, and squash-merge.
- **Dependencies:** Dependabot opens one grouped pull request per week for minor and patch updates.
- **Patient data:** never commit real patient data, exports or credentials. Use the sample data only.

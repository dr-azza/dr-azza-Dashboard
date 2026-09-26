## What & why

<!-- One or two sentences: what changes and the reason. Link the issue if there is one. -->

## How to test

<!-- Steps a reviewer can follow, including the page or endpoint to open. -->

## Checklist

- [ ] `pnpm lint`, `pnpm typecheck` and `pnpm build` pass locally (CI can't build the web app without Catalyst)
- [ ] Works in **Arabic (RTL)** and **English**, and in **light and dark** mode (UI changes)
- [ ] No real patient data, secrets or `.env` values in code, fixtures or screenshots
- [ ] Clinical rules changed only in `@azza/shared`, with the reason explained above

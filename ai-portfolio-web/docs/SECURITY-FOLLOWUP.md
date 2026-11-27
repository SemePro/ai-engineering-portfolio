# Follow-up: Next.js 15.x security upgrade (separate PR)

## Current state (interim mitigation, not the destination)

- `next@14.2.35` — latest 14.x patch; replaced 14.1.0, which `npm audit` flagged critical.
- `images: { unoptimized: true }` in `next.config.js` — removes the `/_next/image` Image
  Optimization API and the advisories that target it. The site's only raster image is a small logo.

## Still open on 14.2.35 (`npm audit --omit=dev`)

Advisories fixed only in `next >= 15.5.24`, including React Server Components denial-of-service
issues that apply to any App Router site. Others target features this site does not use (Server
Actions, rewrites, middleware, i18n Pages Router, WebSocket upgrades, custom server, Windows hosting).
The bundled `postcss` / `nanoid` findings resolve with the same upgrade.

## Follow-up PR scope

1. Upgrade to the current patched `next@15.5.x` and `react` / `react-dom@19`, `eslint-config-next` to match.
2. Migrate request APIs that became async in 15 (`searchParams` in
   `src/app/projects/incident-agent/trace/page.tsx`, any `headers()` / `cookies()` use).
3. Re-evaluate `images.unoptimized` (keep it unless images are added).
4. Full QA: lint, typecheck, build, Playwright desktop + mobile, Cypress, axe, `npm audit --omit=dev` clean.
5. Verify on a Vercel preview before merging.

Kept out of the agent-portfolio branch deliberately: it is a framework migration with its own risk,
and mixing it with the benchmark-backed content change would make either harder to review or revert.

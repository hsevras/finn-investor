# Deployment and repository handoff

## Local / evaluator fallback

Use the README quickstart. This path needs no cloud or model account. The real dated caches make the demo usable even if an external data provider denies a request. For phone testing on your own LAN, run `pnpm dev -- --hostname 0.0.0.0` (or use the host flag printed by the current Vinext help), then open the computer’s LAN URL on your phone. Do not expose an unauthenticated development server to the public internet.

## Hosted prototype

The delivered private prototype is a full-stack Worker with D1, not a static mockup. It starts from dated real data and attempts live refreshes. Its owner-private access is intentional; evaluators need an explicitly shared/public deployment or a separate local run. A successful hosted deployment does not prove third-party source availability from every runtime/IP.

## Standalone Cloudflare deployment

Cloudflare account access is required. Check the current Worker bundle/CPU and D1 allowances for your plan; do not assume this framework/PDF bundle fits the smallest free plan.

1. Install dependencies, run tests, and build:

   ```bash
   pnpm install --frozen-lockfile
   pnpm test
   pnpm typecheck
   pnpm build
   pnpm test:api
   pnpm exec wrangler login
   pnpm exec wrangler d1 create finn-investor
   ```

2. Put the returned database UUID in `FINN_D1_DATABASE_ID` for your shell. In Bash:

   ```bash
   export FINN_D1_DATABASE_ID=YOUR_RETURNED_DATABASE_UUID
   node scripts/standalone-config.mjs
   ```

   In PowerShell use `$env:FINN_D1_DATABASE_ID = 'YOUR_RETURNED_DATABASE_UUID'` before the same Node command. No API key belongs in this variable.

3. Apply schema and deploy the built Worker:

   ```bash
   pnpm exec wrangler d1 migrations apply DB --remote --config .wrangler/finn-deploy.json
   pnpm exec wrangler deploy --config .wrangler/finn-deploy.json
   ```

4. Optional synthesis:

   ```bash
   pnpm exec wrangler secret put GROQ_API_KEY --config .wrangler/finn-deploy.json
   ```

5. Open the returned URL on desktop and mobile. Verify persistence, rules, source status and at least one live document from outside the demo portfolio. Test actual source access from this deployment before giving the URL to evaluators.

The generated config includes weekday `*/15 3-13 * * 1-5` cron triggers (UTC). `worker/index.ts` implements `scheduled`; it collects real sources and populates owner inboxes without an open tab. This is a deployment instruction, **not a claim that the private prototype already has an active cloud schedule**. No OS/browser push subscription, SMS or email service is configured. Cron currently handles at most 100 owners / 50 distinct symbols per invocation; larger workloads need a queue and job leases.

A fresh authenticated settings read registers that workspace for future scheduled checks. In public standalone mode, opaque device cookies provide local demo scoping. Before real public use, add a trusted authentication boundary and strip client-supplied `oai-authenticated-user-*` headers. Also add proper abuse/rate controls, background extraction jobs and data retention.

Rebuilding changes the generated artifact, so regenerate `.wrangler/finn-deploy.json` after subsequent builds. The root `wrangler.local.jsonc` has only a local placeholder DB and must not be used for production deployment.

## GitHub submission repository

The complete source is published at [hsevras/finn-investor](https://github.com/hsevras/finn-investor), in the public repository created by the user. The hosted prototype retains its separate, private audience.

For a fresh local copy:

```bash
git clone https://github.com/hsevras/finn-investor.git
cd finn-investor
corepack enable
pnpm install --frozen-lockfile
pnpm db:local
pnpm dev
```

Follow the README for validation before pushing future changes. Preserve any separate hosting source remote in an existing checkout. Never include `.dev.vars`, `.env`, `.wrangler`, `.sites-runtime` or `node_modules`. The portable ZIP excludes local runtime state, installed dependencies, generated builds and credentials.

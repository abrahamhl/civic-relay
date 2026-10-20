# Civic Relay — Next.js investor microsite

Independent, statically rendered **Next.js App Router** investor microsite. This is not the crisis-messaging engine. The working simulator stays in `apps/web` (Vite) and `packages/core`.

## Run
```bash
cd investor-next
npm install
npm run type-check
npm run build
```
Output goes to `out/` due to `output: 'export'`. Deploy `investor-next` as its own Vercel project (Root Directory: `investor-next`), or publish static `out` on another host. The existing root `vercel.json` continues to deploy the Vite product demo. Never change that deployment's root to this microsite by mistake.

No environment secrets, third-party trackers, server API routes or live telemetry. All external actions are links to the open-source repo, EU public Funding & Tenders portal and the *simulated* Vite demonstration.

Note: the repo's core workspace lockfile does not cover this independent investor site. A future lockfile should be generated and committed once npm install is available. A dedicated PR build job verifies package installation/Next compilation; do not claim a locally reproducible build until its own lockfile exists.

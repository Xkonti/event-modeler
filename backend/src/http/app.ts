import express, { Router, type Application } from 'express';
import { toNodeHandler } from 'better-auth/node';
import type { WebApiSetup } from '@event-driven-io/emmett-expressjs';
import type { Auth } from '../auth/auth.ts';
import type { AppEventStore } from '../eventStore.ts';
import { businessFactApi } from '../domain/businessFact/api.ts';
import { sliceApi } from '../domain/slice/api.ts';
import { commandApi } from '../domain/command/api.ts';
import { relationApi } from '../domain/relation/api.ts';

export type BuildAuthAppDeps = {
  auth: Auth;
  eventStore: AppEventStore;
};

/**
 * SINGLE source of HTTP assembly. Both `index.ts` (prod) and the integration
 * harness import THIS — the middleware ordering is exercised once, never
 * duplicated.
 *
 * Ordering is load-bearing:
 *  1. `GET /api/health` → cheap readiness probe (Playwright `webServer.url`), no
 *     auth, no body parsing.
 *  2. `app.all('/api/auth/*', toNodeHandler(auth))` — better-auth reads the RAW
 *     request body, so this catch-all MUST run BEFORE `express.json()`. Express
 *     matches it for `/api/auth/*` before json ever runs; everything else falls
 *     through. Express 4 wildcard is `'/api/auth/*'` (not `*splat`).
 *  3. `express.json()` — parses the body for the domain routers only.
 *  4. Domain `WebApiSetup` routers, applied to an Express `Router` and mounted
 *     under `/api` → final paths `/api/business-facts*`. WRITE routes are guarded
 *     by `requireAuth(auth)` inside the domain api; GET stays open (v1).
 *
 * We do NOT use emmett `getApplication` for the live server: it applies json
 * globally with no pre-json hook, which cannot be made auth-safe. We reuse only
 * the `WebApiSetup` router contract.
 */
export const buildAuthApp = ({
  auth,
  eventStore,
}: BuildAuthAppDeps): Application => {
  const app = express();

  // 1. Health probe — before auth, before json.
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  // 2. better-auth catch-all on RAW body — MUST precede express.json().
  app.all('/api/auth/*', toNodeHandler(auth));

  // 3. JSON body parsing for everything downstream (domain routers).
  app.use(express.json());

  // 4. Domain WebApiSetup routers, mounted under the `/api` namespace.
  const apis: WebApiSetup[] = [
    businessFactApi(eventStore, auth),
    sliceApi(eventStore, auth),
    commandApi(eventStore, auth),
    relationApi(eventStore, auth),
  ];
  const apiRouter = Router();
  for (const setup of apis) setup(apiRouter);
  app.use('/api', apiRouter);

  return app;
};

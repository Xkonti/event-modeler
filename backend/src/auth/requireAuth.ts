import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import type { Auth } from './auth.ts';

/**
 * The non-null payload `auth.api.getSession` resolves to: `{ session, user }`.
 * Derived from the live `Auth` type so it tracks any schema change automatically
 * (no hand-maintained User/Session shapes).
 */
type SessionPayload = NonNullable<
  Awaited<ReturnType<Auth['api']['getSession']>>
>;
export type AuthUser = SessionPayload['user'];
export type AuthSession = SessionPayload['session'];

// Augment Express' Request so guarded handlers can read `req.user`/`req.session`
// with full typing. Optional because unguarded (GET) routes never populate them.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      session?: AuthSession;
    }
  }
}

/**
 * Auth guard for WRITE routes (notes/auth-build-plan.md §4 stage B3, §1.3).
 *
 * Resolves the better-auth session from the request cookies. better-auth wants a
 * WHATWG `Headers`; `fromNodeHeaders` converts Node's `IncomingHttpHeaders`. No
 * session (missing / expired / forged cookie → adapter finds no row) ⇒ 401 and
 * the chain stops. Otherwise `req.user`/`req.session` are populated and the
 * request proceeds.
 *
 * v1 guards writes only; GET stays open (§7). Bound to the `auth` instance at
 * route-setup time so `buildAuthApp` can thread the same instance everywhere.
 */
export const requireAuth =
  (auth: Auth): RequestHandler =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });
      if (!session) {
        res.status(401).json({ ok: false, error: 'unauthorized' });
        return;
      }
      req.user = session.user;
      req.session = session.session;
      next();
    } catch (error) {
      // A getSession failure (e.g. transient DB error during the session lookup)
      // must NOT fall through as authenticated. Fail closed → 401.
      //
      // Log the real error server-side; return a GENERIC body. Echoing
      // `String(error)` to an unauthenticated caller leaks pg/better-auth
      // internals (SQL fragments, table/column names, connection target) — an
      // information-disclosure primitive harvestable with no credentials.
      console.error('[requireAuth] session lookup failed:', error);
      res.status(401).json({ ok: false, error: 'unauthorized' });
    }
  };

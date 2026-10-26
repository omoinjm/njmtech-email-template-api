import type { NextFunction, Request, Response } from 'express';

function extractAdminKey(req: Request): string | null {
  const headerKey = req.header('x-admin-key')?.trim();
  if (headerKey) return headerKey;

  const authorization = req.header('authorization')?.trim();
  if (!authorization) return null;

  const [scheme, token] = authorization.split(/\s+/, 2);
  if (scheme?.toLowerCase() === 'bearer' && token) {
    return token.trim();
  }

  return null;
}

export function isAdminEnabled(): boolean {
  if (process.env.NODE_ENV === 'test' && process.env.ADMIN_REQUIRED !== 'true') {
    return false;
  }
  if (process.env.ADMIN_ENABLED === 'false') return false;
  return Boolean(process.env.ADMIN_API_KEY?.trim());
}

export function createAdminAuthMiddleware() {
  const adminKey = process.env.ADMIN_API_KEY?.trim();
  const enabled = isAdminEnabled();

  return (req: Request, res: Response, next: NextFunction) => {
    if (!enabled) {
      return next();
    }

    const providedKey = extractAdminKey(req);
    if (!providedKey) {
      return res.status(401).json({ error: 'Missing admin key. Provide X-Admin-Key or Authorization: Bearer <key>.' });
    }

    if (providedKey !== adminKey) {
      return res.status(403).json({ error: 'Invalid admin key.' });
    }

    return next();
  };
}

export function createAdminPageGuard() {
  const enabled = isAdminEnabled();

  return (req: Request, res: Response, next: NextFunction) => {
    if (!enabled) {
      return res.status(404).render('pages/404', { title: '404 — Page Not Found' });
    }

    const providedKey = extractAdminKey(req) ?? (typeof req.query.key === 'string' ? req.query.key : null);
    if (!providedKey) {
      return res.status(401).type('html').send(getAdminLoginHtml());
    }

    if (providedKey !== process.env.ADMIN_API_KEY?.trim()) {
      return res.status(403).type('html').send(getAdminLoginHtml('Invalid admin key.'));
    }

    res.locals.adminKey = providedKey;
    return next();
  };
}

function getAdminLoginHtml(error?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Admin Sign In</title>
    <style>
      body { font-family: Inter, Arial, sans-serif; background: #f8fafc; display: grid; place-items: center; min-height: 100vh; margin: 0; }
      form { background: white; padding: 32px; border-radius: 16px; width: min(420px, calc(100vw - 32px)); box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08); }
      h1 { margin: 0 0 8px; font-size: 24px; color: #0f172a; }
      p { margin: 0 0 20px; color: #64748b; }
      label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #334155; }
      input { width: 100%; padding: 12px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 15px; box-sizing: border-box; }
      button { margin-top: 16px; width: 100%; padding: 12px 14px; border: 0; border-radius: 10px; background: #4f46e5; color: white; font-size: 15px; font-weight: 600; cursor: pointer; }
      .error { color: #dc2626; margin-bottom: 12px; font-size: 14px; }
    </style>
  </head>
  <body>
    <form method="get">
      <h1>Template Admin</h1>
      <p>Enter your admin key to manage uploaded templates.</p>
      ${error ? `<div class="error">${error}</div>` : ''}
      <label for="key">Admin key</label>
      <input id="key" name="key" type="password" required autofocus />
      <button type="submit">Continue</button>
    </form>
  </body>
</html>`;
}

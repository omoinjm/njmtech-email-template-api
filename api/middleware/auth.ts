import type { NextFunction, Request, Response } from 'express';
import type { AppConfig } from '../config/types';

export interface AuthenticatedRequest extends Request {
  authClientKey?: string;
}

interface ApiKeyEntry {
  clientKey: string;
  apiKey: string;
}

function parseApiKeys(appConfig: AppConfig): ApiKeyEntry[] {
  const entries: ApiKeyEntry[] = [];

  if (appConfig.deployment.tier === 'dedicated') {
    const apiKey = process.env.API_KEY?.trim();
    if (apiKey) {
      entries.push({ clientKey: appConfig.deployment.clientKey!, apiKey });
    }
    return entries;
  }

  const sharedApiKey = process.env.API_KEY?.trim();
  if (sharedApiKey) {
    for (const clientKey of Object.keys(appConfig.clients)) {
      entries.push({ clientKey, apiKey: sharedApiKey });
    }
  }

  const scopedKeysRaw = process.env.API_KEYS?.trim();
  if (scopedKeysRaw) {
    try {
      const scopedKeys = JSON.parse(scopedKeysRaw) as Record<string, string>;
      for (const [clientKey, apiKey] of Object.entries(scopedKeys)) {
        if (appConfig.clients[clientKey] && apiKey) {
          entries.push({ clientKey, apiKey });
        }
      }
    } catch {
      throw new Error('API_KEYS must be valid JSON mapping client keys to API keys');
    }
  }

  return entries;
}

function extractApiKey(req: Request): string | null {
  const headerKey = req.header('x-api-key')?.trim();
  if (headerKey) return headerKey;

  const authorization = req.header('authorization')?.trim();
  if (!authorization) return null;

  const [scheme, token] = authorization.split(/\s+/, 2);
  if (scheme?.toLowerCase() === 'bearer' && token) {
    return token.trim();
  }

  return null;
}

export function isAuthEnabled(appConfig: AppConfig): boolean {
  if (process.env.AUTH_REQUIRED === 'false') return false;
  if (process.env.NODE_ENV === 'test' && process.env.AUTH_REQUIRED !== 'true') return false;
  return parseApiKeys(appConfig).length > 0;
}

export function createAuthMiddleware(appConfig: AppConfig) {
  const apiKeys = parseApiKeys(appConfig);
  const authEnabled = isAuthEnabled(appConfig);

  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!authEnabled) {
      return next();
    }

    const providedKey = extractApiKey(req);
    if (!providedKey) {
      return res.status(401).json({ error: 'Missing API key. Provide X-API-Key or Authorization: Bearer <key>.' });
    }

    const matches = apiKeys.filter((entry) => entry.apiKey === providedKey);
    if (matches.length === 0) {
      return res.status(403).json({ error: 'Invalid API key.' });
    }

    if (appConfig.deployment.tier === 'dedicated') {
      req.authClientKey = appConfig.deployment.clientKey;
      return next();
    }

    const requestedClientRaw = req.body?.client ?? req.query.client;
    const requestedClient =
      requestedClientRaw === undefined || requestedClientRaw === null || requestedClientRaw === ''
        ? appConfig.defaultClientKey
        : String(requestedClientRaw).trim().toLowerCase();

    const scopedMatch = matches.find((entry) => entry.clientKey === requestedClient);
    if (!scopedMatch) {
      return res.status(403).json({ error: `API key is not authorized for client '${requestedClient}'.` });
    }

    req.authClientKey = scopedMatch.clientKey;
    return next();
  };
}

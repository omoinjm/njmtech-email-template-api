import rateLimit from 'express-rate-limit';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { NextFunction, Request, Response } from 'express';
import type { AppConfig } from '../config/types';
import type { AuthenticatedRequest } from './auth';

function extractApiKey(req: Request): string {
  const headerKey = req.header('x-api-key')?.trim();
  if (headerKey) return headerKey;

  const authorization = req.header('authorization')?.trim();
  if (authorization) {
    const [scheme, token] = authorization.split(/\s+/, 2);
    if (scheme?.toLowerCase() === 'bearer' && token) {
      return token.trim();
    }
  }

  return req.ip || 'anonymous';
}

function createUpstashLimiter(appConfig: AppConfig) {
  const redis = Redis.fromEnv();
  const { windowMs, max } = appConfig.deployment.rateLimit;
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
    prefix: `email-api:${appConfig.deployment.tier}`,
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    const identifier = extractApiKey(req);
    const result = await limiter.limit(identifier);

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));

    if (!result.success) {
      return res.status(429).json({ error: 'Too many requests, please try again later.' });
    }

    return next();
  };
}

function createMemoryLimiter(appConfig: AppConfig) {
  const { windowMs, max } = appConfig.deployment.rateLimit;

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const authReq = req as AuthenticatedRequest;
      return authReq.authClientKey || extractApiKey(req);
    },
    message: { error: 'Too many requests, please try again later.' },
  });
}

export function createRateLimitMiddleware(appConfig: AppConfig) {
  if (process.env.NODE_ENV === 'test') {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }

  const hasUpstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  if (hasUpstash) {
    return createUpstashLimiter(appConfig);
  }

  return createMemoryLimiter(appConfig);
}

import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import { loadAppConfig } from '../api/config/loadClients';
import { createAuthMiddleware } from '../api/middleware/auth';
import { registerTemplateRoute } from '../api/routes/template';

jest.setTimeout(20000);

function withEnv<T>(env: NodeJS.ProcessEnv, run: () => T): T {
  const keys = Object.keys(env);
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);

  try {
    return run();
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  }
}

function createAuthedApp(env: NodeJS.ProcessEnv) {
  return withEnv(env, () => {
    const appConfig = loadAppConfig();
    const app = express();
    app.use(bodyParser.json());
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../api/views'));
    app.use('/template', createAuthMiddleware(appConfig));
    registerTemplateRoute(app, appConfig);
    return app;
  });
}

describe('API key auth', () => {
  it('rejects /template without an API key when API_KEY is configured', async () => {
    const app = createAuthedApp({
      DEPLOYMENT_TIER: 'shared',
      ALLOWED_CLIENTS: 'default',
      API_KEY: 'shared-secret',
      AUTH_REQUIRED: 'true',
    });

    const res = await request(app)
      .post('/template')
      .send({ template_name: 'thank_you', first_name: 'John', last_name: 'Doe' });

    expect(res.status).toEqual(401);
  });

  it('accepts a scoped API key for the requested client', async () => {
    const app = createAuthedApp({
      DEPLOYMENT_TIER: 'shared',
      ALLOWED_CLIENTS: 'default,style-and-grace',
      API_KEYS: JSON.stringify({
        default: 'default-secret',
        'style-and-grace': 'sg-secret',
      }),
      AUTH_REQUIRED: 'true',
    });

    const res = await request(app)
      .post('/template')
      .set('X-API-Key', 'sg-secret')
      .send({
        client: 'style-and-grace',
        template_name: 'thank_you',
        first_name: 'John',
        last_name: 'Doe',
      });

    expect(res.status).toEqual(200);
  });

  it('rejects a scoped API key used for a different client', async () => {
    const app = createAuthedApp({
      DEPLOYMENT_TIER: 'shared',
      ALLOWED_CLIENTS: 'default,style-and-grace',
      API_KEYS: JSON.stringify({
        default: 'default-secret',
        'style-and-grace': 'sg-secret',
      }),
      AUTH_REQUIRED: 'true',
    });

    const res = await request(app)
      .post('/template')
      .set('X-API-Key', 'sg-secret')
      .send({ template_name: 'thank_you', first_name: 'John', last_name: 'Doe' });

    expect(res.status).toEqual(403);
  });
});

describe('Dedicated deployment profile', () => {
  it('defaults to the dedicated client when client is omitted', () => {
    withEnv(
      {
        DEPLOYMENT_TIER: 'dedicated',
        CLIENT_KEY: 'bookmark-sync-engine',
      },
      () => {
        const appConfig = loadAppConfig();
        expect(appConfig.deployment.tier).toEqual('dedicated');
        expect(appConfig.deployment.clientKey).toEqual('bookmark-sync-engine');
        expect(Object.keys(appConfig.clients)).toEqual(['bookmark-sync-engine']);

        const { resolveClientKey } = require('../api/config/loadClients');
        expect(resolveClientKey(undefined, appConfig).clientKey).toEqual('bookmark-sync-engine');
      },
    );
  });

  it('rejects requests for a different client on a dedicated deployment', () => {
    withEnv(
      {
        DEPLOYMENT_TIER: 'dedicated',
        CLIENT_KEY: 'bookmark-sync-engine',
      },
      () => {
        const appConfig = loadAppConfig();
        const { resolveClientKey } = require('../api/config/loadClients');
        const result = resolveClientKey('style-and-grace', appConfig);

        expect(result.status).toEqual(403);
        expect(result.error).toContain('bookmark-sync-engine');
      },
    );
  });
});

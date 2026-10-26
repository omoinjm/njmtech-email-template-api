process.env.NODE_ENV = 'test';
process.env.SMTP_HOST = 'smtp.test.local';

import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import { loadAppConfig } from '../api/config/loadClients';
import { registerTemplateRoute } from '../api/routes/template';
import { shouldSendEmail } from '../api/services/mailer';
import { registerPreviewRoutes } from '../api/routes/preview';

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

function createTemplateApp(env: NodeJS.ProcessEnv) {
  return withEnv(env, () => {
    const appConfig = loadAppConfig();
    const app = express();
    app.use(bodyParser.json());
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../api/views'));
    registerTemplateRoute(app, appConfig);
    return { app, appConfig };
  });
}

describe('EMAIL_MODE', () => {
  afterEach(() => {
    process.env.SMTP_HOST = 'smtp.test.local';
  });

  it('render mode never sends email even when SMTP is configured', () => {
    const appConfig = withEnv({ EMAIL_MODE: 'render' }, () => loadAppConfig());
    expect(shouldSendEmail(appConfig, 'user@example.com')).toBe(false);
  });

  it('auto mode sends when SMTP is configured and email is present', () => {
    const appConfig = withEnv({ EMAIL_MODE: 'auto', SMTP_HOST: 'smtp.test.local' }, () => loadAppConfig());
    expect(shouldSendEmail(appConfig, 'user@example.com')).toBe(true);
    expect(shouldSendEmail(appConfig, '')).toBe(false);
  });

  it('send mode requires SMTP configuration', () => {
    withEnv({ EMAIL_MODE: 'send', SMTP_HOST: '' }, () => {
      const appConfig = loadAppConfig();
      expect(() => shouldSendEmail(appConfig, 'user@example.com')).toThrow('EMAIL_MODE=send requires SMTP configuration');
    });
  });
});

describe('Preview route gating', () => {
  it('disables preview routes on dedicated deployments by default', async () => {
    const app = withEnv(
      {
        DEPLOYMENT_TIER: 'dedicated',
        CLIENT_KEY: 'bookmark-sync-engine',
        PREVIEW_ENABLED: 'false',
      },
      () => {
        const appConfig = loadAppConfig();
        const expressApp = express();
        registerPreviewRoutes(expressApp, appConfig);
        return expressApp;
      },
    );

    const res = await request(app).get('/preview/bookmark-sync-engine/thank_you');
    expect(res.status).toEqual(404);
    expect(res.body.error).toContain('disabled');
  });
});

describe('Dedicated template route', () => {
  it('renders without a client field when CLIENT_KEY is set', async () => {
    const { app } = createTemplateApp({
      DEPLOYMENT_TIER: 'dedicated',
      CLIENT_KEY: 'bookmark-sync-engine',
      EMAIL_MODE: 'render',
    });

    const res = await request(app)
      .post('/template')
      .send({
        template_name: 'thank_you',
        first_name: 'Jane',
        last_name: 'Smith',
      });

    expect(res.status).toEqual(200);
    expect(res.text).toContain('Bookmark Sync Engine');
  });
});

process.env.NODE_ENV = 'test';
process.env.SMTP_HOST = '';

import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import { loadAppConfig } from '../api/config/loadClients';
import { createAdminAuthMiddleware } from '../api/middleware/adminAuth';
import { registerAdminRoutes } from '../api/routes/admin';
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

function createAdminApp(env: NodeJS.ProcessEnv = {}) {
  return withEnv({ ...env, NODE_ENV: 'test', SMTP_HOST: '', ADMIN_REQUIRED: 'true' }, () => {
    const appConfig = loadAppConfig();
    const app = express();
    app.use(bodyParser.json({ limit: '2mb' }));
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, '../api/views'));
    app.use('/admin/api', createAdminAuthMiddleware());
    registerAdminRoutes(app, appConfig);
    registerTemplateRoute(app, appConfig);
    return app;
  });
}

describe('Template admin API', () => {
  it('uploads and renders a dynamic template for a client', async () => {
    const app = createAdminApp({ ADMIN_API_KEY: 'admin-secret' });

    const templateContent = '<html><body><p>Hello <%= displayName %></p></body></html>';

    await request(app)
      .put('/admin/api/templates/default/demo_upload')
      .set('X-Admin-Key', 'admin-secret')
      .send({ content: templateContent })
      .expect(200);

    const res = await request(app)
      .post('/template')
      .send({
        template_name: 'demo_upload',
        first_name: 'Dynamic',
        last_name: 'User',
      });

    expect(res.status).toEqual(200);
    expect(res.text).toContain('Hello Dynamic User');
  });

  it('deletes an uploaded template override', async () => {
    const app = createAdminApp({ ADMIN_API_KEY: 'admin-secret' });

    await request(app)
      .put('/admin/api/templates/default/demo_delete')
      .set('X-Admin-Key', 'admin-secret')
      .send({ content: '<html><body>Temp</body></html>' })
      .expect(200);

    await request(app)
      .delete('/admin/api/templates/default/demo_delete')
      .set('X-Admin-Key', 'admin-secret')
      .expect(200);

    const res = await request(app)
      .post('/template')
      .send({
        template_name: 'demo_delete',
        first_name: 'John',
        last_name: 'Doe',
      });

    expect(res.status).toEqual(404);
  });

  it('rejects admin routes without a key when admin auth is enabled', async () => {
    const app = createAdminApp({ ADMIN_API_KEY: 'admin-secret' });

    const res = await request(app).get('/admin/api/clients');
    expect(res.status).toEqual(401);
  });
});

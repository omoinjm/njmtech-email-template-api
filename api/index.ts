import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import dotenv from 'dotenv';
import { loadAppConfig } from './config/loadClients';
import { createAdminAuthMiddleware, createAdminPageGuard } from './middleware/adminAuth';
import { createAuthMiddleware } from './middleware/auth';
import { createRateLimitMiddleware } from './middleware/rateLimit';
import { registerAdminRoutes } from './routes/admin';
import { registerMetaRoutes } from './routes/meta';
import { registerPreviewRoutes } from './routes/preview';
import { registerTemplateRoute } from './routes/template';

dotenv.config();

const appConfig = loadAppConfig();
const api = express();

api.use(bodyParser.json({ limit: '2mb' }));
api.use(bodyParser.urlencoded({ extended: true, limit: '2mb' }));
api.set('view engine', 'ejs');
api.set('views', path.join(__dirname, 'views'));

registerMetaRoutes(api, appConfig);
registerPreviewRoutes(api, appConfig);

api.get('/admin', createAdminPageGuard(), (req: Request, res: Response) => {
  res.render('pages/admin', {
    title: 'Template Admin',
    adminKey: res.locals.adminKey,
  });
});

api.use('/admin/api', createAdminAuthMiddleware());
registerAdminRoutes(api, appConfig);

api.use('/template', createAuthMiddleware(appConfig));
api.use('/template', createRateLimitMiddleware(appConfig));
registerTemplateRoute(api, appConfig);

api.use((req: Request, res: Response) => {
  res.status(404).render('pages/404', { title: '404 — Page Not Found' });
});

api.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

export { api, appConfig };
export default api;

if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3001;
  api.listen(PORT, () => console.log(`Email Template API running on http://localhost:${PORT}`));
}

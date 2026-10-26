import type { Application, Request, Response } from 'express';
import type { AppConfig } from '../config/types';
import { buildOpenApiDocument, getDocsHtml } from '../services/openApi';
import { getPreviewCollections } from '../services/templateRenderer';

export function registerMetaRoutes(app: Application, appConfig: AppConfig) {
  app.get('/', async (req: Request, res: Response) => {
    res.render('pages/home', {
      title: 'Email Template API',
      isHome: true,
      previewCollections: await getPreviewCollections(appConfig),
      defaultClientKey: appConfig.defaultClientKey,
    });
  });

  app.get('/openapi.json', (_req: Request, res: Response) => {
    res.json(buildOpenApiDocument(appConfig));
  });

  app.get(['/docs', '/docs/'], (_req: Request, res: Response) => {
    res.type('html').send(getDocsHtml());
  });
}

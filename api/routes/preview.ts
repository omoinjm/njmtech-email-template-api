import type { Application, Request, Response } from 'express';
import type { AppConfig } from '../config/types';
import { resolveClientKey, resolveTemplateName } from '../config/loadClients';
import { getPreviewLocals, hasTemplate, renderTemplate } from '../services/templateRenderer';

async function renderPreviewResponse(
  app: Application,
  res: Response,
  appConfig: AppConfig,
  clientKey: string,
  templateName: string,
) {
  const exists = await hasTemplate(appConfig, clientKey, templateName);
  if (!exists) {
    return res.status(404).json({ error: `Template '${templateName}' not found for client '${clientKey}'` });
  }

  const fixtures = getPreviewLocals(appConfig, clientKey, templateName) ?? {
    ...appConfig.clients[clientKey].defaultLocals,
    displayName: 'Preview User',
    firstName: 'Preview',
    lastName: 'User',
  };

  try {
    const html = await renderTemplate(app, appConfig, clientKey, templateName, {
      title: 'Preview',
      isHome: false,
      client: clientKey,
      templateName,
      ...fixtures,
    });
    return res.status(200).send(html);
  } catch {
    return res.status(404).json({ error: `Template '${templateName}' not found for client '${clientKey}'` });
  }
}

export function registerPreviewRoutes(app: Application, appConfig: AppConfig) {
  if (!appConfig.deployment.previewEnabled) {
    app.get(['/preview/:template', '/preview/:client/:template'], (_req: Request, res: Response) => {
      res.status(404).json({ error: 'Preview routes are disabled for this deployment.' });
    });
    return;
  }

  app.get('/preview/:template', async (req: Request, res: Response) => {
    const { clientKey, error: clientError, status: clientStatus } = resolveClientKey(req.query.client, appConfig);
    if (clientError) {
      return res.status(clientStatus ?? 400).json({ error: clientError });
    }

    const { templateName, error: templateError } = resolveTemplateName(req.params.template);
    if (templateError) {
      return res.status(400).json({ error: templateError });
    }

    return renderPreviewResponse(app, res, appConfig, clientKey!, templateName!);
  });

  app.get('/preview/:client/:template', async (req: Request, res: Response) => {
    const { clientKey, error: clientError, status: clientStatus } = resolveClientKey(req.params.client, appConfig);
    if (clientError) {
      return res.status(clientStatus ?? 400).json({ error: clientError });
    }

    const { templateName, error: templateError } = resolveTemplateName(req.params.template);
    if (templateError) {
      return res.status(400).json({ error: templateError });
    }

    return renderPreviewResponse(app, res, appConfig, clientKey!, templateName!);
  });
}

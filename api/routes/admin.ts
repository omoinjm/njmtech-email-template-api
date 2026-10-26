import type { Application, Request, Response } from 'express';
import type { AppConfig } from '../config/types';
import { normalizeIdentifier, resolveClientKey, resolveTemplateName } from '../config/loadClients';
import { listAllTemplates, templateStore } from '../services/templateRenderer';

function parseTemplateBody(
  req: Request,
  appConfig: AppConfig,
): { clientKey?: string; templateName?: string; content?: string; error?: string; status?: number } {
  const clientInput = req.body.client ?? req.params.client;
  const templateInput = req.body.template_name ?? req.body.templateName ?? req.params.template;

  const { clientKey, error: clientError, status: clientStatus } = resolveClientKey(clientInput, appConfig);
  if (clientError) {
    return { error: clientError, status: clientStatus ?? 400 };
  }

  const { templateName, error: templateError } = resolveTemplateName(templateInput);
  if (templateError) {
    return { error: templateError, status: 400 };
  }

  const content = typeof req.body.content === 'string' ? req.body.content : undefined;
  return { clientKey, templateName, content };
}

export function registerAdminRoutes(app: Application, appConfig: AppConfig) {
  app.get('/admin/api/clients', async (_req: Request, res: Response) => {
    const clients = await listAllTemplates(appConfig);
    res.json({ clients });
  });

  app.get('/admin/api/templates', async (req: Request, res: Response) => {
    const clientFilter = typeof req.query.client === 'string' ? normalizeIdentifier(req.query.client) : null;
    if (req.query.client && !clientFilter) {
      return res.status(400).json({ error: 'Invalid client filter.' });
    }

    const templates = await templateStore.list(clientFilter ?? undefined);
    res.json({ templates });
  });

  app.get('/admin/api/templates/:client/:template', async (req: Request, res: Response) => {
    const { clientKey, templateName, error, status } = parseTemplateBody(req, appConfig);
    if (error) {
      return res.status(status ?? 400).json({ error });
    }

    const content = await templateStore.get(clientKey!, templateName!);
    if (!content) {
      return res.status(404).json({ error: 'Uploaded template not found.' });
    }

    res.json({ client: clientKey, template_name: templateName, content });
  });

  app.put('/admin/api/templates/:client/:template', async (req: Request, res: Response) => {
    const { clientKey, templateName, content, error, status } = parseTemplateBody(req, appConfig);
    if (error) {
      return res.status(status ?? 400).json({ error });
    }

    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Template content is required.' });
    }

    const saved = await templateStore.put(clientKey!, templateName!, content);
    res.status(200).json({ message: 'Template saved.', template: saved });
  });

  app.post('/admin/api/templates', async (req: Request, res: Response) => {
    const { clientKey, templateName, content, error, status } = parseTemplateBody(req, appConfig);
    if (error) {
      return res.status(status ?? 400).json({ error });
    }

    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Template content is required.' });
    }

    const existing = await templateStore.get(clientKey!, templateName!);
    if (existing) {
      return res.status(409).json({ error: 'Template already exists. Use PUT to overwrite.' });
    }

    const saved = await templateStore.put(clientKey!, templateName!, content);
    res.status(201).json({ message: 'Template uploaded.', template: saved });
  });

  app.delete('/admin/api/templates/:client/:template', async (req: Request, res: Response) => {
    const { clientKey, templateName, error, status } = parseTemplateBody(req, appConfig);
    if (error) {
      return res.status(status ?? 400).json({ error });
    }

    const deleted = await templateStore.delete(clientKey!, templateName!);
    if (!deleted) {
      return res.status(404).json({ error: 'Uploaded template not found.' });
    }

    res.json({ message: 'Template deleted.' });
  });

  app.post('/admin/api/upload', async (req: Request, res: Response) => {
    const clientInput = req.body.client;
    const templateInput = req.body.template_name ?? req.body.templateName;
    const content = typeof req.body.content === 'string' ? req.body.content : '';

    const { clientKey, error: clientError, status: clientStatus } = resolveClientKey(clientInput, appConfig);
    if (clientError) {
      return res.status(clientStatus ?? 400).json({ error: clientError });
    }

    const { templateName, error: templateError } = resolveTemplateName(templateInput);
    if (templateError) {
      return res.status(400).json({ error: templateError });
    }

    if (!content.trim()) {
      return res.status(400).json({ error: 'Template file content is required.' });
    }

    const saved = await templateStore.put(clientKey!, templateName!, content);
    res.status(201).json({ message: 'Template uploaded.', template: saved });
  });
}

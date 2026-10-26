import type { Application, NextFunction, Request, Response } from 'express';
import type { AppConfig } from '../config/types';
import { resolveClientKey, resolveTemplateName } from '../config/loadClients';
import { getFromName, sendEmail, shouldSendEmail } from '../services/mailer';
import { hasTemplate, renderTemplate } from '../services/templateRenderer';

export function registerTemplateRoute(app: Application, appConfig: AppConfig) {
  app.post('/template', async (req: Request, res: Response, next: NextFunction) => {
    const { client, template_name, first_name, last_name, email, site_url, siteUrl, ...extraVars } = req.body;
    const missingParams: string[] = [];

    if (!template_name) missingParams.push('template_name');
    if (!first_name) missingParams.push('first_name');
    if (!last_name) missingParams.push('last_name');

    if (missingParams.length > 0) {
      return res.status(400).json({ error: 'Missing required parameters', missingParams });
    }

    const { clientKey, error: clientError, status: clientStatus } = resolveClientKey(client, appConfig);
    if (clientError) {
      return res.status(clientStatus ?? 400).json({ error: clientError });
    }

    const { templateName, error: templateError } = resolveTemplateName(template_name);
    if (templateError) {
      return res.status(400).json({ error: templateError });
    }

    const exists = await hasTemplate(appConfig, clientKey!, templateName!);
    if (!exists) {
      return res.status(404).json({ error: `Template '${templateName}' not found for client '${clientKey}'` });
    }

    const displayName = `${first_name} ${last_name}`;
    const clientDefaults = appConfig.clients[clientKey!].defaultLocals;

    let html: string;
    try {
      html = await renderTemplate(app, appConfig, clientKey!, templateName!, {
        title: 'Template',
        isHome: false,
        client: clientKey,
        templateName,
        displayName,
        firstName: first_name,
        lastName: last_name,
        email,
        ...clientDefaults,
        siteUrl: site_url ?? siteUrl ?? clientDefaults.siteUrl,
        ...extraVars,
      });
    } catch {
      return res.status(404).json({ error: `Template '${templateName}' not found for client '${clientKey}'` });
    }

    try {
      if (shouldSendEmail(appConfig, email)) {
        await sendEmail({
          to: email,
          subject: `Thank you, ${displayName}!`,
          html,
          fromName: getFromName(appConfig.clients[clientKey!]),
        });
      }
    } catch (err) {
      return next(err);
    }

    res.status(200).send(html);
  });
}


import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

const api = express();
const DEFAULT_CLIENT_KEY = 'default';
const IDENTIFIER_PATTERN = /^[a-z0-9_-]+$/;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many requests, please try again later.' },
});

api.use(bodyParser.json());
api.use(bodyParser.urlencoded({ extended: true }));
api.set('view engine', 'ejs');
api.set('views', path.join(__dirname, 'views'));

const PREVIEW_FIXTURES: Record<string, Record<string, unknown>> = {
  contact_notification: {
    displayName: 'Jane Smith',
    email: 'jane@example.com',
    subject: 'Hello from the website',
    message: "Hi there! I've been following your work and would love to collaborate on a future project. Your portfolio really stands out — impressive stuff!",
  },
  contact_confirmation: {
    displayName: 'Jane Smith',
    message: "Hi there! I've been following your work and would love to collaborate on a future project. Your portfolio really stands out — impressive stuff!",
    siteUrl: 'https://njmtech.co.za',
  },
  subscribe_welcome: {
    firstName: 'Jane',
    siteUrl: 'https://njmtech.co.za',
    unsubscribeUrl: '#',
  },
  thank_you: {
    displayName: 'Jane Smith',
    contactEmail: process.env.CONTACT_EMAIL || 'hello@njmtech.co.za',
    siteUrl: 'https://njmtech.co.za',
    orderNumber: 'SG-1042',
    orderDate: '18 May 2026',
    paymentStatus: 'Paid',
    shippingMethod: 'Courier Guy - Standard',
    estimatedDelivery: '21-23 May 2026',
    subtotal: 'R1,150.00',
    shipping: 'R99.00',
    discount: 'R0.00',
    tax: 'Included',
    total: 'R1,249.00',
    shippingAddress: '12 Palm Avenue\nSandton\nJohannesburg',
    billingAddress: '12 Palm Avenue\nSandton\nJohannesburg',
    orderItems: [
      {
        name: 'Satin Wrap Dress',
        variant: 'Color: Burgundy / Size: M',
        quantity: 1,
        subtotal: 'R899.00',
      },
      {
        name: 'Classic Heel Sandals',
        variant: 'Color: Nude / Size: 6',
        quantity: 1,
        subtotal: 'R350.00',
      },
    ],
  },
};

const TEMPLATE_NAMES = Object.keys(PREVIEW_FIXTURES);

const TEMPLATE_CLIENTS: Record<
  string,
  {
    label: string;
    viewRoot: string;
    templates: string[];
    defaultLocals: Record<string, string>;
    previewOverrides?: Record<string, Record<string, unknown>>;
  }
> = {
  [DEFAULT_CLIENT_KEY]: {
    label: 'NJMTech',
    viewRoot: 'pages',
    templates: TEMPLATE_NAMES,
    defaultLocals: {
      senderName: process.env.SENDER_NAME || 'NJMTech',
      contactEmail: process.env.CONTACT_EMAIL || '',
      siteUrl: 'https://njmtech.co.za',
      fromName: process.env.FROM_NAME || 'NJMTech',
    },
  },
  'style-and-grace': {
    label: 'Style & Grace',
    viewRoot: 'pages/clients/style-and-grace',
    templates: TEMPLATE_NAMES,
    defaultLocals: {
      senderName: 'Style & Grace',
      contactEmail: process.env.CONTACT_EMAIL || '',
      siteUrl: '#',
      fromName: 'Style & Grace',
    },
    previewOverrides: {
      contact_confirmation: { siteUrl: '#' },
      subscribe_welcome: { siteUrl: '#' },
      thank_you: { siteUrl: '#', orderNumber: 'SG-1042' },
    },
  },
};

function normalizeIdentifier(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  return IDENTIFIER_PATTERN.test(normalized) ? normalized : null;
}

function resolveClientKey(value: unknown): { clientKey?: string; error?: string } {
  if (value === undefined || value === null || value === '') {
    return { clientKey: DEFAULT_CLIENT_KEY };
  }

  const clientKey = normalizeIdentifier(value);
  if (!clientKey) {
    return { error: 'Invalid client. Use lowercase letters, numbers, hyphens, or underscores.' };
  }

  if (!TEMPLATE_CLIENTS[clientKey]) {
    return { error: `Unknown client '${String(value)}'.` };
  }

  return { clientKey };
}

function resolveTemplateName(value: unknown): { templateName?: string; error?: string } {
  const templateName = normalizeIdentifier(value);
  if (!templateName) {
    return { error: 'Invalid template_name. Use lowercase letters, numbers, hyphens, or underscores.' };
  }

  return { templateName };
}

function resolveTemplateView(clientKey: string, templateName: string): string | null {
  const clientConfig = TEMPLATE_CLIENTS[clientKey];
  if (!clientConfig || !clientConfig.templates.includes(templateName)) {
    return null;
  }

  return `${clientConfig.viewRoot}/${templateName}`;
}

function getPreviewLocals(clientKey: string, templateName: string): Record<string, unknown> | null {
  const fixtures = PREVIEW_FIXTURES[templateName];
  if (!fixtures) return null;

  const clientConfig = TEMPLATE_CLIENTS[clientKey];
  return {
    ...clientConfig.defaultLocals,
    ...fixtures,
    ...(clientConfig.previewOverrides?.[templateName] || {}),
  };
}

function renderView(view: string, locals: Record<string, unknown>): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    api.render(view, locals, (err: Error | null, html: string) => {
      if (err) reject(err);
      else resolve(html);
    });
  });
}

function formatTemplateLabel(templateName: string): string {
  return templateName
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getPreviewCollections() {
  return Object.entries(TEMPLATE_CLIENTS).map(([clientKey, clientConfig]) => ({
    key: clientKey,
    label: clientConfig.label,
    templates: clientConfig.templates.map((templateName) => ({
      name: templateName,
      label: formatTemplateLabel(templateName),
    })),
  }));
}

async function renderPreviewResponse(res: Response, clientKey: string, templateName: string) {
  const fixtures = getPreviewLocals(clientKey, templateName);
  if (!fixtures) {
    return res.status(404).json({ error: `No preview fixture for '${templateName}'` });
  }

  const view = resolveTemplateView(clientKey, templateName);
  if (!view) {
    return res.status(404).json({ error: `Template '${templateName}' not found for client '${clientKey}'` });
  }

  try {
    const html = await renderView(view, { title: 'Preview', isHome: false, client: clientKey, templateName, ...fixtures });
    return res.status(200).send(html);
  } catch {
    return res.status(404).json({ error: `Template '${templateName}' not found for client '${clientKey}'` });
  }
}

function buildOpenApiDocument() {
  const clients = Object.keys(TEMPLATE_CLIENTS);

  return {
    openapi: '3.1.0',
    info: {
      title: 'Email Template API',
      version: '1.1.0',
      description:
        'Render and optionally send HTML email templates. Templates are resolved from the default NJMTech set unless a client value is supplied.',
    },
    servers: [{ url: '/' }],
    tags: [
      { name: 'meta', description: 'Service metadata and documentation routes.' },
      { name: 'templates', description: 'Template rendering and preview routes.' },
    ],
    paths: {
      '/': {
        get: {
          tags: ['meta'],
          summary: 'Render the landing page',
          responses: {
            '200': {
              description: 'HTML landing page',
              content: {
                'text/html': {
                  schema: { type: 'string' },
                },
              },
            },
          },
        },
      },
      '/docs': {
        get: {
          tags: ['meta'],
          summary: 'Render the API documentation UI',
          responses: {
            '200': {
              description: 'Swagger UI page',
              content: {
                'text/html': {
                  schema: { type: 'string' },
                },
              },
            },
          },
        },
      },
      '/openapi.json': {
        get: {
          tags: ['meta'],
          summary: 'Return the OpenAPI document',
          responses: {
            '200': {
              description: 'OpenAPI JSON',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                  },
                },
              },
            },
          },
        },
      },
      '/preview/{template}': {
        get: {
          tags: ['templates'],
          summary: 'Preview a default template with fixture data',
          parameters: [
            {
              name: 'template',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                enum: TEMPLATE_NAMES,
              },
            },
            {
              name: 'client',
              in: 'query',
              required: false,
              schema: {
                type: 'string',
                enum: clients,
                default: DEFAULT_CLIENT_KEY,
              },
              description: 'Optional client namespace. Omit it to use the NJMTech default templates.',
            },
          ],
          responses: {
            '200': {
              description: 'Rendered preview HTML',
              content: {
                'text/html': {
                  schema: { type: 'string' },
                },
              },
            },
            '400': {
              description: 'Invalid client or template format',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            '404': {
              description: 'Preview fixture or template not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/preview/{client}/{template}': {
        get: {
          tags: ['templates'],
          summary: 'Preview a template from a specific client namespace',
          parameters: [
            {
              name: 'client',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                enum: clients,
              },
            },
            {
              name: 'template',
              in: 'path',
              required: true,
              schema: {
                type: 'string',
                enum: TEMPLATE_NAMES,
              },
            },
          ],
          responses: {
            '200': {
              description: 'Rendered preview HTML',
              content: {
                'text/html': {
                  schema: { type: 'string' },
                },
              },
            },
            '400': {
              description: 'Invalid client or template format',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            '404': {
              description: 'Preview fixture or template not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/template': {
        post: {
          tags: ['templates'],
          summary: 'Render an email template and optionally send it',
          description: 'Send a JSON or form-encoded body. If email is supplied and SMTP is configured, the rendered HTML is also delivered.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TemplateRenderRequest' },
              },
              'application/x-www-form-urlencoded': {
                schema: { $ref: '#/components/schemas/TemplateRenderRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Rendered HTML template',
              content: {
                'text/html': {
                  schema: { type: 'string' },
                },
              },
            },
            '400': {
              description: 'Missing or invalid request parameters',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TemplateRequestError' },
                },
              },
            },
            '404': {
              description: 'Template not found for the requested client',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            '429': {
              description: 'Rate limit exceeded',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            '500': {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        TemplateRenderRequest: {
          type: 'object',
          required: ['template_name', 'first_name', 'last_name'],
          properties: {
            client: {
              type: 'string',
              enum: clients,
              default: DEFAULT_CLIENT_KEY,
              description: 'Optional client namespace. Use default for NJMTech and style-and-grace for the first client-specific templates.',
            },
            template_name: {
              type: 'string',
              enum: TEMPLATE_NAMES,
              description: 'Template key to render.',
            },
            first_name: {
              type: 'string',
              description: 'Recipient first name.',
            },
            last_name: {
              type: 'string',
              description: 'Recipient last name.',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Optional destination email. When omitted, the template is only rendered.',
            },
            site_url: {
              type: 'string',
              format: 'uri',
              description: 'Optional URL exposed to templates for CTA links and footer references.',
            },
            order_number: {
              type: 'string',
              description: 'Optional order number for e-commerce confirmation templates.',
            },
            order_date: {
              type: 'string',
              description: 'Optional order date shown in confirmation emails.',
            },
            payment_status: {
              type: 'string',
              description: 'Optional payment status shown in confirmation emails.',
            },
            shipping_method: {
              type: 'string',
              description: 'Optional shipping method shown in confirmation emails.',
            },
            estimated_delivery: {
              type: 'string',
              description: 'Optional delivery estimate shown in confirmation emails.',
            },
            subtotal: {
              type: 'string',
              description: 'Optional order subtotal.',
            },
            shipping: {
              type: 'string',
              description: 'Optional shipping charge.',
            },
            discount: {
              type: 'string',
              description: 'Optional discount amount.',
            },
            tax: {
              type: 'string',
              description: 'Optional tax amount or note.',
            },
            total: {
              type: 'string',
              description: 'Optional total paid.',
            },
            shipping_address: {
              type: 'string',
              description: 'Optional shipping address shown in confirmation emails.',
            },
            billing_address: {
              type: 'string',
              description: 'Optional billing address shown in confirmation emails.',
            },
            order_items: {
              type: 'array',
              description: 'Optional ordered items for e-commerce confirmation templates.',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  variant: { type: 'string' },
                  quantity: { type: 'number' },
                  subtotal: { type: 'string' },
                  price: { type: 'string' },
                  unit_price: { type: 'string' },
                  image_url: { type: 'string', format: 'uri' },
                },
                additionalProperties: true,
              },
            },
          },
          additionalProperties: true,
          example: {
            client: 'style-and-grace',
            template_name: 'thank_you',
            first_name: 'Jane',
            last_name: 'Smith',
            email: 'jane@example.com',
            site_url: 'https://styleandgrace.co.za',
            order_number: 'SG-1042',
            order_date: '18 May 2026',
            payment_status: 'Paid',
            shipping_method: 'Courier Guy - Standard',
            estimated_delivery: '21-23 May 2026',
            subtotal: 'R1,150.00',
            shipping: 'R99.00',
            discount: 'R0.00',
            tax: 'Included',
            total: 'R1,249.00',
            shipping_address: '12 Palm Avenue, Sandton, Johannesburg',
            billing_address: '12 Palm Avenue, Sandton, Johannesburg',
            order_items: [
              {
                name: 'Satin Wrap Dress',
                variant: 'Color: Burgundy / Size: M',
                quantity: 1,
                subtotal: 'R899.00',
              },
            ],
          },
        },
        TemplateRequestError: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            missingParams: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  };
}

function getDocsHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Email Template API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      html, body { margin: 0; padding: 0; background: #f8fafc; }
      #swagger-ui { max-width: 1200px; margin: 0 auto; }
      .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
        layout: 'BaseLayout'
      });
    </script>
  </body>
</html>`;
}

api.get('/', (req: Request, res: Response) => {
  res.render('pages/home', {
    title: 'Email Template API',
    isHome: true,
    previewCollections: getPreviewCollections(),
    defaultClientKey: DEFAULT_CLIENT_KEY,
  });
});

api.get('/openapi.json', (req: Request, res: Response) => {
  res.json(buildOpenApiDocument());
});

api.get(['/docs', '/docs/'], (req: Request, res: Response) => {
  res.type('html').send(getDocsHtml());
});

api.get('/preview/:template', async (req: Request, res: Response) => {
  const { clientKey, error: clientError } = resolveClientKey(req.query.client);
  if (clientError) {
    return res.status(400).json({ error: clientError });
  }

  const { templateName, error: templateError } = resolveTemplateName(req.params.template);
  if (templateError) {
    return res.status(400).json({ error: templateError });
  }

  return renderPreviewResponse(res, clientKey!, templateName!);
});

api.get('/preview/:client/:template', async (req: Request, res: Response) => {
  const { clientKey, error: clientError } = resolveClientKey(req.params.client);
  if (clientError) {
    return res.status(400).json({ error: clientError });
  }

  const { templateName, error: templateError } = resolveTemplateName(req.params.template);
  if (templateError) {
    return res.status(400).json({ error: templateError });
  }

  return renderPreviewResponse(res, clientKey!, templateName!);
});

if (process.env.NODE_ENV !== 'test') {
  api.use('/template', limiter);
}

api.post('/template', async (req: Request, res: Response, next: NextFunction) => {
  const { client, template_name, first_name, last_name, email, site_url, siteUrl, ...extraVars } = req.body;
  const missingParams: string[] = [];

  if (!template_name) missingParams.push('template_name');
  if (!first_name) missingParams.push('first_name');
  if (!last_name) missingParams.push('last_name');

  if (missingParams.length > 0) {
    return res.status(400).json({ error: 'Missing required parameters', missingParams });
  }

  const { clientKey, error: clientError } = resolveClientKey(client);
  if (clientError) {
    return res.status(400).json({ error: clientError });
  }

  const { templateName, error: templateError } = resolveTemplateName(template_name);
  if (templateError) {
    return res.status(400).json({ error: templateError });
  }

  const view = resolveTemplateView(clientKey!, templateName!);
  if (!view) {
    return res.status(404).json({ error: `Template '${templateName}' not found for client '${clientKey}'` });
  }

  const displayName = `${first_name} ${last_name}`;
  const clientDefaults = TEMPLATE_CLIENTS[clientKey!].defaultLocals;

  let html: string;
  try {
    html = await renderView(view, {
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

  if (email && process.env.SMTP_HOST) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: `"${clientDefaults.fromName || process.env.FROM_NAME || 'NJMTech'}" <${process.env.FROM_EMAIL}>`,
        to: email,
        subject: `Thank you, ${displayName}!`,
        html,
      });
    } catch (err) {
      return next(err);
    }
  }

  res.status(200).send(html);
});

api.use((req: Request, res: Response) => {
  res.status(404).render('pages/404', { title: '404 — Page Not Found' });
});

api.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

export { api };
export default api;

if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3001;
  api.listen(PORT, () => console.log(`Email Template API running on http://localhost:${PORT}`));
}

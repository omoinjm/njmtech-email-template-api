import type { AppConfig } from '../config/types';
import { getTemplateNames } from './templateRenderer';

export function buildOpenApiDocument(appConfig: AppConfig) {
  const clients = Object.keys(appConfig.clients);
  const templateNames = getTemplateNames(appConfig);

  return {
    openapi: '3.1.0',
    info: {
      title: 'Email Template API',
      version: '1.2.0',
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
                enum: templateNames,
              },
            },
            {
              name: 'client',
              in: 'query',
              required: false,
              schema: {
                type: 'string',
                enum: clients,
                default: appConfig.defaultClientKey,
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
                enum: templateNames,
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
          description:
            'Send a JSON or form-encoded body. If email is supplied and SMTP is configured, the rendered HTML is also delivered when EMAIL_MODE allows sending.',
          security: [{ ApiKeyAuth: [] as string[] }],
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
            '401': {
              description: 'Missing API key',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            '403': {
              description: 'Invalid API key or unauthorized client scope',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
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
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'Provide the deployment API key via X-API-Key or Authorization: Bearer <key>.',
        },
      },
      schemas: {
        TemplateRenderRequest: {
          type: 'object',
          required: ['template_name', 'first_name', 'last_name'],
          properties: {
            client: {
              type: 'string',
              enum: clients,
              default: appConfig.defaultClientKey,
              description: 'Optional client namespace. Use default for NJMTech and style-and-grace for the first client-specific templates.',
            },
            template_name: {
              type: 'string',
              enum: templateNames,
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

export function getDocsHtml(): string {
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

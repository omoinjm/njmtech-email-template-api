# Copilot instructions for `njmtech-email-template-api`

## Build, test, and type-check commands

Use npm scripts from the repository root:

```bash
npm run build
npm test -- --runInBand
npm run ts.check
```

Run a single Jest test by file and test name:

```bash
npx jest tests/index.ts --runInBand -t "renders a client-specific template when client is supplied"
```

The pre-commit configuration runs:

```bash
npm run ts.check
npm run build
```

## High-level architecture

- The application is a single Express server in `api/index.ts`. That file owns request parsing, rate limiting, template/client registries, preview fixtures, OpenAPI generation, docs HTML, route handlers, SMTP sending, and error handling.
- Vercel routes all traffic to `api/index.ts` via `vercel.json`, so changes to routing and runtime behavior usually start in that file.
- Templates are rendered from EJS files under:
  - `api/views/pages/` for default NJMTech templates
  - `api/views/pages/clients/<client>/` for client-specific overrides such as `style-and-grace`
- Preview routes (`GET /preview/:template` and `GET /preview/:client/:template`) do not render arbitrary templates directly; they depend on `PREVIEW_FIXTURES`, `TEMPLATE_NAMES`, and `TEMPLATE_CLIENTS` in `api/index.ts`.
- `POST /template` resolves the client first, then the template, renders HTML, and only sends email when both `email` and SMTP environment variables are present.
- `/docs` serves a Swagger UI page that reads `/openapi.json`, and the OpenAPI document is generated in code from the same registries used by the runtime routes.

## Key repository conventions

- Treat `TEMPLATE_CLIENTS`, `PREVIEW_FIXTURES`, and the template files as one feature surface. When adding or changing a template, update the registry/fixture data in `api/index.ts`, the EJS file, and the tests together.
- Request payloads use snake_case fields such as `template_name`, `first_name`, `last_name`, `site_url`, and `order_items`. Inside templates, the server often maps them to camelCase locals like `firstName`, `lastName`, and `siteUrl`, while also passing through `extraVars`.
- Client-specific behavior is driven by the `client` body/query value and resolved through `TEMPLATE_CLIENTS`; `default` is the implicit fallback client.
- Style & Grace’s `thank_you` template is an order-confirmation template, not a generic thank-you. It expects e-commerce fields like `order_number`, `order_date`, `payment_status`, `shipping_method`, `estimated_delivery`, `order_items`, `subtotal`, `shipping`, `discount`, `tax`, `total`, `shipping_address`, and `billing_address`.
- Preview behavior can differ by client through `previewOverrides`, so check preview fixtures when a template looks correct in `POST /template` but wrong in preview routes.
- Tests intentionally disable live SMTP by setting `NODE_ENV=test` and `SMTP_HOST=''` at the top of `tests/index.ts`. Keep that behavior so template rendering tests do not hang on outbound mail.
- Rate limiting is applied only to `/template` and is skipped in tests (`if (process.env.NODE_ENV !== 'test')`).
- Error responses are part of the public API shape here: invalid identifiers return `400`, missing templates return `404`, and send/runtime failures fall through the centralized `500` handler.

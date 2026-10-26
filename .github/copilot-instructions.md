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

- The application is an Express server wired in `api/index.ts`. Route handlers live under `api/routes/`, config loading in `api/config/`, middleware in `api/middleware/`, and services in `api/services/`.
- Client and deployment settings are loaded from `config/clients/*.json`, `config/deployments/*.json`, and `config/preview-fixtures.json`.
- Vercel routes all traffic to `api/index.ts` via `vercel.json`.
- Templates are rendered from EJS files under:
  - `api/views/pages/` for default NJMTech templates
  - `api/views/pages/clients/<client>/` for client-specific overrides such as `style-and-grace`
- Preview routes depend on preview fixtures and client config; they can be disabled with `PREVIEW_ENABLED=false`.
- `POST /template` resolves the client first, then the template, renders HTML, and sends email only when `EMAIL_MODE` allows it.
- Uploaded templates managed via `/admin` take priority over built-in EJS files in `api/views/`.
- `/docs` serves Swagger UI that reads `/openapi.json`.

## Deployment tiers

- **Shared (`DEPLOYMENT_TIER=shared`)**: multiple clients via `ALLOWED_CLIENTS`, scoped keys via `API_KEYS`.
- **Dedicated (`DEPLOYMENT_TIER=dedicated`)**: one client via `CLIENT_KEY`, single `API_KEY`, own SMTP and rate limits.
- See `docs/set-up.md` and `docs/deployments/bookmark-sync-engine.md` for Tier 2 setup.

## Key repository conventions

- Treat client config JSON, preview fixtures, and template files as one feature surface. When adding or changing a template, update the client config, preview fixtures, EJS file, and tests together.
- Request payloads use snake_case fields such as `template_name`, `first_name`, `last_name`, `site_url`, and `order_items`. Inside templates, the server often maps them to camelCase locals like `firstName`, `lastName`, and `siteUrl`, while also passing through `extraVars`.
- Client-specific behavior is driven by the `client` body/query value and resolved through loaded client config; `default` is the implicit fallback client on shared deployments.
- Style & Grace’s `thank_you` template is an order-confirmation template, not a generic thank-you. It expects e-commerce fields like `order_number`, `order_date`, `payment_status`, `shipping_method`, `estimated_delivery`, `order_items`, `subtotal`, `shipping`, `discount`, `tax`, `total`, `shipping_address`, and `billing_address`.
- Preview behavior can differ by client through `previewOverrides` in client config.
- Tests intentionally disable live SMTP by setting `NODE_ENV=test` and `SMTP_HOST=''` at the top of `tests/index.ts`. Auth tests opt in with `AUTH_REQUIRED=true`.
- Rate limiting is skipped in tests. Production should use Upstash via `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
- Error responses are part of the public API shape: invalid identifiers return `400`, missing templates return `404`, unauthorized clients return `403`, and send/runtime failures fall through the centralized `500` handler.

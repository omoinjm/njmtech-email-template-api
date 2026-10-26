# Email Template API

A REST API for rendering and sending HTML email templates, built with **Node.js + TypeScript + Express**, deployed on **Vercel**.

## Features

- Render EJS email templates by name
- Optionally send rendered templates via SMTP (Nodemailer)
- Shared and dedicated deployment tiers from the same codebase
- API key authentication for `/template`
- Distributed rate limiting via Upstash Redis (with in-memory fallback)
- Config-driven client registry under `config/clients/`
- Admin UI at `/admin` to upload templates per client without redeploying
- Centralized error handling
- Serverless-ready (Vercel)

## Prerequisites

- Node.js (installed)
- An SMTP provider (e.g. Gmail, SendGrid, Mailgun)

## Setup

```bash
npm install
cp .env.example .env   # fill in your values
npm run dev            # starts dev server with nodemon
```

See [`docs/set-up.md`](./docs/set-up.md) for full setup instructions, deployment tiers, and auth configuration.

## API Endpoints

### `GET /`
Returns the landing page.

### `GET /docs`
Returns the Swagger UI documentation page.

### `GET /openapi.json`
Returns the OpenAPI document used by `/docs`.

### `GET /preview/:template`
Renders a default template preview with fixture data.

**Query parameters:**

| Field    | Required | Description |
|----------|----------|-------------|
| `client` | ❌       | Client namespace. Omit it or use `default` for NJMTech templates. Also available: `style-and-grace`, `bookmark-sync-engine`. |

### `GET /preview/:client/:template`
Renders a client-specific template preview directly by namespace.

### `POST /template`
Renders an EJS template and optionally sends it as an email.

**Body (JSON or form-data):**

| Field           | Required | Description                                      |
|----------------|----------|--------------------------------------------------|
| `client`        | ❌       | Client namespace. Defaults to `default` (NJMTech). |
| `template_name` | ✅       | Name of the EJS template (e.g. `thank_you`)      |
| `first_name`    | ✅       | Recipient's first name                           |
| `last_name`     | ✅       | Recipient's last name                            |
| `email`         | ❌       | If provided, sends the rendered template via SMTP |
| `site_url`      | ❌       | Optional URL injected into template links such as CTA buttons |

Default templates are resolved from `api/views/pages/`. Client-specific templates are resolved from `api/views/pages/clients/<client>/`.

For the Style & Grace `thank_you` template, you can also pass order fields such as `order_number`, `order_date`, `payment_status`, `shipping_method`, `estimated_delivery`, `order_items`, `subtotal`, `shipping`, `discount`, `tax`, `total`, `shipping_address`, and `billing_address`.

The `bookmark-sync-engine` client only supports two templates: `thank_you` (a signup welcome email) and `account_credentials` (delivers an auto-generated password — pass `email`, `password`, and `loginUrl`).

**Responses:**
- `200` – Rendered HTML template
- `400` – Missing required parameters (`error`, `missingParams`)
- `404` – Template not found
- `429` – Rate limit exceeded
- `500` – Internal server error / email send failure

## Scripts

| Command          | Description                     |
|------------------|---------------------------------|
| `npm run dev`    | Start dev server with nodemon   |
| `npm run build`  | Compile TypeScript              |
| `npm start`      | Run compiled output             |
| `npm test`       | Run Jest test suite             |
| `npm run ts.check` | TypeScript type check only    |

## Environment Variables

See [`.env.example`](./.env.example) for the full list.

# Setup Guide

## 1. Clone & Install

```bash
git clone https://github.com/omoinjm/njmtech-email-template-api.git
cd njmtech-email-template-api
npm install
```

## 2. Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

| Variable | Description |
|----------|-------------|
| `SMTP_HOST` | SMTP server host (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | SMTP port (usually `587` for TLS, `465` for SSL) |
| `SMTP_SECURE` | `true` for SSL (port 465), `false` for TLS (port 587) |
| `SMTP_USER` | Your SMTP username / email address |
| `SMTP_PASS` | Your SMTP password or app password |
| `FROM_EMAIL` | The sender email address |
| `FROM_NAME` | The sender display name |
| `SENDER_NAME` | Name shown in the email sign-off |
| `CONTACT_EMAIL` | Contact email shown in the email footer |
| `DEPLOYMENT_TIER` | `shared` (default) or `dedicated` |
| `ALLOWED_CLIENTS` | Comma-separated client keys for shared deployments |
| `CLIENT_KEY` | Required when `DEPLOYMENT_TIER=dedicated` |
| `EMAIL_MODE` | `auto`, `render`, or `send` |
| `API_KEY` | Shared or dedicated deployment API key |
| `API_KEYS` | Optional JSON map of client key → API key for shared tier |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL for distributed rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token for distributed rate limiting |
| `PREVIEW_ENABLED` | Set to `false` to disable preview routes |
| `AUTH_REQUIRED` | Set to `false` to disable auth locally |

> **Gmail tip:** Use an [App Password](https://support.google.com/accounts/answer/185833) instead of your regular password.

## 3. Run Locally

```bash
npm run dev
```

The server starts at `http://localhost:3001`.

## 4. Run Tests

```bash
npm test
```

## 5. Build

```bash
npm run build
```

Output is written to the `dist/` directory.

## 6. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Set your environment variables in the Vercel dashboard under **Project → Settings → Environment Variables**.

---

## Deployment Tiers

This API supports two deployment profiles from the same repository.

### Tier 1 — Shared deployment (small projects)

Use one Vercel project for multiple low-volume clients.

**Example env:**

```env
DEPLOYMENT_TIER=shared
ALLOWED_CLIENTS=default,style-and-grace
EMAIL_MODE=auto
API_KEYS={"default":"key-for-default","style-and-grace":"key-for-sg"}
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

**Behavior:**
- Multiple client namespaces on one URL
- Per-client API keys via `API_KEYS`
- Shared or absent SMTP
- Preview routes enabled by default

### Tier 2 — Dedicated deployment (large clients)

Use a separate Vercel project per high-volume client.

**Example env for Bookmark Sync Engine:**

```env
DEPLOYMENT_TIER=dedicated
CLIENT_KEY=bookmark-sync-engine
EMAIL_MODE=send
API_KEY=your-dedicated-client-key
PREVIEW_ENABLED=false
RATE_LIMIT={"windowMs":86400000,"max":10000}
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
FROM_EMAIL=...
FROM_NAME=Bookmark Sync Engine
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

**Behavior:**
- Locked to one client; other `client` values return `403`
- `client` body param is optional and defaults to `CLIENT_KEY`
- Own SMTP credentials and higher rate limits
- Preview routes disabled by default

See [`docs/deployments/bookmark-sync-engine.md`](./deployments/bookmark-sync-engine.md) for the full Tier 2 pilot setup.

---

## Adding a Small Client (Tier 1)

1. Add `config/clients/<slug>.json`
2. Add templates under `api/views/pages/clients/<slug>/`
3. Update `config/preview-fixtures.json` if the template needs preview data
4. Add `<slug>` to `ALLOWED_CLIENTS` on the shared Vercel project
5. Issue an API key in `API_KEYS`
6. Update tests in `tests/index.ts`

## Promoting a Client to Tier 2

1. Create a new Vercel project from the same GitHub repo
2. Set `DEPLOYMENT_TIER=dedicated` and `CLIENT_KEY=<slug>`
3. Configure dedicated SMTP, `API_KEY`, and higher `RATE_LIMIT`
4. Set `EMAIL_MODE=render` if the client sends email themselves
5. Remove the client from shared `ALLOWED_CLIENTS` in production
6. Point the client's app to the dedicated URL and API key

---

## Configuration Files

| Path | Purpose |
|------|---------|
| `config/clients/*.json` | Client template registry and default locals |
| `config/deployments/shared.json` | Shared deployment defaults |
| `config/deployments/<client>.json` | Dedicated deployment defaults |
| `config/preview-fixtures.json` | Preview route sample data |

Client config supports env placeholders such as `{{CONTACT_EMAIL:hello@example.com}}`.

---

## API Authentication

Production `/template` requests require an API key when `API_KEY` or `API_KEYS` is configured.

Supported headers:

```http
X-API-Key: your-key
```

```http
Authorization: Bearer your-key
```

On shared deployments, scoped keys in `API_KEYS` must match the requested `client`.

---

## Rate Limiting

When `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, rate limits are enforced globally across serverless instances.

Without Upstash, the API falls back to an in-memory limiter suitable only for local development.

Override defaults with:

```env
RATE_LIMIT={"windowMs":900000,"max":100}
```

---

## Email Modes

| Mode | Behavior |
|------|----------|
| `auto` | Send when `email` is present and SMTP is configured |
| `render` | Always return HTML; never send |
| `send` | Require SMTP; send when `email` is present |

---

## Adding New Templates

1. Create a new `.ejs` file in `api/views/pages/` for default NJMTech templates, or in `api/views/pages/clients/<client>/` for client-specific templates.
2. Add the template name to the client's `templates` array in `config/clients/<client>.json`.
3. Available template variables:
   - `title` – page title
   - `isHome` – boolean, `false` for email templates
   - `displayName` – recipient's full name
   - `senderName` – from client config or `SENDER_NAME`
   - `contactEmail` – from client config or `CONTACT_EMAIL`
   - `siteUrl` – site URL used in links and footer copy
   - Client templates can also use order-specific values such as `order_number`, `order_date`, `payment_status`, `shipping_method`, `estimated_delivery`, `order_items`, `subtotal`, `shipping`, `discount`, `tax`, `total`, `shipping_address`, and `billing_address`
4. Pass template-specific values such as `site_url` in the `POST /template` body when a template needs a live CTA destination.
5. If the template belongs to a client namespace, also send `client=<client-slug>`

## API Docs

- Swagger UI: `GET /docs`
- OpenAPI JSON: `GET /openapi.json`
- Default template previews: `GET /preview/:template`
- Client template previews: `GET /preview/:client/:template`

## Template Admin

See [`docs/template-admin.md`](./template-admin.md) for the `/admin` UI used to upload templates per client without redeploying code.

# Dedicated Deployment: Bookmark Sync Engine

This document describes the Tier 2 pilot setup for `bookmark-sync-engine` — a separate Vercel project using the same repository with isolated credentials and limits.

## Why a Dedicated Deployment

Bookmark Sync Engine serves 1000+ users and should not share rate limits, SMTP credentials, or blast radius with smaller clients on the shared deployment.

## Create the Vercel Project

1. In the Vercel dashboard, click **Add New → Project**
2. Import the same GitHub repository used by the shared deployment
3. Name the project `email-api-bse` (already created under the `njmtech` team)
4. Keep the default build settings (`api/index.ts` via `vercel.json`)
5. Connect the GitHub repo in the Vercel dashboard if it is not linked yet (the same repo can power both `email-template-api` and `email-api-bse` with different env vars)

The following production env vars are already configured on `email-api-bse`:

- `DEPLOYMENT_TIER=dedicated`
- `CLIENT_KEY=bookmark-sync-engine`
- `EMAIL_MODE=send`
- `PREVIEW_ENABLED=false`
- `RATE_LIMIT={"windowMs":86400000,"max":10000}`

You still need to add secrets in the Vercel dashboard:

| Variable | Value |
|----------|-------|
| `API_KEY` | Generate a strong secret for the client app |
| `SMTP_HOST` | Client SMTP host |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | Client SMTP user |
| `SMTP_PASS` | Client SMTP password |
| `FROM_EMAIL` | Verified sender address |
| `FROM_NAME` | `Bookmark Sync Engine` |
| `CONTACT_EMAIL` | Support/contact address for templates |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |

Already configured on `email-api-bse`:

| Variable | Value |
|----------|-------|
| `DEPLOYMENT_TIER` | `dedicated` |
| `CLIENT_KEY` | `bookmark-sync-engine` |
| `EMAIL_MODE` | `send` |
| `PREVIEW_ENABLED` | `false` |
| `RATE_LIMIT` | `{"windowMs":86400000,"max":10000}` |

### Render-only variant

If Bookmark Sync Engine sends email from its own infrastructure:

```env
EMAIL_MODE=render
```

Omit SMTP variables. The API returns rendered HTML only.

## Client Integration

Dedicated deployments accept requests without a `client` field:

```bash
curl -X POST https://email-api-bse.example.com/template \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-dedicated-client-key" \
  -d '{
    "template_name": "account_credentials",
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane@example.com",
    "password": "generated-password",
    "loginUrl": "https://bookmarks.njmtech.co.za"
  }'
```

If `client` is supplied, it must equal `bookmark-sync-engine` or the API returns `403`.

## Shared Deployment Cleanup

After the dedicated project is live:

1. Remove `bookmark-sync-engine` from `ALLOWED_CLIENTS` on the shared Vercel project
2. Rotate/remove the shared-tier API key for that client
3. Update the Bookmark Sync Engine app to use the dedicated URL and API key

## Upstash Setup

1. Create an Upstash Redis database
2. Copy the REST URL and token into the Vercel env vars
3. Rate limits will apply globally across all serverless instances

Without Upstash, the API falls back to in-memory limiting, which is not suitable for production serverless workloads.

## Verification Checklist

- [ ] `POST /template` requires `X-API-Key`
- [ ] Requests without auth return `401`
- [ ] `client=style-and-grace` returns `403`
- [ ] Omitting `client` renders `bookmark-sync-engine` templates
- [ ] Preview routes return `404` when `PREVIEW_ENABLED=false`
- [ ] Rate limit headers appear when Upstash is configured
- [ ] SMTP send works when `EMAIL_MODE=send`

## Local Testing

```bash
DEPLOYMENT_TIER=dedicated \
CLIENT_KEY=bookmark-sync-engine \
EMAIL_MODE=render \
API_KEY=local-test-key \
AUTH_REQUIRED=true \
npm run dev
```

```bash
curl -X POST http://localhost:3001/template \
  -H "Content-Type: application/json" \
  -H "X-API-Key: local-test-key" \
  -d '{
    "template_name": "thank_you",
    "first_name": "Jane",
    "last_name": "Smith"
  }'
```

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

| Variable        | Description                                         |
|----------------|-----------------------------------------------------|
| `SMTP_HOST`     | SMTP server host (e.g. `smtp.gmail.com`)            |
| `SMTP_PORT`     | SMTP port (usually `587` for TLS, `465` for SSL)    |
| `SMTP_SECURE`   | `true` for SSL (port 465), `false` for TLS (port 587) |
| `SMTP_USER`     | Your SMTP username / email address                  |
| `SMTP_PASS`     | Your SMTP password or app password                  |
| `FROM_EMAIL`    | The sender email address                            |
| `FROM_NAME`     | The sender display name                             |
| `SENDER_NAME`   | Name shown in the email sign-off                    |
| `CONTACT_EMAIL` | Contact email shown in the email footer             |

> **Gmail tip:** Use an [App Password](https://support.google.com/accounts/answer/185833) instead of your regular password.

## 3. Run Locally

```bash
npm run dev
```

The server starts at `http://localhost:3000`.

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

## Adding New Templates

1. Create a new `.ejs` file in `api/views/pages/` for the default NJMTech templates, or in `api/views/pages/clients/<client>/` for client-specific templates.
2. Available template variables:
   - `title` – page title
   - `isHome` – boolean, `false` for email templates
   - `displayName` – recipient's full name
   - `senderName` – from `SENDER_NAME` env var
   - `contactEmail` – from `CONTACT_EMAIL` env var
   - `siteUrl` – site URL used in links and footer copy
3. Pass template-specific values such as `site_url` in the `POST /template` body when a template needs a live CTA destination.
4. Call `POST /template` with `template_name=welcome`
5. If the template belongs to a client namespace, also send `client=<client-slug>`

## API Docs

- Swagger UI: `GET /docs`
- OpenAPI JSON: `GET /openapi.json`
- Default template previews: `GET /preview/:template`
- Client template previews: `GET /preview/:client/:template`

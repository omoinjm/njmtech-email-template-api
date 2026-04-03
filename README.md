# Email Template API

A REST API for rendering and sending HTML email templates, built with **Node.js + TypeScript + Express**, deployed on **Vercel**.

## Features

- Render EJS email templates by name
- Optionally send rendered templates via SMTP (Nodemailer)
- Rate limiting on the template endpoint (10 requests / 15 min)
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

See [`docs/set-up.md`](./docs/set-up.md) for full setup instructions.

## API Endpoints

### `GET /`
Returns the landing page.

### `POST /template`
Renders an EJS template and optionally sends it as an email.

**Body (JSON or form-data):**

| Field           | Required | Description                                      |
|----------------|----------|--------------------------------------------------|
| `template_name` | ✅       | Name of the EJS template (e.g. `thank_you`)      |
| `first_name`    | ✅       | Recipient's first name                           |
| `last_name`     | ✅       | Recipient's last name                            |
| `email`         | ❌       | If provided, sends the rendered template via SMTP |

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


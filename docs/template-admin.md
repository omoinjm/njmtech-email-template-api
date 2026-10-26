## Template Admin UI

Upload and manage EJS email templates per client without editing the repository or redeploying code.

### Enable locally

```env
ADMIN_API_KEY=your-strong-admin-secret
```

Visit `http://localhost:3001/admin?key=your-strong-admin-secret`.

### Production (Vercel)

1. Set `ADMIN_API_KEY` in the Vercel project env vars.
2. For persistent storage across serverless instances, connect **Vercel Blob** and set `BLOB_READ_WRITE_TOKEN`.
3. Without Blob, uploads are stored in `data/templates/` locally only (not suitable for production serverless).

### How it works

| Storage | When | Path |
|---------|------|------|
| Uploaded templates | Admin UI or API | Vercel Blob or `data/templates/{client}/{name}.ejs` |
| Built-in templates | Repository | `api/views/pages/` and `api/views/pages/clients/{client}/` |

Rendering priority:

1. Uploaded template (if present)
2. Built-in filesystem template (fallback)

Uploaded templates override built-in ones with the same name for that client.

### Admin API

All routes require `X-Admin-Key` or `Authorization: Bearer <ADMIN_API_KEY>`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/api/clients` | List clients with merged template catalog |
| `GET` | `/admin/api/templates` | List uploaded templates |
| `GET` | `/admin/api/templates/:client/:template` | Fetch uploaded template content |
| `PUT` | `/admin/api/templates/:client/:template` | Create or overwrite uploaded template |
| `POST` | `/admin/api/templates` | Create uploaded template (409 if exists) |
| `DELETE` | `/admin/api/templates/:client/:template` | Delete uploaded override |
| `POST` | `/admin/api/upload` | Upload helper alias for `PUT` |

### Template format

- Use full HTML email documents with EJS variables (`<%= displayName %>`, `<%= siteUrl %>`, etc.).
- Templates should be self-contained. Partial includes from `api/views/common/` are not available to uploaded templates.
- Copy an existing built-in template as a starting point, then customize.

### Security notes

- Keep `ADMIN_API_KEY` separate from client `API_KEY` values.
- Disable admin in dedicated production deployments with `ADMIN_ENABLED=false` if not needed.
- Prefer Vercel Blob private access for stored templates.

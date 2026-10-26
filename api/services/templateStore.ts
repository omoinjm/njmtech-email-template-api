import fs from 'fs';
import path from 'path';
import { del, get, list, put } from '@vercel/blob';

export interface StoredTemplateMeta {
  clientKey: string;
  templateName: string;
  updatedAt: string;
  size: number;
  source: 'uploaded';
}

export interface TemplateStore {
  list(clientKey?: string): Promise<StoredTemplateMeta[]>;
  get(clientKey: string, templateName: string): Promise<string | null>;
  put(clientKey: string, templateName: string, content: string): Promise<StoredTemplateMeta>;
  delete(clientKey: string, templateName: string): Promise<boolean>;
}

function templatePath(clientKey: string, templateName: string): string {
  return `templates/${clientKey}/${templateName}.ejs`;
}

function getDataRoot(): string {
  const candidates = [
    path.join(process.cwd(), 'data'),
    path.join(__dirname, '..', '..', 'data'),
    path.join(__dirname, '..', '..', '..', 'data'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.join(process.cwd(), 'data');
}

async function streamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  return Buffer.concat(chunks).toString('utf8');
}

export function createTemplateStore(): TemplateStore {
  return process.env.BLOB_READ_WRITE_TOKEN ? createBlobStore() : createLocalStore();
}

function createLocalStore(): TemplateStore {
  const dataRoot = getDataRoot();
  const templatesRoot = path.join(dataRoot, 'templates');

  function ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  function filePath(clientKey: string, templateName: string): string {
    return path.join(templatesRoot, clientKey, `${templateName}.ejs`);
  }

  return {
    async list(clientKey?: string) {
      ensureDir(templatesRoot);
      const clientKeys = clientKey
        ? [clientKey]
        : fs
            .readdirSync(templatesRoot, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name);

      const results: StoredTemplateMeta[] = [];

      for (const key of clientKeys) {
        const clientDir = path.join(templatesRoot, key);
        if (!fs.existsSync(clientDir)) continue;

        for (const file of fs.readdirSync(clientDir)) {
          if (!file.endsWith('.ejs')) continue;
          const fullPath = path.join(clientDir, file);
          const stat = fs.statSync(fullPath);
          results.push({
            clientKey: key,
            templateName: file.replace(/\.ejs$/, ''),
            updatedAt: stat.mtime.toISOString(),
            size: stat.size,
            source: 'uploaded',
          });
        }
      }

      return results.sort(
        (a, b) => a.clientKey.localeCompare(b.clientKey) || a.templateName.localeCompare(b.templateName),
      );
    },

    async get(clientKey: string, templateName: string) {
      const fullPath = filePath(clientKey, templateName);
      if (!fs.existsSync(fullPath)) return null;
      return fs.readFileSync(fullPath, 'utf8');
    },

    async put(clientKey: string, templateName: string, content: string) {
      const fullPath = filePath(clientKey, templateName);
      ensureDir(path.dirname(fullPath));
      fs.writeFileSync(fullPath, content, 'utf8');
      const stat = fs.statSync(fullPath);
      return {
        clientKey,
        templateName,
        updatedAt: stat.mtime.toISOString(),
        size: stat.size,
        source: 'uploaded' as const,
      };
    },

    async delete(clientKey: string, templateName: string) {
      const fullPath = filePath(clientKey, templateName);
      if (!fs.existsSync(fullPath)) return false;
      fs.unlinkSync(fullPath);
      return true;
    },
  };
}

function createBlobStore(): TemplateStore {
  return {
    async list(clientKey?: string) {
      const prefix = clientKey ? `templates/${clientKey}/` : 'templates/';
      const result = await list({ prefix });

      return result.blobs
        .filter((blob) => blob.pathname.endsWith('.ejs'))
        .map((blob) => {
          const parts = blob.pathname.split('/');
          const templateFile = parts[parts.length - 1] ?? '';
          return {
            clientKey: parts[1] ?? '',
            templateName: templateFile.replace(/\.ejs$/, ''),
            updatedAt: blob.uploadedAt.toISOString(),
            size: blob.size,
            source: 'uploaded' as const,
          };
        })
        .filter((entry) => entry.clientKey && entry.templateName)
        .sort(
          (a, b) => a.clientKey.localeCompare(b.clientKey) || a.templateName.localeCompare(b.templateName),
        );
    },

    async get(clientKey: string, templateName: string) {
      const pathname = templatePath(clientKey, templateName);
      const result = await get(pathname, { access: 'private' });
      if (!result || result.statusCode === 304 || !result.stream) return null;
      return streamToString(result.stream);
    },

    async put(clientKey: string, templateName: string, content: string) {
      const pathname = templatePath(clientKey, templateName);
      await put(pathname, content, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'text/plain; charset=utf-8',
      });

      return {
        clientKey,
        templateName,
        updatedAt: new Date().toISOString(),
        size: content.length,
        source: 'uploaded' as const,
      };
    },

    async delete(clientKey: string, templateName: string) {
      const pathname = templatePath(clientKey, templateName);
      const result = await list({ prefix: pathname });
      const blob = result.blobs.find((entry) => entry.pathname === pathname);
      if (!blob?.url) return false;

      await del(blob.url);
      return true;
    },
  };
}

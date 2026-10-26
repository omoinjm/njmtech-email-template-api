import ejs from 'ejs';
import type { Application } from 'express';
import type { AppConfig } from '../config/types';
import { createTemplateStore } from './templateStore';

const templateStore = createTemplateStore();

export async function hasTemplate(appConfig: AppConfig, clientKey: string, templateName: string): Promise<boolean> {
  const uploaded = await templateStore.get(clientKey, templateName);
  if (uploaded) return true;

  const clientConfig = appConfig.clients[clientKey];
  return Boolean(clientConfig?.templates.includes(templateName));
}

export function resolveTemplateView(appConfig: AppConfig, clientKey: string, templateName: string): string | null {
  const clientConfig = appConfig.clients[clientKey];
  if (!clientConfig || !clientConfig.templates.includes(templateName)) {
    return null;
  }

  return `${clientConfig.viewRoot}/${templateName}`;
}

export async function listClientTemplates(appConfig: AppConfig, clientKey: string) {
  const clientConfig = appConfig.clients[clientKey];
  const uploaded = await templateStore.list(clientKey);
  const uploadedNames = new Set(uploaded.map((entry) => entry.templateName));
  const builtIn = clientConfig?.templates ?? [];

  const merged = [
    ...uploaded.map((entry) => ({
      name: entry.templateName,
      label: formatTemplateLabel(entry.templateName),
      source: 'uploaded' as const,
      updatedAt: entry.updatedAt,
    })),
    ...builtIn
      .filter((name) => !uploadedNames.has(name))
      .map((name) => ({
        name,
        label: formatTemplateLabel(name),
        source: 'built-in' as const,
        updatedAt: null,
      })),
  ];

  return merged.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listAllTemplates(appConfig: AppConfig) {
  const uploaded = await templateStore.list();
  const uploadedByClient = uploaded.reduce<Record<string, Set<string>>>((acc, entry) => {
    acc[entry.clientKey] ??= new Set();
    acc[entry.clientKey].add(entry.templateName);
    return acc;
  }, {});

  const results = [];

  for (const [clientKey, clientConfig] of Object.entries(appConfig.clients)) {
    const templates = await listClientTemplates(appConfig, clientKey);
    results.push({
      key: clientKey,
      label: clientConfig.label,
      templates,
      uploadedCount: uploadedByClient[clientKey]?.size ?? 0,
    });
  }

  return results;
}

export function getPreviewLocals(
  appConfig: AppConfig,
  clientKey: string,
  templateName: string,
): Record<string, unknown> | null {
  const fixtures = appConfig.previewFixtures[templateName];
  if (!fixtures) return null;

  const clientConfig = appConfig.clients[clientKey];
  return {
    ...clientConfig.defaultLocals,
    ...fixtures,
    ...(clientConfig.previewOverrides?.[templateName] || {}),
  };
}

export function renderView(app: Application, view: string, locals: Record<string, unknown>): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    app.render(view, locals, (err: Error | null, html: string) => {
      if (err) reject(err);
      else resolve(html);
    });
  });
}

export async function renderTemplate(
  app: Application,
  appConfig: AppConfig,
  clientKey: string,
  templateName: string,
  locals: Record<string, unknown>,
): Promise<string> {
  const uploaded = await templateStore.get(clientKey, templateName);
  if (uploaded) {
    return ejs.render(uploaded, locals, { async: false });
  }

  const view = resolveTemplateView(appConfig, clientKey, templateName);
  if (!view) {
    throw new Error(`Template '${templateName}' not found for client '${clientKey}'`);
  }

  return renderView(app, view, locals);
}

export function formatTemplateLabel(templateName: string): string {
  return templateName
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export async function getPreviewCollections(appConfig: AppConfig) {
  const collections = await listAllTemplates(appConfig);
  return collections.map(({ key, label, templates }) => ({
    key,
    label,
    templates: templates.map(({ name, label: templateLabel }) => ({
      name,
      label: templateLabel,
    })),
  }));
}

export function getTemplateNames(appConfig: AppConfig): string[] {
  return Object.keys(appConfig.previewFixtures);
}

export { templateStore };

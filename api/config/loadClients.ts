import fs from 'fs';
import path from 'path';
import type { AppConfig, ClientConfig, DeploymentConfig, DeploymentTier, EmailMode, RateLimitConfig } from './types';

export const DEFAULT_CLIENT_KEY = 'default';
export const IDENTIFIER_PATTERN = /^[a-z0-9_-]+$/;

function getConfigRoot(): string {
  const candidates = [
    path.join(process.cwd(), 'config'),
    path.join(__dirname, '..', '..', 'config'),
    path.join(__dirname, '..', '..', '..', 'config'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.join(process.cwd(), 'config');
}

const CONFIG_ROOT = getConfigRoot();

function resolveEnvPlaceholders(value: string): string {
  return value.replace(/\{\{([A-Z0-9_]+)(?::([^}]*))?\}\}/g, (_match, envKey: string, fallback = '') => {
    return process.env[envKey] ?? fallback;
  });
}

function resolveLocals(locals: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(locals).map(([key, value]) => [key, resolveEnvPlaceholders(value)]));
}

function resolveFixtures(fixtures: Record<string, Record<string, unknown>>): Record<string, Record<string, unknown>> {
  const resolved: Record<string, Record<string, unknown>> = {};

  for (const [templateName, fixture] of Object.entries(fixtures)) {
    resolved[templateName] = Object.fromEntries(
      Object.entries(fixture).map(([key, value]) => {
        if (typeof value === 'string') {
          return [key, resolveEnvPlaceholders(value)];
        }
        return [key, value];
      }),
    );
  }

  return resolved;
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function loadClientConfig(filePath: string): ClientConfig {
  const raw = readJsonFile<ClientConfig>(filePath);
  return {
    ...raw,
    defaultLocals: resolveLocals(raw.defaultLocals),
  };
}

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseEmailMode(value: string | undefined, fallback: EmailMode): EmailMode {
  if (value === 'render' || value === 'send' || value === 'auto') {
    return value;
  }
  return fallback;
}

function parseRateLimit(value: string | undefined, fallback: RateLimitConfig): RateLimitConfig {
  if (!value) return fallback;

  try {
    const parsed = JSON.parse(value) as Partial<RateLimitConfig>;
    return {
      windowMs: parsed.windowMs ?? fallback.windowMs,
      max: parsed.max ?? fallback.max,
    };
  } catch {
    return fallback;
  }
}

function loadDeploymentDefaults(): DeploymentConfig {
  const sharedDefaults = readJsonFile<Omit<DeploymentConfig, 'previewEnabled'> & { previewEnabled?: boolean }>(
    path.join(CONFIG_ROOT, 'deployments', 'shared.json'),
  );

  return {
    ...sharedDefaults,
    previewEnabled: sharedDefaults.previewEnabled ?? true,
  };
}

function loadDedicatedDefaults(clientKey: string): DeploymentConfig | null {
  const dedicatedPath = path.join(CONFIG_ROOT, 'deployments', `${clientKey}.json`);
  if (!fs.existsSync(dedicatedPath)) return null;

  const defaults = readJsonFile<Omit<DeploymentConfig, 'previewEnabled'> & { previewEnabled?: boolean }>(dedicatedPath);
  return {
    ...defaults,
    previewEnabled: defaults.previewEnabled ?? false,
  };
}

function resolveDeploymentConfig(): DeploymentConfig {
  const sharedDefaults = loadDeploymentDefaults();
  const tier = (process.env.DEPLOYMENT_TIER as DeploymentTier | undefined) ?? sharedDefaults.tier;
  const dedicatedClientKey = process.env.CLIENT_KEY?.trim();

  if (tier === 'dedicated') {
    if (!dedicatedClientKey) {
      throw new Error('CLIENT_KEY is required when DEPLOYMENT_TIER=dedicated');
    }

    const dedicatedDefaults = loadDedicatedDefaults(dedicatedClientKey);
    const base = dedicatedDefaults ?? {
      tier: 'dedicated' as const,
      clientKey: dedicatedClientKey,
      emailMode: 'send' as const,
      rateLimit: { windowMs: 86400000, max: 10000 },
      previewEnabled: false,
    };

    return {
      tier: 'dedicated',
      clientKey: dedicatedClientKey,
      emailMode: parseEmailMode(process.env.EMAIL_MODE, base.emailMode),
      rateLimit: parseRateLimit(process.env.RATE_LIMIT, base.rateLimit),
      previewEnabled: process.env.PREVIEW_ENABLED === 'true' ? true : process.env.PREVIEW_ENABLED === 'false' ? false : base.previewEnabled,
    };
  }

  const allowedClients = parseCsv(process.env.ALLOWED_CLIENTS);
  return {
    tier: 'shared',
    allowedClients: allowedClients.length > 0 ? allowedClients : sharedDefaults.allowedClients,
    emailMode: parseEmailMode(process.env.EMAIL_MODE, sharedDefaults.emailMode),
    rateLimit: parseRateLimit(process.env.RATE_LIMIT, sharedDefaults.rateLimit),
    previewEnabled: process.env.PREVIEW_ENABLED === 'false' ? false : sharedDefaults.previewEnabled ?? true,
  };
}

export function loadAppConfig(): AppConfig {
  const deployment = resolveDeploymentConfig();
  const clientsDir = path.join(CONFIG_ROOT, 'clients');
  const clientFiles = fs.readdirSync(clientsDir).filter((file) => file.endsWith('.json'));
  const allClients = Object.fromEntries(
    clientFiles.map((file) => {
      const client = loadClientConfig(path.join(clientsDir, file));
      return [client.key, client];
    }),
  );

  const allowedClientKeys =
    deployment.tier === 'dedicated'
      ? [deployment.clientKey!]
      : deployment.allowedClients ?? Object.keys(allClients);

  const clients = Object.fromEntries(
    allowedClientKeys
      .filter((clientKey) => allClients[clientKey])
      .map((clientKey) => [clientKey, allClients[clientKey]]),
  );

  if (deployment.tier === 'dedicated' && !clients[deployment.clientKey!]) {
    throw new Error(`Dedicated deployment client '${deployment.clientKey}' was not found in config/clients`);
  }

  const previewFixtures = resolveFixtures(readJsonFile(path.join(CONFIG_ROOT, 'preview-fixtures.json')));

  return {
    deployment,
    clients,
    previewFixtures,
    defaultClientKey: DEFAULT_CLIENT_KEY in clients ? DEFAULT_CLIENT_KEY : allowedClientKeys[0],
  };
}

export function normalizeIdentifier(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  return IDENTIFIER_PATTERN.test(normalized) ? normalized : null;
}

export function resolveClientKey(
  value: unknown,
  appConfig: AppConfig,
): { clientKey?: string; error?: string; status?: number } {
  const { deployment, clients, defaultClientKey } = appConfig;

  if (deployment.tier === 'dedicated') {
    const dedicatedKey = deployment.clientKey!;
    if (value === undefined || value === null || value === '') {
      return { clientKey: dedicatedKey };
    }

    const requestedKey = normalizeIdentifier(value);
    if (!requestedKey) {
      return { error: 'Invalid client. Use lowercase letters, numbers, hyphens, or underscores.', status: 400 };
    }

    if (requestedKey !== dedicatedKey) {
      return { error: `This deployment only serves client '${dedicatedKey}'.`, status: 403 };
    }

    return { clientKey: dedicatedKey };
  }

  if (value === undefined || value === null || value === '') {
    return { clientKey: defaultClientKey in clients ? defaultClientKey : Object.keys(clients)[0] };
  }

  const clientKey = normalizeIdentifier(value);
  if (!clientKey) {
    return { error: 'Invalid client. Use lowercase letters, numbers, hyphens, or underscores.', status: 400 };
  }

  if (!clients[clientKey]) {
    return { error: `Unknown client '${String(value)}'.`, status: 400 };
  }

  return { clientKey };
}

export function resolveTemplateName(value: unknown): { templateName?: string; error?: string } {
  const templateName = normalizeIdentifier(value);
  if (!templateName) {
    return { error: 'Invalid template_name. Use lowercase letters, numbers, hyphens, or underscores.' };
  }

  return { templateName };
}

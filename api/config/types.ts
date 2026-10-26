export type DeploymentTier = 'shared' | 'dedicated';
export type EmailMode = 'render' | 'send' | 'auto';

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export interface ClientConfig {
  key: string;
  label: string;
  viewRoot: string;
  templates: string[];
  defaultLocals: Record<string, string>;
  previewOverrides?: Record<string, Record<string, unknown>>;
  rateLimit?: RateLimitConfig;
}

export interface DeploymentConfig {
  tier: DeploymentTier;
  allowedClients?: string[];
  clientKey?: string;
  emailMode: EmailMode;
  rateLimit: RateLimitConfig;
  previewEnabled: boolean;
}

export interface AppConfig {
  deployment: DeploymentConfig;
  clients: Record<string, ClientConfig>;
  previewFixtures: Record<string, Record<string, unknown>>;
  defaultClientKey: string;
}

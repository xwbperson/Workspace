import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  appOrigin: string;
  databaseUrl: string;
  databaseInMemory: boolean;
  workbenchRoot: string;
  workspaceId: string;
  cookieSecure: boolean;
  logLevel: string;
  version: string;
}

export type ConfigOverrides = Partial<AppConfig>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`布尔配置只能是 true 或 false，收到：${value}`);
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('API_PORT 必须是 1–65535 之间的整数。');
  }
  return port;
}

function loadLocalEnv(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (existsSync(envPath)) loadEnvFile(envPath);
}

export function databaseUrlWithPasswordFile(databaseUrl: string, passwordFile: string): string {
  const password = readFileSync(passwordFile, 'utf8').trim();
  if (!password) throw new Error('数据库密码文件不能为空。');
  const url = new URL(databaseUrl);
  url.password = password;
  return url.toString();
}

function resolveDatabaseUrl(override: string | undefined): string {
  const raw =
    override ??
    process.env.DATABASE_URL ??
    'postgres://workbench:workbench@127.0.0.1:5432/workbench';
  const passwordFile = process.env.DATABASE_PASSWORD_FILE;
  if (!passwordFile) return raw;
  return databaseUrlWithPasswordFile(raw, passwordFile);
}

export function loadConfig(overrides: ConfigOverrides = {}): AppConfig {
  loadLocalEnv();
  const rawNodeEnv = overrides.nodeEnv ?? process.env.NODE_ENV ?? 'development';
  if (!['development', 'test', 'production'].includes(rawNodeEnv)) {
    throw new Error(`不支持的 NODE_ENV：${rawNodeEnv}`);
  }

  const nodeEnv = rawNodeEnv as AppConfig['nodeEnv'];
  const workspaceId =
    overrides.workspaceId ?? process.env.WORKBENCH_ID ?? '00000000-0000-4000-8000-000000000001';
  if (!UUID_PATTERN.test(workspaceId)) throw new Error('WORKBENCH_ID 必须是有效 UUID。');

  const appOrigin = overrides.appOrigin ?? process.env.APP_ORIGIN ?? 'http://localhost:5173';
  const origin = new URL(appOrigin);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== appOrigin) {
    throw new Error('APP_ORIGIN 必须是只包含协议、主机和端口的 HTTP(S) Origin。');
  }

  const databaseInMemory =
    overrides.databaseInMemory ?? parseBoolean(process.env.DATABASE_IN_MEMORY, false);
  if (databaseInMemory && nodeEnv !== 'test') {
    throw new Error('内存数据库只允许在 NODE_ENV=test 时使用。');
  }

  const config: AppConfig = {
    nodeEnv,
    host: overrides.host ?? process.env.API_HOST ?? '127.0.0.1',
    port: overrides.port ?? parsePort(process.env.API_PORT),
    appOrigin,
    databaseUrl: resolveDatabaseUrl(overrides.databaseUrl),
    databaseInMemory,
    workbenchRoot: resolve(overrides.workbenchRoot ?? process.env.WORKBENCH_ROOT ?? './.workbench'),
    workspaceId,
    cookieSecure:
      overrides.cookieSecure ?? parseBoolean(process.env.COOKIE_SECURE, nodeEnv === 'production'),
    logLevel: overrides.logLevel ?? process.env.LOG_LEVEL ?? 'info',
    version: overrides.version ?? process.env.npm_package_version ?? '0.1.0',
  };

  if (config.nodeEnv === 'production' && !config.cookieSecure) {
    throw new Error('生产环境必须启用 Secure Session Cookie。');
  }
  if (config.nodeEnv === 'production' && !config.appOrigin.startsWith('https://')) {
    throw new Error('生产环境 APP_ORIGIN 必须使用 HTTPS。');
  }
  return config;
}

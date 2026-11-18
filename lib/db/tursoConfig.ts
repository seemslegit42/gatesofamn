import path from 'node:path';

export type DbMode = 'turso-cloud' | 'turso-replica' | 'libsql-local';

export interface TursoConnectionConfig {
  mode: DbMode;
  url: string;
  syncUrl?: string;
  syncInterval?: number;
  authToken?: string;
  warnings: string[];
}

const REMOTE_PROTOCOLS = ['libsql:', 'https:', 'http:', 'wss:', 'ws:', 'turso:'];

export function isRemoteUrl(rawUrl: string): boolean {
  const lower = rawUrl.trim().toLowerCase();
  return REMOTE_PROTOCOLS.some((p) => lower.startsWith(p));
}

export function normalizeLibsqlUrl(rawUrl: string): { url: string; convertedFromTursoScheme: boolean } {
  const trimmed = rawUrl.trim();
  if (trimmed.toLowerCase().startsWith('turso://')) {
    return {
      url: `libsql://${trimmed.slice('turso://'.length)}`,
      convertedFromTursoScheme: true,
    };
  }
  return { url: trimmed, convertedFromTursoScheme: false };
}

export function resolveTursoConnectionConfig(
  env: Record<string, string | undefined>,
  dataDir: string = path.join(process.cwd(), 'data'),
): TursoConnectionConfig {
  const rawDbUrl = env.TURSO_DATABASE_URL?.trim() || '';
  const rawSyncUrl = env.TURSO_SYNC_URL?.trim() || '';
  const authToken = env.TURSO_AUTH_TOKEN?.trim() || undefined;
  const warnings: string[] = [];

  const localDefaultPath = `file:${path.join(dataDir, 'aethergate.db')}`;
  const localReplicaPath = `file:${path.join(dataDir, 'aethergate-replica.db')}`;

  if (rawSyncUrl) {
    const normalizedSync = normalizeLibsqlUrl(rawSyncUrl);
    if (normalizedSync.convertedFromTursoScheme) {
      warnings.push('Converted turso:// sync URL to libsql:// for @libsql/client.');
    }

    // Embedded Replica mode: url MUST be a local file path, never a remote libsql:// URL.
    let localUrl = localReplicaPath;
    if (rawDbUrl) {
      if (rawDbUrl.toLowerCase().startsWith('file:')) {
        localUrl = rawDbUrl;
      } else if (isRemoteUrl(rawDbUrl)) {
        warnings.push(
          'TURSO_SYNC_URL is set alongside a remote TURSO_DATABASE_URL; automatically routing local replica to file:./data/aethergate-replica.db to avoid duplicate libsql:// URL conflict.',
        );
      } else {
        localUrl = `file:${rawDbUrl}`;
      }
    }

    return {
      mode: 'turso-replica',
      url: localUrl,
      syncUrl: normalizedSync.url,
      syncInterval: 60,
      authToken,
      warnings,
    };
  }

  if (rawDbUrl) {
    const normalizedDb = normalizeLibsqlUrl(rawDbUrl);
    if (normalizedDb.convertedFromTursoScheme) {
      warnings.push('Converted turso:// database URL to libsql:// for @libsql/client.');
    }

    if (normalizedDb.url.toLowerCase().startsWith('file:') || normalizedDb.url === ':memory:') {
      return {
        mode: 'libsql-local',
        url: normalizedDb.url,
        warnings,
      };
    }

    if (isRemoteUrl(normalizedDb.url)) {
      return {
        mode: 'turso-cloud',
        url: normalizedDb.url,
        authToken,
        warnings,
      };
    }

    return {
      mode: 'libsql-local',
      url: `file:${normalizedDb.url}`,
      warnings,
    };
  }

  return {
    mode: 'libsql-local',
    url: localDefaultPath,
    warnings,
  };
}

export function classifyLibsqlError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes('401') || lower.includes('403') || lower.includes('unauthorized') || lower.includes('forbidden')) {
    return `Turso auth/permission error (401/403): check that TURSO_AUTH_TOKEN is a valid read-write token (turso db tokens create <db-name>). Original: ${msg}`;
  }
  if (lower.includes('no such table')) {
    return `Remote Turso schema missing (no such table): schema auto-migration will run. Original: ${msg}`;
  }
  if (lower.includes('url_invalid') || lower.includes('syncurl') || lower.includes('url_scheme_not_supported')) {
    return `Turso URL configuration error: use file:local.db with TURSO_SYNC_URL=libsql://... for replicas, or libsql://... for cloud. Original: ${msg}`;
  }
  return msg;
}

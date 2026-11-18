import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyLibsqlError,
  normalizeLibsqlUrl,
  resolveTursoConnectionConfig,
} from './tursoConfig.ts';

test('defaults to local libSQL file when no Turso env vars are set', () => {
  const cfg = resolveTursoConnectionConfig({}, '/tmp/aethergate-data');
  assert.equal(cfg.mode, 'libsql-local');
  assert.equal(cfg.url, 'file:/tmp/aethergate-data/aethergate.db');
  assert.equal(cfg.syncUrl, undefined);
});

test('prevents duplicate libsql:// URL crash when both TURSO_DATABASE_URL and TURSO_SYNC_URL are remote', () => {
  const cfg = resolveTursoConnectionConfig(
    {
      TURSO_DATABASE_URL: 'libsql://solis-db.turso.io',
      TURSO_SYNC_URL: 'libsql://solis-db.turso.io',
      TURSO_AUTH_TOKEN: 'rw-token',
    },
    '/tmp/aethergate-data',
  );
  assert.equal(cfg.mode, 'turso-replica');
  assert.equal(cfg.url, 'file:/tmp/aethergate-data/aethergate-replica.db');
  assert.equal(cfg.syncUrl, 'libsql://solis-db.turso.io');
  assert.equal(cfg.authToken, 'rw-token');
  assert.equal(cfg.warnings.length, 1);
});

test('preserves explicit file: local path in Embedded Replica mode', () => {
  const cfg = resolveTursoConnectionConfig(
    {
      TURSO_DATABASE_URL: 'file:./local-replica.db',
      TURSO_SYNC_URL: 'libsql://solis-db.turso.io',
      TURSO_AUTH_TOKEN: 'rw-token',
    },
    '/tmp/aethergate-data',
  );
  assert.equal(cfg.mode, 'turso-replica');
  assert.equal(cfg.url, 'file:./local-replica.db');
  assert.equal(cfg.syncUrl, 'libsql://solis-db.turso.io');
  assert.equal(cfg.warnings.length, 0);
});

test('converts turso:// URL scheme to libsql:// for @libsql/client compatibility', () => {
  const normalized = normalizeLibsqlUrl('turso://my-realm-org.turso.io');
  assert.equal(normalized.url, 'libsql://my-realm-org.turso.io');
  assert.equal(normalized.convertedFromTursoScheme, true);

  const cfg = resolveTursoConnectionConfig(
    {
      TURSO_DATABASE_URL: 'turso://my-realm-org.turso.io',
      TURSO_AUTH_TOKEN: 'tok',
    },
    '/tmp/aethergate-data',
  );
  assert.equal(cfg.mode, 'turso-cloud');
  assert.equal(cfg.url, 'libsql://my-realm-org.turso.io');
});

test('classifies 401/403 auth, missing schema, and syncUrl errors clearly', () => {
  assert.match(classifyLibsqlError(new Error('HTTP status 401: UNAUTHORIZED')), /401\/403/);
  assert.match(classifyLibsqlError(new Error('SQLITE_ERROR: no such table: players')), /schema missing/);
  assert.match(classifyLibsqlError(new Error('LibsqlError: URL_INVALID')), /URL configuration error/);
});

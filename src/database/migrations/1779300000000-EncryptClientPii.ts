import { MigrationInterface, QueryRunner } from 'typeorm';
import { createHmac } from 'node:crypto';

/**
 * Encrypts client PII columns:
 *  - Widens name/nino/postcode/email/phone to VARCHAR(500) for AES-256-GCM ciphertext
 *  - Adds nino_hash VARCHAR(64) for deterministic uniqueness checks
 *  - Backfills nino_hash for existing plaintext rows
 *  - Replaces the plaintext NINO unique index with one on (tenant_id, nino_hash)
 *
 * All DDL steps are guarded with IF NOT EXISTS / IF EXISTS so the migration
 * is safe to re-run after a partial failure (MySQL DDL does not fully roll back).
 */
export class EncryptClientPii1779300000000 implements MigrationInterface {
  private hash(value: string): string {
    const key = process.env.HMRC_ENCRYPTION_KEY ?? 'dev-hash-fallback';
    return createHmac('sha256', key).update(value.toUpperCase()).digest('hex');
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const db = queryRunner.connection.options.database as string;

    // ── 1. Widen PII columns (skip if already widened) ──────────────────
    const cols = await queryRunner.query(
      `SELECT COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'clients'
         AND COLUMN_NAME IN ('name','nino','postcode','email','phone')`,
      [db],
    );
    const needsWiden = cols.some(
      (c: { COLUMN_NAME: string; CHARACTER_MAXIMUM_LENGTH: number }) =>
        c.CHARACTER_MAXIMUM_LENGTH < 500,
    );
    if (needsWiden) {
      await queryRunner.query(`ALTER TABLE clients MODIFY COLUMN name VARCHAR(500) NOT NULL`);
      await queryRunner.query(`ALTER TABLE clients MODIFY COLUMN nino VARCHAR(500) NOT NULL`);
      await queryRunner.query(`ALTER TABLE clients MODIFY COLUMN postcode VARCHAR(500) NOT NULL`);
      await queryRunner.query(`ALTER TABLE clients MODIFY COLUMN email VARCHAR(500) NOT NULL`);
      await queryRunner.query(`ALTER TABLE clients MODIFY COLUMN phone VARCHAR(500) NULL`);
    }

    // ── 2. Add nino_hash column if missing ──────────────────────────────
    const ninoHashCol = await queryRunner.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'nino_hash'`,
      [db],
    );
    if (ninoHashCol.length === 0) {
      await queryRunner.query(
        `ALTER TABLE clients ADD COLUMN nino_hash VARCHAR(64) NOT NULL DEFAULT '' AFTER nino`,
      );
    }

    // ── 3. Backfill nino_hash for every row that still has empty hash ───
    const rows: { id: string; nino: string }[] = await queryRunner.query(
      `SELECT id, nino FROM clients WHERE nino_hash = ''`,
    );
    for (const row of rows) {
      // At migration time the NINO is still stored as plaintext — hash it directly.
      const hash = this.hash(row.nino.replace(/\s/g, '').toUpperCase());
      await queryRunner.query(`UPDATE clients SET nino_hash = ? WHERE id = ?`, [hash, row.id]);
    }

    // ── 4. Drop old plaintext unique index if it exists ─────────────────
    const oldIdx = await queryRunner.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'clients' AND INDEX_NAME = 'UQ_clients_tenant_nino'`,
      [db],
    );
    if (oldIdx.length > 0) {
      await queryRunner.query(`DROP INDEX UQ_clients_tenant_nino ON clients`);
    }

    // ── 5. Create new unique index on (tenant_id, nino_hash) ─────────────
    const newIdx = await queryRunner.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'clients' AND INDEX_NAME = 'UQ_clients_tenant_nino_hash'`,
      [db],
    );
    if (newIdx.length === 0) {
      await queryRunner.query(
        `CREATE UNIQUE INDEX UQ_clients_tenant_nino_hash ON clients (tenant_id, nino_hash)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const db = queryRunner.connection.options.database as string;

    const newIdx = await queryRunner.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'clients' AND INDEX_NAME = 'UQ_clients_tenant_nino_hash'`,
      [db],
    );
    if (newIdx.length > 0) {
      await queryRunner.query(`DROP INDEX UQ_clients_tenant_nino_hash ON clients`);
    }

    const ninoHashCol = await queryRunner.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'nino_hash'`,
      [db],
    );
    if (ninoHashCol.length > 0) {
      await queryRunner.query(`ALTER TABLE clients DROP COLUMN nino_hash`);
    }

    await queryRunner.query(`ALTER TABLE clients MODIFY COLUMN name VARCHAR(200) NOT NULL`);
    await queryRunner.query(`ALTER TABLE clients MODIFY COLUMN nino VARCHAR(10) NOT NULL`);
    await queryRunner.query(`ALTER TABLE clients MODIFY COLUMN postcode VARCHAR(20) NOT NULL`);
    await queryRunner.query(`ALTER TABLE clients MODIFY COLUMN email VARCHAR(255) NOT NULL`);
    await queryRunner.query(`ALTER TABLE clients MODIFY COLUMN phone VARCHAR(30) NULL`);

    const oldIdx = await queryRunner.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'clients' AND INDEX_NAME = 'UQ_clients_tenant_nino'`,
      [db],
    );
    if (oldIdx.length === 0) {
      await queryRunner.query(
        `CREATE UNIQUE INDEX UQ_clients_tenant_nino ON clients (tenant_id, nino)`,
      );
    }
  }
}

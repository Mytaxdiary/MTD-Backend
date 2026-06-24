import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChaseLogsAndWorkflowType1779400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add workflow_type column to clients (nullable, defaults to 'bookkeeping')
    const rows = await queryRunner.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'workflow_type'`,
    );
    if ((rows as unknown[]).length === 0) {
      await queryRunner.query(`
        ALTER TABLE \`clients\`
        ADD COLUMN \`workflow_type\` VARCHAR(20) NULL DEFAULT NULL
        AFTER \`authorised_at\`
      `);
    }

    // 2. Create chase_logs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`chase_logs\` (
        \`id\`          VARCHAR(36)   NOT NULL,
        \`createdAt\`   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\`   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deletedAt\`   DATETIME(6)   NULL,
        \`tenant_id\`   VARCHAR(36)   NOT NULL,
        \`client_id\`   VARCHAR(36)   NOT NULL,
        \`template_id\` VARCHAR(36)   NULL,
        \`channel\`     VARCHAR(10)   NOT NULL DEFAULT 'email',
        \`subject\`     VARCHAR(500)  NOT NULL,
        \`body\`        TEXT          NOT NULL,
        \`status\`      VARCHAR(20)   NOT NULL DEFAULT 'sent',
        \`sent_at\`     DATETIME      NOT NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_chase_logs_tenant_id\`  (\`tenant_id\`),
        INDEX \`IDX_chase_logs_client_id\`  (\`client_id\`),
        CONSTRAINT \`FK_chase_logs_tenant\`
          FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_chase_logs_client\`
          FOREIGN KEY (\`client_id\`) REFERENCES \`clients\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`chase_logs\``);
    await queryRunner.query(
      `ALTER TABLE \`clients\` DROP COLUMN IF EXISTS \`workflow_type\``,
    );
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientPipelineStatusHistory1780500000000 implements MigrationInterface {
  name = 'AddClientPipelineStatusHistory1780500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`clients\` ADD \`pipeline_status\` varchar(32) NOT NULL DEFAULT 'pending-invite'`,
    );

    // Backfill: authorised → not-started; any chase log → chased (submitted syncs later via dashboard).
    await queryRunner.query(
      `UPDATE \`clients\` SET \`pipeline_status\` = 'not-started' WHERE \`authorised_at\` IS NOT NULL`,
    );
    await queryRunner.query(`
      UPDATE \`clients\` c
      SET c.\`pipeline_status\` = 'chased'
      WHERE c.\`authorised_at\` IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM \`chase_logs\` cl
          WHERE cl.\`client_id\` = c.\`id\` AND cl.\`deletedAt\` IS NULL
        )
    `);

    await queryRunner.query(`
      CREATE TABLE \`client_status_history\` (
        \`id\` varchar(36) NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deletedAt\` datetime(6) NULL,
        \`tenant_id\` varchar(36) NOT NULL,
        \`client_id\` varchar(36) NOT NULL,
        \`from_status\` varchar(32) NULL,
        \`to_status\` varchar(32) NOT NULL,
        \`changed_by_user_id\` varchar(36) NULL,
        \`source\` varchar(16) NOT NULL DEFAULT 'system',
        INDEX \`IDX_client_status_history_client_id\` (\`client_id\`),
        INDEX \`IDX_client_status_history_tenant_id\` (\`tenant_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    // Seed initial history rows from current status so audit is never empty for existing clients.
    await queryRunner.query(`
      INSERT INTO \`client_status_history\` (\`id\`, \`tenant_id\`, \`client_id\`, \`from_status\`, \`to_status\`, \`source\`)
      SELECT UUID(), \`tenant_id\`, \`id\`, NULL, \`pipeline_status\`, 'system'
      FROM \`clients\`
      WHERE \`deletedAt\` IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`client_status_history\``);
    await queryRunner.query(`ALTER TABLE \`clients\` DROP COLUMN \`pipeline_status\``);
  }
}

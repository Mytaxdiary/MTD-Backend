import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminAuditLogs1781800000000 implements MigrationInterface {
  name = 'AddAdminAuditLogs1781800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`admin_audit_logs\` (
        \`id\` varchar(36) NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deletedAt\` datetime(6) NULL,
        \`actor_user_id\` varchar(36) NOT NULL,
        \`actor_email\` varchar(255) NULL,
        \`action\` varchar(64) NOT NULL,
        \`target_type\` varchar(32) NOT NULL,
        \`target_id\` varchar(36) NOT NULL,
        \`target_label\` varchar(255) NULL,
        \`summary\` varchar(500) NOT NULL,
        \`metadata\` json NULL,
        INDEX \`IDX_admin_audit_logs_created_at\` (\`createdAt\`),
        INDEX \`IDX_admin_audit_logs_action\` (\`action\`),
        INDEX \`IDX_admin_audit_logs_actor_user_id\` (\`actor_user_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`admin_audit_logs\``);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSystemErrorLogs1782500000000 implements MigrationInterface {
  name = 'AddSystemErrorLogs1782500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`system_error_logs\` (
        \`id\` varchar(36) NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deletedAt\` datetime(6) NULL,
        \`source\` varchar(32) NOT NULL,
        \`endpoint\` varchar(500) NOT NULL,
        \`http_method\` varchar(16) NULL,
        \`status_code\` int NULL,
        \`message\` varchar(1000) NOT NULL,
        \`client_id\` varchar(36) NULL,
        \`client_label\` varchar(255) NULL,
        \`tenant_id\` varchar(36) NULL,
        \`tenant_label\` varchar(255) NULL,
        \`user_id\` varchar(36) NULL,
        \`metadata\` json NULL,
        INDEX \`IDX_system_error_logs_created_at\` (\`createdAt\`),
        INDEX \`IDX_system_error_logs_source\` (\`source\`),
        INDEX \`IDX_system_error_logs_status_code\` (\`status_code\`),
        INDEX \`IDX_system_error_logs_tenant_id\` (\`tenant_id\`),
        INDEX \`IDX_system_error_logs_client_id\` (\`client_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`system_error_logs\``);
  }
}

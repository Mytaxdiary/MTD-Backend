import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeletionRequests1780100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`deletion_requests\` (
        \`id\`               VARCHAR(36)   NOT NULL,
        \`createdAt\`        DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\`        DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deletedAt\`        DATETIME(6)   NULL,
        \`user_id\`          VARCHAR(36)   NOT NULL,
        \`tenant_id\`        VARCHAR(36)   NOT NULL,
        \`status\`           VARCHAR(20)   NOT NULL DEFAULT 'pending',
        \`execute_at\`       DATETIME      NOT NULL,
        \`executed_at\`      DATETIME      NULL,
        \`requester_email\`  VARCHAR(255)  NOT NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_deletion_requests_user\`   (\`user_id\`),
        INDEX \`idx_deletion_requests_status\` (\`status\`, \`execute_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`deletion_requests\``);
  }
}

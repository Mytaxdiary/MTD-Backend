import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAppNotifications1779600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`app_notifications\` (
        \`id\`          VARCHAR(36)   NOT NULL,
        \`createdAt\`   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\`   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deletedAt\`   DATETIME(6)   NULL,
        \`tenant_id\`   VARCHAR(36)   NOT NULL,
        \`type\`        VARCHAR(50)   NOT NULL,
        \`title\`       VARCHAR(300)  NOT NULL,
        \`body\`        VARCHAR(1000) NOT NULL,
        \`client_id\`   VARCHAR(36)   NULL,
        \`read_at\`     DATETIME(6)   NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_app_notifications_tenant_id\` (\`tenant_id\`),
        INDEX \`IDX_app_notifications_read_at\`   (\`read_at\`),
        CONSTRAINT \`FK_app_notifications_tenant\`
          FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`app_notifications\``);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHmrcConnections1778600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`hmrc_connections\` (
        \`id\`                        VARCHAR(36)   NOT NULL,
        \`createdAt\`                  DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\`                  DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deletedAt\`                  DATETIME(6)   NULL,
        \`tenant_id\`                  VARCHAR(36)   NOT NULL UNIQUE,
        \`access_token\`               TEXT          NOT NULL,
        \`refresh_token\`              TEXT          NOT NULL,
        \`access_token_expires_at\`    DATETIME      NOT NULL,
        \`refresh_token_expires_at\`   DATETIME      NULL,
        \`connected_at\`               DATETIME      NOT NULL,
        \`status\`                     VARCHAR(20)   NOT NULL DEFAULT 'connected',
        \`scope\`                      VARCHAR(500)  NULL,
        \`arn\`                        VARCHAR(100)  NULL,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_hmrc_conn_tenant_id\`
          FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`hmrc_connections\``);
  }
}

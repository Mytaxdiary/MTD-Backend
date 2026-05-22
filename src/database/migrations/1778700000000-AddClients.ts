import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClients1778700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`clients\` (
        \`id\`                    VARCHAR(36)   NOT NULL,
        \`createdAt\`              DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\`              DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deletedAt\`              DATETIME(6)   NULL,
        \`tenant_id\`              VARCHAR(36)   NOT NULL,
        \`name\`                   VARCHAR(200)  NOT NULL,
        \`nino\`                   VARCHAR(10)   NOT NULL,
        \`postcode\`               VARCHAR(20)   NOT NULL,
        \`email\`                  VARCHAR(255)  NOT NULL,
        \`phone\`                  VARCHAR(30)   NULL,
        \`agent_type\`             VARCHAR(20)   NOT NULL DEFAULT 'main',
        \`invitation_id\`          VARCHAR(100)  NULL,
        \`invitation_status\`      VARCHAR(20)   NOT NULL DEFAULT 'pending',
        \`invitation_sent_at\`     DATETIME      NULL,
        \`invitation_expires_at\`  DATETIME      NULL,
        \`authorised_at\`          DATETIME      NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_clients_tenant_id\` (\`tenant_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`clients\``);
  }
}

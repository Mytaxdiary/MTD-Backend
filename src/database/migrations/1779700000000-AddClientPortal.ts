import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientPortal1779700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Client portal user accounts — one per client
    await queryRunner.query(`
      CREATE TABLE \`client_users\` (
        \`id\`                        VARCHAR(36)   NOT NULL,
        \`createdAt\`                 DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\`                 DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deletedAt\`                 DATETIME(6)   NULL,
        \`tenant_id\`                 VARCHAR(36)   NOT NULL,
        \`client_id\`                 VARCHAR(36)   NOT NULL,
        \`email\`                     VARCHAR(500)  NOT NULL,
        \`password_hash\`             VARCHAR(255)  NULL,
        \`portal_setup_token\`        VARCHAR(100)  NULL,
        \`portal_setup_token_expires_at\` DATETIME(6) NULL,
        \`is_active\`                 TINYINT(1)    NOT NULL DEFAULT 0,
        \`last_login_at\`             DATETIME(6)   NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_client_users_client_id\` (\`client_id\`),
        INDEX \`IDX_client_users_tenant_id\`  (\`tenant_id\`),
        INDEX \`IDX_client_users_setup_token\` (\`portal_setup_token\`),
        CONSTRAINT \`FK_client_users_tenant\`
          FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_client_users_client\`
          FOREIGN KEY (\`client_id\`) REFERENCES \`clients\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Agent-to-client portal messages
    await queryRunner.query(`
      CREATE TABLE \`portal_messages\` (
        \`id\`          VARCHAR(36)    NOT NULL,
        \`createdAt\`   DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\`   DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deletedAt\`   DATETIME(6)    NULL,
        \`tenant_id\`   VARCHAR(36)    NOT NULL,
        \`client_id\`   VARCHAR(36)    NOT NULL,
        \`subject\`     VARCHAR(300)   NOT NULL,
        \`body\`        TEXT           NOT NULL,
        \`read_at\`     DATETIME(6)    NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_portal_messages_client_id\` (\`client_id\`),
        INDEX \`IDX_portal_messages_tenant_id\` (\`tenant_id\`),
        CONSTRAINT \`FK_portal_messages_tenant\`
          FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_portal_messages_client\`
          FOREIGN KEY (\`client_id\`) REFERENCES \`clients\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`portal_messages\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`client_users\``);
  }
}

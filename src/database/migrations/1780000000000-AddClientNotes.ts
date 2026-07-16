import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientNotes1780000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`client_notes\` (
        \`id\`          VARCHAR(36)   NOT NULL,
        \`createdAt\`   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\`   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deletedAt\`   DATETIME(6)   NULL,
        \`tenant_id\`   VARCHAR(36)   NOT NULL,
        \`client_id\`   VARCHAR(36)   NOT NULL,
        \`text\`        TEXT          NOT NULL,
        \`author_name\` VARCHAR(200)  NOT NULL,
        \`is_pinned\`   TINYINT(1)    NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_client_notes_client_id\` (\`client_id\`),
        INDEX \`IDX_client_notes_tenant_id\` (\`tenant_id\`),
        CONSTRAINT \`FK_client_notes_client\`
          FOREIGN KEY (\`client_id\`) REFERENCES \`clients\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`client_notes\``);
  }
}

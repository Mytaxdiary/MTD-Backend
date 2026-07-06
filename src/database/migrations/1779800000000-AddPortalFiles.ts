import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPortalFiles1779800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`portal_files\` (
        \`id\`             VARCHAR(36)   NOT NULL,
        \`createdAt\`      DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\`      DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deletedAt\`      DATETIME(6)   NULL,
        \`tenant_id\`      VARCHAR(36)   NOT NULL,
        \`client_id\`      VARCHAR(36)   NOT NULL,
        \`original_name\`  VARCHAR(500)  NOT NULL,
        \`mime_type\`      VARCHAR(100)  NOT NULL,
        \`size\`           INT UNSIGNED  NOT NULL,
        \`storage_path\`   VARCHAR(1000) NOT NULL,
        \`viewed_by_agent\`  TINYINT(1)  NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_portal_files_client_id\` (\`client_id\`),
        INDEX \`IDX_portal_files_tenant_id\` (\`tenant_id\`),
        CONSTRAINT \`FK_portal_files_tenant\`
          FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_portal_files_client\`
          FOREIGN KEY (\`client_id\`) REFERENCES \`clients\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`portal_files\``);
  }
}

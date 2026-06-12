import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChaseTemplates1779100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`chase_templates\` (
        \`id\`          VARCHAR(36)   NOT NULL,
        \`createdAt\`   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\`   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deletedAt\`   DATETIME(6)   NULL,
        \`tenant_id\`   VARCHAR(36)   NOT NULL,
        \`name\`        VARCHAR(200)  NOT NULL,
        \`type\`        VARCHAR(50)   NOT NULL,
        \`subject\`     VARCHAR(500)  NOT NULL,
        \`body\`        TEXT          NOT NULL,
        \`is_default\`  BOOLEAN       NOT NULL DEFAULT FALSE,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_chase_templates_tenant_id\` (\`tenant_id\`),
        CONSTRAINT \`FK_chase_templates_tenant\`
          FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`chase_templates\``);
  }
}

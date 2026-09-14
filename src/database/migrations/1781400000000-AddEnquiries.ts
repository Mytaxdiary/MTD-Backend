import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEnquiries1781400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`enquiries\` (
        \`id\`              VARCHAR(36)   NOT NULL,
        \`createdAt\`       DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\`       DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deletedAt\`       DATETIME(6)   NULL,
        \`name\`            VARCHAR(120)  NOT NULL,
        \`firm\`            VARCHAR(200)  NOT NULL,
        \`email\`           VARCHAR(255)  NOT NULL,
        \`phone\`           VARCHAR(40)   NULL,
        \`message\`         TEXT          NOT NULL,
        \`source_page\`     VARCHAR(120)  NULL,
        \`plan_interest\`   VARCHAR(40)   NULL,
        \`status\`          VARCHAR(20)   NOT NULL DEFAULT 'new',
        \`internal_note\`   TEXT          NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_enquiries_email\` (\`email\`),
        INDEX \`idx_enquiries_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`enquiries\``);
  }
}

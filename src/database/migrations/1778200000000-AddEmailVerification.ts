import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerification1778200000000 implements MigrationInterface {
  name = 'AddEmailVerification1778200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop if it was created incorrectly in a previous run (wrong column names)
    await queryRunner.query(`DROP TABLE IF EXISTS \`email_verification_tokens\``);

    await queryRunner.query(`
      CREATE TABLE \`email_verification_tokens\` (
        \`id\`         VARCHAR(36)   NOT NULL,
        \`createdAt\`  DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\`  DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deletedAt\`  DATETIME(6)   NULL,
        \`user_id\`    VARCHAR(36)   NOT NULL,
        \`token_hash\` VARCHAR(255)  NOT NULL,
        \`expires_at\` DATETIME      NOT NULL,
        \`is_used\`    TINYINT(1)    NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_evt_user_id\` (\`user_id\`),
        INDEX \`IDX_evt_token_hash\` (\`token_hash\`),
        CONSTRAINT \`FK_evt_user_id\`
          FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`email_verification_tokens\``);
  }
}

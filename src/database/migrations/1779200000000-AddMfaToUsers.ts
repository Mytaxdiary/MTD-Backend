import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMfaToUsers1779200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`users\`
        ADD COLUMN \`mfa_enabled\`  BOOLEAN       NOT NULL DEFAULT FALSE AFTER \`last_login_at\`,
        ADD COLUMN \`totp_secret\`  VARCHAR(500)  NULL     DEFAULT NULL  AFTER \`mfa_enabled\`
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`users\`
        DROP COLUMN \`totp_secret\`,
        DROP COLUMN \`mfa_enabled\`
    `);
  }
}

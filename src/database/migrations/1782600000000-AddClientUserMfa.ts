import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientUserMfa1782600000000 implements MigrationInterface {
  name = 'AddClientUserMfa1782600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`client_users\`
        ADD \`mfa_enabled\` tinyint NOT NULL DEFAULT 0,
        ADD \`totp_secret\` varchar(500) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`client_users\`
        DROP COLUMN \`totp_secret\`,
        DROP COLUMN \`mfa_enabled\`
    `);
  }
}

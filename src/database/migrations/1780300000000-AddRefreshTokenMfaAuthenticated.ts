import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefreshTokenMfaAuthenticated1780300000000 implements MigrationInterface {
  name = 'AddRefreshTokenMfaAuthenticated1780300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` ADD \`mfa_authenticated\` tinyint NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`refresh_tokens\` DROP COLUMN \`mfa_authenticated\``);
  }
}

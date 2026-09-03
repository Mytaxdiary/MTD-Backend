import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientPortalOnly1781200000000 implements MigrationInterface {
  name = 'AddClientPortalOnly1781200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`clients\` ADD \`portal_only\` tinyint NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`clients\` DROP COLUMN \`portal_only\``);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserSessionInvalidatedAt1781700000000 implements MigrationInterface {
  name = 'AddUserSessionInvalidatedAt1781700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`users\`
        ADD COLUMN \`session_invalidated_at\` DATETIME NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`users\`
        DROP COLUMN \`session_invalidated_at\`
    `);
  }
}

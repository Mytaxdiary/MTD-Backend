import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPortalMessageSender1781300000000 implements MigrationInterface {
  name = 'AddPortalMessageSender1781300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`portal_messages\`
      ADD \`sender\` varchar(20) NOT NULL DEFAULT 'agent'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`portal_messages\` DROP COLUMN \`sender\``);
  }
}

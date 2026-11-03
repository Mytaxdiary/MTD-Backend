import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOutreachReleaseHeld1782400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`outreach_contacts\`
        ADD COLUMN \`send_held\` TINYINT(1) NOT NULL DEFAULT 1 AFTER \`do_not_contact\`
    `);
    await queryRunner.query(`
      ALTER TABLE \`outreach_campaigns\`
        ADD COLUMN \`release_held\` TINYINT(1) NOT NULL DEFAULT 1 AFTER \`is_active\`
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`outreach_campaigns\` DROP COLUMN \`release_held\`
    `);
    await queryRunner.query(`
      ALTER TABLE \`outreach_contacts\` DROP COLUMN \`send_held\`
    `);
  }
}

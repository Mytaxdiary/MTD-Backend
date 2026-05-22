import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendClientInvitationStatus1778900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`clients\`
      MODIFY COLUMN \`invitation_status\` VARCHAR(64) NOT NULL DEFAULT 'pending'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`clients\`
      MODIFY COLUMN \`invitation_status\` VARCHAR(20) NOT NULL DEFAULT 'pending'
    `);
  }
}

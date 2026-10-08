import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Idempotency markers so the billing mail cron sends trial-ending (day −2)
 * and trial-expired emails at most once per firm.
 */
export class AddTenantTrialEmailSentAt1782000000000 implements MigrationInterface {
  name = 'AddTenantTrialEmailSentAt1782000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`tenants\`
        ADD \`trial_ending_email_sent_at\` datetime NULL,
        ADD \`trial_expired_email_sent_at\` datetime NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`tenants\`
        DROP COLUMN \`trial_expired_email_sent_at\`,
        DROP COLUMN \`trial_ending_email_sent_at\`
    `);
  }
}

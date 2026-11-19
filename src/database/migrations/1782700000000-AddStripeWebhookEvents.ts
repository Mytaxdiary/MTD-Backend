import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStripeWebhookEvents1782700000000 implements MigrationInterface {
  name = 'AddStripeWebhookEvents1782700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`stripe_webhook_events\` (
        \`event_id\` varchar(255) NOT NULL,
        \`event_type\` varchar(120) NOT NULL,
        \`processed_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`event_id\`)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`stripe_webhook_events\``);
  }
}

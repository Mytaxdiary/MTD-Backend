import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientUserEmailHash1779900000000 implements MigrationInterface {
  name = 'AddClientUserEmailHash1779900000000';

  async up(qr: QueryRunner): Promise<void> {
    // Add the lookup hash column
    await qr.query(`
      ALTER TABLE \`client_users\`
      ADD COLUMN \`email_hash\` varchar(64) NULL AFTER \`email\`
    `);

    // Add a unique index so two portal accounts cannot share the same email
    await qr.query(`
      ALTER TABLE \`client_users\`
      ADD UNIQUE INDEX \`UQ_client_users_email_hash\` (\`email_hash\`)
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`ALTER TABLE \`client_users\` DROP INDEX \`UQ_client_users_email_hash\``);
    await qr.query(`ALTER TABLE \`client_users\` DROP COLUMN \`email_hash\``);
  }
}

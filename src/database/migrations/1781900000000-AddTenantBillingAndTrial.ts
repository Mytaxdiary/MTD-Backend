import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantBillingAndTrial1781900000000 implements MigrationInterface {
  name = 'AddTenantBillingAndTrial1781900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`tenants\`
        ADD \`billing_status\` varchar(32) NOT NULL DEFAULT 'active',
        ADD \`trial_starts_at\` datetime NULL,
        ADD \`trial_ends_at\` datetime NULL,
        ADD \`trial_email_domain\` varchar(255) NULL,
        ADD \`stripe_customer_id\` varchar(255) NULL,
        ADD \`stripe_subscription_id\` varchar(255) NULL,
        ADD \`included_client_allowance\` int NOT NULL DEFAULT 50,
        ADD \`billable_client_count\` int NULL
    `);
    await queryRunner.query(
      `CREATE INDEX \`IDX_tenants_billing_status\` ON \`tenants\` (\`billing_status\`)`,
    );

    await queryRunner.query(`
      CREATE TABLE \`platform_settings\` (
        \`id\` varchar(36) NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deletedAt\` datetime(6) NULL,
        \`setting_key\` varchar(64) NOT NULL,
        \`setting_value\` varchar(255) NOT NULL,
        UNIQUE INDEX \`UQ_platform_settings_key\` (\`setting_key\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      INSERT INTO \`platform_settings\` (\`id\`, \`setting_key\`, \`setting_value\`)
      VALUES (UUID(), 'trial_days', '7')
    `);

    await queryRunner.query(`
      CREATE TABLE \`trial_email_domains\` (
        \`id\` varchar(36) NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deletedAt\` datetime(6) NULL,
        \`domain\` varchar(255) NOT NULL,
        \`tenant_id\` varchar(36) NULL,
        \`consumed_at\` datetime NOT NULL,
        UNIQUE INDEX \`UQ_trial_email_domains_domain\` (\`domain\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    // Existing firms stay fully usable (grandfathered as active — not forced onto trial).
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`trial_email_domains\``);
    await queryRunner.query(`DROP TABLE \`platform_settings\``);
    await queryRunner.query(`DROP INDEX \`IDX_tenants_billing_status\` ON \`tenants\``);
    await queryRunner.query(`
      ALTER TABLE \`tenants\`
        DROP COLUMN \`billable_client_count\`,
        DROP COLUMN \`included_client_allowance\`,
        DROP COLUMN \`stripe_subscription_id\`,
        DROP COLUMN \`stripe_customer_id\`,
        DROP COLUMN \`trial_email_domain\`,
        DROP COLUMN \`trial_ends_at\`,
        DROP COLUMN \`trial_starts_at\`,
        DROP COLUMN \`billing_status\`
    `);
  }
}

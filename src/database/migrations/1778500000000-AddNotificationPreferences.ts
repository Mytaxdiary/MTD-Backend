import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationPreferences1778500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`notification_preferences\` (
        \`id\`                VARCHAR(36)  NOT NULL,
        \`createdAt\`         DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\`         DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deletedAt\`         DATETIME(6)  NULL,
        \`tenant_id\`         VARCHAR(36)  NOT NULL UNIQUE,
        \`chase_email\`       TINYINT(1)   NOT NULL DEFAULT 1,
        \`chase_sms\`         TINYINT(1)   NOT NULL DEFAULT 0,
        \`overdue_alert\`     TINYINT(1)   NOT NULL DEFAULT 1,
        \`deadline_reminder\` TINYINT(1)   NOT NULL DEFAULT 1,
        \`invite_accepted\`   TINYINT(1)   NOT NULL DEFAULT 1,
        \`liability_alert\`   TINYINT(1)   NOT NULL DEFAULT 1,
        \`reminder_days\`     INT          NOT NULL DEFAULT 14,
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_notif_prefs_tenant_id\`
          FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`notification_preferences\``);
  }
}

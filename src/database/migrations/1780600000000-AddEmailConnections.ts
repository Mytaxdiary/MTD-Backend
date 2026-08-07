import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailConnections1780600000000 implements MigrationInterface {
  name = 'AddEmailConnections1780600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`email_connections\` (
        \`id\` varchar(36) NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deletedAt\` datetime(6) NULL,
        \`user_id\` varchar(36) NOT NULL,
        \`tenant_id\` varchar(36) NOT NULL,
        \`provider\` varchar(20) NOT NULL,
        \`email_address\` varchar(255) NOT NULL,
        \`access_token\` text NOT NULL,
        \`refresh_token\` text NOT NULL,
        \`access_token_expires_at\` datetime NOT NULL,
        \`refresh_token_expires_at\` datetime NULL,
        \`connected_at\` datetime NOT NULL,
        \`status\` varchar(20) NOT NULL DEFAULT 'connected',
        \`scope\` varchar(500) NULL,
        UNIQUE INDEX \`UQ_email_connections_user_id\` (\`user_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`ALTER TABLE \`chase_logs\` ADD \`sent_by_user_id\` varchar(36) NULL`);
    await queryRunner.query(`ALTER TABLE \`chase_logs\` ADD \`from_email\` varchar(255) NULL`);
    await queryRunner.query(`ALTER TABLE \`chase_logs\` ADD \`send_via\` varchar(16) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`chase_logs\` DROP COLUMN \`send_via\``);
    await queryRunner.query(`ALTER TABLE \`chase_logs\` DROP COLUMN \`from_email\``);
    await queryRunner.query(`ALTER TABLE \`chase_logs\` DROP COLUMN \`sent_by_user_id\``);
    await queryRunner.query(`DROP TABLE \`email_connections\``);
  }
}

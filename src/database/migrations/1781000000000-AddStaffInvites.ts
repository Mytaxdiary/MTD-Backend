import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStaffInvites1781000000000 implements MigrationInterface {
  name = 'AddStaffInvites1781000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`staff_invites\` (
        \`id\` varchar(36) NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deletedAt\` datetime(6) NULL,
        \`tenant_id\` varchar(36) NOT NULL,
        \`invited_by_user_id\` varchar(36) NULL,
        \`email\` varchar(255) NOT NULL,
        \`first_name\` varchar(100) NOT NULL,
        \`last_name\` varchar(100) NOT NULL,
        \`permissions\` json NOT NULL,
        \`token_hash\` varchar(255) NOT NULL,
        \`expires_at\` datetime NOT NULL,
        \`accepted_at\` datetime NULL,
        \`accepted_user_id\` varchar(36) NULL,
        \`revoked_at\` datetime NULL,
        INDEX \`IDX_staff_invites_tenant_email\` (\`tenant_id\`, \`email\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
    await queryRunner.query(`
      ALTER TABLE \`staff_invites\`
      ADD CONSTRAINT \`FK_staff_invites_tenant\`
      FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE \`staff_invites\`
      ADD CONSTRAINT \`FK_staff_invites_invited_by\`
      FOREIGN KEY (\`invited_by_user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE \`staff_invites\`
      ADD CONSTRAINT \`FK_staff_invites_accepted_user\`
      FOREIGN KEY (\`accepted_user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`staff_invites\` DROP FOREIGN KEY \`FK_staff_invites_accepted_user\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`staff_invites\` DROP FOREIGN KEY \`FK_staff_invites_invited_by\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`staff_invites\` DROP FOREIGN KEY \`FK_staff_invites_tenant\``,
    );
    await queryRunner.query(`DROP TABLE \`staff_invites\``);
  }
}

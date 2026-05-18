import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenants1778300000000 implements MigrationInterface {
  name = 'AddTenants1778300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create tenants table
    await queryRunner.query(`
      CREATE TABLE \`tenants\` (
        \`id\`          VARCHAR(36)   NOT NULL,
        \`createdAt\`   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\`   DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deletedAt\`   DATETIME(6)   NULL,
        \`firm_name\`   VARCHAR(200)  NOT NULL,
        \`is_active\`   TINYINT(1)    NOT NULL DEFAULT 1,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // 2. Add tenant_id column to users (nullable to support existing rows)
    await queryRunner.query(`
      ALTER TABLE \`users\`
        ADD COLUMN \`tenant_id\` VARCHAR(36) NULL,
        ADD CONSTRAINT \`FK_users_tenant_id\`
          FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`)
          ON DELETE SET NULL
    `);

    // 3. Back-fill existing users: create one tenant per user from firm_name
    await queryRunner.query(`
      INSERT INTO \`tenants\` (\`id\`, \`firm_name\`)
      SELECT UUID(), \`firm_name\` FROM \`users\` WHERE \`deletedAt\` IS NULL
    `);

    // 4. Link each existing user to the tenant created for them
    await queryRunner.query(`
      UPDATE \`users\` u
      JOIN (
        SELECT t.id AS tid, t.firm_name, t.createdAt
        FROM \`tenants\` t
      ) t ON t.firm_name = u.firm_name
      SET u.tenant_id = t.tid
      WHERE u.tenant_id IS NULL AND u.deletedAt IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_users_tenant_id\``);
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`tenant_id\``);
    await queryRunner.query(`DROP TABLE \`tenants\``);
  }
}

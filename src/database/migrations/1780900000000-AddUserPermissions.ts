import { MigrationInterface, QueryRunner } from 'typeorm';

const OWNER_PERMISSIONS_JSON = JSON.stringify({
  canAddClients: true,
  canChase: true,
  canViewLiabilities: true,
  canViewNotes: true,
  canManageTemplates: true,
  canViewSettings: true,
  canInviteStaff: true,
});

export class AddUserPermissions1780900000000 implements MigrationInterface {
  name = 'AddUserPermissions1780900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`roles\`
      SET \`name\` = 'owner'
      WHERE \`name\` = 'Agent'
        AND NOT EXISTS (SELECT 1 FROM (SELECT \`id\` FROM \`roles\` WHERE \`name\` = 'owner') AS existing_owner)
    `);

    await queryRunner.query(`
      INSERT INTO \`roles\` (\`id\`, \`createdAt\`, \`updatedAt\`, \`name\`)
      SELECT UUID(), NOW(6), NOW(6), 'owner'
      FROM DUAL
      WHERE NOT EXISTS (SELECT 1 FROM \`roles\` WHERE \`name\` = 'owner')
    `);

    await queryRunner.query(`
      INSERT INTO \`roles\` (\`id\`, \`createdAt\`, \`updatedAt\`, \`name\`)
      SELECT UUID(), NOW(6), NOW(6), 'staff'
      FROM DUAL
      WHERE NOT EXISTS (SELECT 1 FROM \`roles\` WHERE \`name\` = 'staff')
    `);

    await queryRunner.query(`
      UPDATE \`users\` u
      INNER JOIN \`roles\` agent ON u.\`role_id\` = agent.\`id\` AND agent.\`name\` = 'Agent'
      INNER JOIN \`roles\` owner ON owner.\`name\` = 'owner'
      SET u.\`role_id\` = owner.\`id\`
    `);

    await queryRunner.query(`
      UPDATE \`users\` u
      INNER JOIN \`roles\` owner ON owner.\`name\` = 'owner'
      SET u.\`role_id\` = owner.\`id\`
      WHERE u.\`role_id\` IS NULL
    `);

    await queryRunner.query(`ALTER TABLE \`users\` ADD \`permissions\` json NULL`);

    await queryRunner.query(
      `UPDATE \`users\` SET \`permissions\` = '${OWNER_PERMISSIONS_JSON}' WHERE \`permissions\` IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`permissions\``);

    await queryRunner.query(`
      UPDATE \`roles\`
      SET \`name\` = 'Agent'
      WHERE \`name\` = 'owner'
        AND NOT EXISTS (SELECT 1 FROM (SELECT \`id\` FROM \`roles\` WHERE \`name\` = 'Agent') AS existing_agent)
    `);
  }
}

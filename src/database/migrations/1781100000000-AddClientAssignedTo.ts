import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientAssignedTo1781100000000 implements MigrationInterface {
  name = 'AddClientAssignedTo1781100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`clients\` ADD \`assigned_to_user_id\` varchar(36) NULL`);
    await queryRunner.query(`
      CREATE INDEX \`IDX_clients_tenant_assigned_to\`
      ON \`clients\` (\`tenant_id\`, \`assigned_to_user_id\`)
    `);
    await queryRunner.query(`
      ALTER TABLE \`clients\`
      ADD CONSTRAINT \`FK_clients_assigned_to_user\`
      FOREIGN KEY (\`assigned_to_user_id\`) REFERENCES \`users\`(\`id\`)
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`clients\` DROP FOREIGN KEY \`FK_clients_assigned_to_user\``,
    );
    await queryRunner.query(`DROP INDEX \`IDX_clients_tenant_assigned_to\` ON \`clients\``);
    await queryRunner.query(`ALTER TABLE \`clients\` DROP COLUMN \`assigned_to_user_id\``);
  }
}

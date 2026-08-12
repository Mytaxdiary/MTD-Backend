import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChaseLogBusiness1780700000000 implements MigrationInterface {
  name = 'AddChaseLogBusiness1780700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`chase_logs\` ADD \`business_id\` varchar(64) NULL`);
    await queryRunner.query(`ALTER TABLE \`chase_logs\` ADD \`business_name\` varchar(255) NULL`);
    await queryRunner.query(`
      CREATE INDEX \`IDX_chase_logs_tenant_client_business\`
      ON \`chase_logs\` (\`tenant_id\`, \`client_id\`, \`business_id\`)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_chase_logs_tenant_client_business\` ON \`chase_logs\``,
    );
    await queryRunner.query(`ALTER TABLE \`chase_logs\` DROP COLUMN \`business_name\``);
    await queryRunner.query(`ALTER TABLE \`chase_logs\` DROP COLUMN \`business_id\``);
  }
}

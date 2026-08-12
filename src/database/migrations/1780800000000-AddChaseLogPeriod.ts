import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChaseLogPeriod1780800000000 implements MigrationInterface {
  name = 'AddChaseLogPeriod1780800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`chase_logs\` ADD \`period_start_date\` date NULL`);
    await queryRunner.query(`ALTER TABLE \`chase_logs\` ADD \`period_end_date\` date NULL`);
    await queryRunner.query(`ALTER TABLE \`chase_logs\` ADD \`due_date\` date NULL`);
    await queryRunner.query(`ALTER TABLE \`chase_logs\` ADD \`quarter_label\` varchar(32) NULL`);
    await queryRunner.query(`
      CREATE INDEX \`IDX_chase_logs_tenant_client_biz_period\`
      ON \`chase_logs\` (\`tenant_id\`, \`client_id\`, \`business_id\`, \`period_start_date\`)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_chase_logs_tenant_client_biz_period\` ON \`chase_logs\``,
    );
    await queryRunner.query(`ALTER TABLE \`chase_logs\` DROP COLUMN \`quarter_label\``);
    await queryRunner.query(`ALTER TABLE \`chase_logs\` DROP COLUMN \`due_date\``);
    await queryRunner.query(`ALTER TABLE \`chase_logs\` DROP COLUMN \`period_end_date\``);
    await queryRunner.query(`ALTER TABLE \`chase_logs\` DROP COLUMN \`period_start_date\``);
  }
}

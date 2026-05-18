import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTenantDetails1778400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`tenants\` ADD COLUMN \`contact_name\`  VARCHAR(200) NULL`);
    await queryRunner.query(`ALTER TABLE \`tenants\` ADD COLUMN \`contact_email\` VARCHAR(255) NULL`);
    await queryRunner.query(`ALTER TABLE \`tenants\` ADD COLUMN \`phone\`         VARCHAR(50)  NULL`);
    await queryRunner.query(`ALTER TABLE \`tenants\` ADD COLUMN \`address\`       VARCHAR(500) NULL`);
    await queryRunner.query(`ALTER TABLE \`tenants\` ADD COLUMN \`postcode\`      VARCHAR(20)  NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`tenants\` DROP COLUMN \`postcode\``);
    await queryRunner.query(`ALTER TABLE \`tenants\` DROP COLUMN \`address\``);
    await queryRunner.query(`ALTER TABLE \`tenants\` DROP COLUMN \`phone\``);
    await queryRunner.query(`ALTER TABLE \`tenants\` DROP COLUMN \`contact_email\``);
    await queryRunner.query(`ALTER TABLE \`tenants\` DROP COLUMN \`contact_name\``);
  }
}

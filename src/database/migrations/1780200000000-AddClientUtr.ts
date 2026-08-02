import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientUtr1780200000000 implements MigrationInterface {
  name = 'AddClientUtr1780200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`clients\` ADD \`utr\` varchar(500) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`clients\` DROP COLUMN \`utr\``);
  }
}

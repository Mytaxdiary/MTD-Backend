import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddClientPreferredName1780400000000 implements MigrationInterface {
  name = 'AddClientPreferredName1780400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`clients\` ADD \`preferred_name\` varchar(500) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`clients\` DROP COLUMN \`preferred_name\``);
  }
}

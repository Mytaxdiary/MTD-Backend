import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClientsTenantCascadeDelete1779000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE c FROM \`clients\` c
      LEFT JOIN \`tenants\` t ON c.\`tenant_id\` = t.\`id\`
      WHERE t.\`id\` IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE \`clients\`
      ADD CONSTRAINT \`FK_clients_tenant_id\`
        FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\` (\`id\`)
        ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`clients\` DROP FOREIGN KEY \`FK_clients_tenant_id\`
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * One client per NINO per firm. Removes duplicate rows (keeps oldest createdAt) then adds unique index.
 */
export class UniqueClientNinoPerTenant1778800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE c FROM \`clients\` c
      INNER JOIN (
        SELECT \`tenant_id\`, \`nino\`, MIN(\`createdAt\`) AS keep_created
        FROM \`clients\`
        GROUP BY \`tenant_id\`, \`nino\`
        HAVING COUNT(*) > 1
      ) dup
        ON c.\`tenant_id\` = dup.\`tenant_id\`
        AND c.\`nino\` = dup.\`nino\`
        AND c.\`createdAt\` > dup.keep_created
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX \`UQ_clients_tenant_nino\` ON \`clients\` (\`tenant_id\`, \`nino\`)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`UQ_clients_tenant_nino\` ON \`clients\``);
  }
}

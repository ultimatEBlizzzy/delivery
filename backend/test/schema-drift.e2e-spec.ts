import { computeSchemaDiff } from '../src/database/cli/schema-diff';
import { createTestApp, TestContext } from './support/test-app';

describe('Database schema', () => {
  let ctx: TestContext;
  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(() => ctx.close());

  it('matches the entities exactly (every entity change has a migration)', async () => {
    const diff = await computeSchemaDiff(ctx.dataSource);
    expect(diff.up).toEqual([]);
  });

  it('has PostGIS available', async () => {
    const [row] = await ctx.dataSource.query('SELECT PostGIS_Version() AS v');
    expect(row.v).toMatch(/^3\./);
  });

  it('seeds the four platform roles', async () => {
    const rows = await ctx.dataSource.query('SELECT name FROM roles ORDER BY name');
    expect(rows.map((r: { name: string }) => r.name)).toEqual([
      'ADMIN',
      'CUSTOMER',
      'DRIVER',
      'STORE',
    ]);
  });
});

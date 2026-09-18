import { describe, it, expect } from '../helpers/test.js';import { buildEngineFromRegistry, createPool, migrate, ObjectRegistry, ROW_SCOPE_MARKERS } from '@weave-kit/engine';
import type { ObjectDefinition } from '@weave-kit/engine';
import { ClientError, createClient } from '../../src/index.js';

const url = process.env.DATABASE_URL;
const maybe = url !== undefined ? describe : describe.skip;

const LEAD: ObjectDefinition = {
  name: 'lead',
  fields: [
    { name: 'id', type: 'string', primary: true },
    { name: 'name', type: 'string' },
    { name: 'owner_id', type: 'string', [ROW_SCOPE_MARKERS.OWNERSHIP]: true },
    { name: 'secret', type: 'string' },
  ],
  permissions: {
    sales: { read: 'own', create: true, update: ['name'], delete: true, fields: { exclude: ['secret'] } },
  },
};

/** object-level type (equivalent to what `weave types` generates for LEAD) */
interface Lead {
  id: string;
  name: string;
  owner_id?: string;
  secret?: string;
}

maybe('Client SDK E2E (real engine + listen + fetch + local PG)', () => {
  it('full-path CRUD + RBAC exclude + 401', async () => {
    const port = 3600 + Math.floor(Math.random() * 200);
    const baseUrl = `http://127.0.0.1:${port}`;
    const pool = createPool(url!);
    const registry = new ObjectRegistry();
    registry.register(LEAD);
    registry.buildGraph();
    const engine = await buildEngineFromRegistry(registry, {
      databaseUrl: url!,
      auth: { source: { 'key-sales-rep': { id: 'u100', roles: ['sales'] } } },
    });
    const base = { pool: engine.pool, registry: engine.registry };
    try {
      await engine.app.listen({ host: '127.0.0.1', port });
      await pool.query('DROP TABLE IF EXISTS lead, weavekit_metadata, weavekit_meta CASCADE');
      await migrate(engine.registry, { databaseUrl: url! });

      await engine.dataAccess.create('lead', { id: 'L1', name: 'Acme', owner_id: 'u100', secret: 's1' }, base);
      await engine.dataAccess.create('lead', { id: 'L2', name: 'Globex', owner_id: 'u200', secret: 's2' }, base);

      const client = createClient({ baseUrl, apiKey: 'key-sales-rep' });
      const leads = client.objects<Lead>('lead');

      // 1. find: own filtering + secret stripping (server-side RBAC)
      const found = await leads.find();
      expect(found.total).toBe(1);
      expect(found.rows[0]?.id).toBe('L1');
      expect('secret' in found.rows[0]!).toBe(false);

      // 2. findOne: own hit / unauthorized row → null (404 does not leak existence)
      expect((await leads.findOne('L1'))?.name).toBe('Acme');
      expect(await leads.findOne('L2')).toBeNull();

      // 3. create：201
      const created = await leads.create({ id: 'L3', name: 'Umbrella', owner_id: 'u100', secret: 's3' });
      expect(created.id).toBe('L3');

      // 4. update: allowed field
      const updated = await leads.update('L3', { name: 'Umbrella2' });
      expect(updated.name).toBe('Umbrella2');

      // 5. update unauthorized row → 404 ClientError (no leak)
      let updateDenied: unknown;
      try {
        await leads.update('L2', { name: 'x' });
      } catch (error) {
        updateDenied = error;
      }
      expect(updateDenied instanceof ClientError).toBe(true);
      expect((updateDenied as ClientError).status).toBe(404);

      // 6. delete: own row 204
      await leads.delete('L3');
      expect(await leads.findOne('L3')).toBeNull();

      // 7. no apiKey → 401 ClientError
      const anon = createClient({ baseUrl }).objects('lead');
      let denied: unknown;
      try {
        await anon.find();
      } catch (error) {
        denied = error;
      }
      expect(denied instanceof ClientError).toBe(true);
      expect((denied as ClientError).status).toBe(401);
      expect((denied as ClientError).code).toBe('auth.missingKey');
    } finally {
      await pool.query('DROP TABLE IF EXISTS lead, weavekit_metadata, weavekit_meta CASCADE');
      await engine.close();
      await pool.end();
    }
  }, 60000);
});

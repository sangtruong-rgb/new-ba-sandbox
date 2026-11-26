import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { requireUser, type AuthEnv } from './auth/require-user.ts';
import { discoverFeatureApis, mountFeatureApis, type FeatureApi } from './registry.ts';
import { NotFoundError, TaskStore } from './tasks/store.ts';

/** The API under /api; Vite serves the web page for every other path. */
export function createApp(features: FeatureApi[] = discoverFeatureApis()): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();

  app.onError((err, c) => {
    if (err instanceof NotFoundError) return c.json({ error: 'not_found' }, 404);
    if (err instanceof HTTPException) return err.getResponse();
    console.error(err);
    return c.json({ error: 'server_error' }, 500);
  });
  app.notFound((c) => c.json({ error: 'not_found' }, 404));

  app.get('/api/health', (c) => c.json({ ok: true }));
  app.get('/api/tasks', requireUser, (c) => c.json(TaskStore.list(c.get('user').id)));

  mountFeatureApis(app, features);
  return app;
}

const app = createApp();
export default app;

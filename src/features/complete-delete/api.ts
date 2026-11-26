import type { FeatureApi } from '../../../server/registry.ts';
import { TaskStore } from '../../../server/tasks/store.ts';

// A task of another user, or none, makes TaskStore throw NotFoundError: the app answers 404.
const api: FeatureApi = {
  id: 'complete-delete',
  routes: [
    {
      method: 'PUT',
      path: '/tasks/:id/done',
      handler: async (c) => {
        const body: unknown = await c.req.json().catch(() => null);
        const done = (body as { done?: unknown } | null)?.done;
        if (typeof done !== 'boolean') return c.json({ error: 'invalid_input' }, 400);
        return c.json(TaskStore.update(c.get('user').id, c.req.param('id')!, { done }));
      },
    },
    {
      method: 'DELETE',
      path: '/tasks/:id',
      handler: (c) => {
        TaskStore.remove(c.get('user').id, c.req.param('id')!);
        return c.body(null, 204);
      },
    },
  ],
};

export default api;

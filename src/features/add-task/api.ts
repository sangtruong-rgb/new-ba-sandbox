import type { FeatureApi } from '../../../server/registry.ts';
import { TaskStore } from '../../../server/tasks/store.ts';
import { validateTitle } from './title.ts';

const api: FeatureApi = {
  id: 'add-task',
  routes: [
    {
      method: 'POST',
      path: '/tasks',
      handler: async (c) => {
        const body: unknown = await c.req.json().catch(() => null);
        const { title, dueAt = null } = (body ?? {}) as { title?: unknown; dueAt?: unknown };
        const name = validateTitle(typeof title === 'string' ? title : '');
        if (!name.ok) return c.json({ error: name.error }, 400);
        const at = typeof dueAt === 'string' ? new Date(dueAt) : null;
        if (dueAt !== null && (!at || Number.isNaN(at.getTime()))) return c.json({ error: 'invalid_due' }, 400);
        const task = TaskStore.create(c.get('user').id, { title: name.title, dueAt: at?.toISOString() ?? null });
        return c.json(task);
      },
    },
  ],
};

export default api;

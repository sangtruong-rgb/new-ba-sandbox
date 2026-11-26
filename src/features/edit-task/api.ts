import type { FeatureApi } from '../../../server/registry.ts';
import { TaskStore } from '../../../server/tasks/store.ts';
import { validateTitle } from '../add-task/title.ts';

// A task of another user, or none, makes TaskStore throw NotFoundError: the app answers 404.
const api: FeatureApi = {
  id: 'edit-task',
  routes: [
    {
      method: 'PATCH',
      path: '/tasks/:id',
      handler: async (c) => {
        const body: unknown = await c.req.json().catch(() => null);
        if (!body || typeof body !== 'object') return c.json({ error: 'invalid_input' }, 400);
        const { title, dueAt } = body as { title?: unknown; dueAt?: unknown };
        const patch: { title?: string; dueAt?: string | null } = {};
        if (title !== undefined) {
          const name = validateTitle(typeof title === 'string' ? title : '');
          if (!name.ok) return c.json({ error: name.error }, 400);
          patch.title = name.title;
        }
        if (dueAt === null) patch.dueAt = null;
        else if (dueAt !== undefined) {
          const at = typeof dueAt === 'string' ? new Date(dueAt) : null;
          if (!at || Number.isNaN(at.getTime())) return c.json({ error: 'invalid_due' }, 400);
          patch.dueAt = at.toISOString();
        }
        return c.json(TaskStore.update(c.get('user').id, c.req.param('id')!, patch));
      },
    },
  ],
};

export default api;

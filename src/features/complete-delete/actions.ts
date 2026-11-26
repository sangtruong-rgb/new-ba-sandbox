import { api, reload, type Task } from '../../../web/tasks.ts';

// api() already handles a failure (error line, reload on 404, sign-out on 401), so it is only caught here.

export async function toggleDone(task: Task): Promise<void> {
  try {
    await api(`/tasks/${task.id}/done`, { method: 'PUT', body: { done: !task.done } });
  } catch {
    return;
  }
  await reload();
}

export async function deleteTask(task: Task, deselect: () => void): Promise<void> {
  try {
    await api(`/tasks/${task.id}`, { method: 'DELETE' });
  } catch {
    return;
  }
  deselect();
  await reload();
}

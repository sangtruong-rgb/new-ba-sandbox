import type { Context, Hono } from 'hono';
import { requireUser, type AuthEnv } from './auth/require-user.ts';

export type FeatureRoute = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Mounted at /api + path, e.g. '/tasks/:id'. */
  path: string;
  /** Without it the route sits behind requireUser and c.get('user') is set. */
  public?: boolean;
  handler: (c: Context<AuthEnv>) => Response | Promise<Response>;
};

/** What src/features/<name>/api.ts default-exports. */
export type FeatureApi = { id: string; routes: FeatureRoute[] };

/** Routes the server itself declares, so a feature cannot take them. */
export const CORE_ROUTES: Record<string, string> = {
  'GET /health': 'server',
  'GET /tasks': 'server',
};

/** Every src/features/<name>/api.ts, sorted by folder name. */
export function discoverFeatureApis(): FeatureApi[] {
  const modules = import.meta.glob<{ default: FeatureApi }>('../src/features/*/api.ts', { eager: true });
  return Object.keys(modules)
    .sort()
    .map((file) => modules[file]!.default);
}

/** Mounts every route at /api + path; a method and path declared twice throws, naming both declarers. */
export function mountFeatureApis(app: Hono<AuthEnv>, features: FeatureApi[], reserved = CORE_ROUTES): void {
  const owners = new Map(Object.entries(reserved));
  for (const feature of features) {
    for (const route of feature.routes) {
      const key = `${route.method} ${route.path}`;
      const owner = owners.get(key);
      if (owner !== undefined) {
        throw new Error(`Route ${key} is declared by both "${owner}" and "${feature.id}"`);
      }
      owners.set(key, feature.id);
    }
  }
  for (const feature of features) {
    for (const route of feature.routes) {
      const path = '/api' + route.path;
      if (route.public) app.on(route.method, path, (c) => route.handler(c));
      else app.on(route.method, path, requireUser, (c) => route.handler(c));
    }
  }
}

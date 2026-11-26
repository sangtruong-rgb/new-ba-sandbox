import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const roots = ['server', 'web', 'src/features'];

export default defineConfig({
  plugins: [react()],
  test: {
    env: { DATABASE_URL: ':memory:' },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: roots.map((r) => `${r}/**/*.test.ts`),
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: roots.map((r) => `${r}/**/*.test.tsx`),
        },
      },
    ],
  },
});

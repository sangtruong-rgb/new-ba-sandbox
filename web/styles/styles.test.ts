import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const read = (f: string) => fs.readFileSync(path.resolve(f), 'utf8');

function cssFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return cssFiles(p);
    return e.name.endsWith('.css') ? [p] : [];
  });
}

describe('styles', () => {
  test('C9 the tokens match taste.md in light and dark', () => {
    const css = read('web/styles/tokens.css');
    const [light, dark] = css.split('prefers-color-scheme: dark');
    const light_ = { bg: '#f3eee4', paper: '#fbf8f2', ink: '#1e1a15', muted: '#6a6256', accent: '#b93a25', 'accent-ink': '#ffffff', line: '#ddd3c3' };
    const dark_ = { bg: '#191612', paper: '#221e19', ink: '#efe8dc', muted: '#ada393', accent: '#ef7a5c', 'accent-ink': '#1b120e', line: '#3a332a' };
    for (const [k, v] of Object.entries(light_)) expect(light, k).toContain(`--${k}: ${v};`);
    for (const [k, v] of Object.entries(dark_)) expect(dark, k).toContain(`--${k}: ${v};`);
  });

  test('C9 the fonts Fraunces and Be Vietnam Pro come from @fontsource', () => {
    const css = read('web/styles/index.css');
    expect(css).toContain("@import '@fontsource/fraunces/600.css'");
    expect(css).toContain("@import '@fontsource/be-vietnam-pro/400.css'");
    expect(css).toContain("@import '@fontsource/be-vietnam-pro/600.css'");
  });

  test('C9 outside web/styles every stylesheet is a CSS module', () => {
    const files = [...cssFiles('web'), ...cssFiles('src/features')].filter(
      (f) => !f.startsWith(path.join('web', 'styles') + path.sep),
    );
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((f) => !f.endsWith('.module.css'))).toEqual([]);
  });
});

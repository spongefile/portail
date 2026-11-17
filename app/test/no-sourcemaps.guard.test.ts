import { describe, it, expect } from 'vitest';
import viteConfig from '../vite.config';
// @ts-expect-error node builtins; no @types/node, resolved at runtime
import { existsSync, readdirSync, readFileSync } from 'node:fs';

/**
 * The public deploy is app-only; source maps embed the full TypeScript source (incl. the private
 * firmware-defect comments the docs were redacted of). This must be a property of the ARTIFACT, not
 * of a deploy step remembering to strip .map files:
 *   (1) the RESOLVED config's build.sourcemap is false — handling BOTH the object and the FUNCTION
 *       form of defineConfig (the latter is exactly what "maps locally, not in production" reaches
 *       for), and asserting the shape so a future refactor can't pass vacuously.
 *   (2) if a build exists, it carries no .map files and no inline data-URI map anywhere under dist
 *       (recursive, so an assetsDir change can't move files out of scope) — which also catches
 *       `vite build --sourcemap` overriding the config on the CLI.
 */
describe('production build never emits source maps', () => {
  it('resolved build.sourcemap is false (object OR function config form)', async () => {
    const resolved = typeof viteConfig === 'function'
      ? await (viteConfig as (env: { command: string; mode: string }) => unknown)({ command: 'build', mode: 'production' })
      : viteConfig;
    expect(typeof resolved).toBe('object'); // fails loudly if the config shape changes again
    expect((resolved as { build?: { sourcemap?: unknown } }).build?.sourcemap ?? false).toBe(false);
  });

  it('a built dist carries no .map files and no inline data-URI maps', () => {
    if (!existsSync('dist')) return; // nothing built to inspect (clause 1 still runs)
    const files = readdirSync('dist', { recursive: true }) as string[];
    expect(files.filter((f) => f.endsWith('.map'))).toEqual([]);
    for (const f of files) {
      if (!f.endsWith('.js') && !f.endsWith('.css')) continue;
      expect(readFileSync(`dist/${f}`, 'utf8')).not.toContain('sourceMappingURL=data:');
    }
  });
});

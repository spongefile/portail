import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    // OFF deliberately: source maps embed the full TypeScript source (incl. the private
    // firmware-defect comments). The public deploy must never ship them, so we never generate them —
    // the protection is a property of the artifact, not of a deploy step remembering to strip. A
    // guard test (test/no-sourcemaps.guard.test.ts) fails the build if this is re-enabled.
    sourcemap: false,
  },
  server: {
    fs: { allow: ['..'] }, // docs/ lives one level up (repo root), bundled at build time
  },
});

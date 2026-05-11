import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  target: 'es2022',
  outDir: 'dist',
  /**
   * Pull `ignoreDeprecations`/`baseUrl`/TS5101 handling out of root `tsconfig.json` so JSON Schema /
   * TS 5–based editors don’t reject `ignoreDeprecations`: `"6.0"` (see `dts-for-tsup.json`).
   */
  tsconfig: 'dts-for-tsup.json',
  /** Keep HTTP client as a runtime dependency (same as Node's fetch implementation). */
  external: ['undici'],
});

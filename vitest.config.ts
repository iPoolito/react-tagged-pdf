import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The docs site (site/) is a separate Astro project with its own dependencies.
    exclude: [...configDefaults.exclude, 'site/**'],
  },
});

import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The docs site (site/) is a separate Astro project with its own dependencies;
    // .claude/ holds agent worktrees that would otherwise be picked up as duplicate tests.
    exclude: [...configDefaults.exclude, 'site/**', '.claude/**'],
  },
});

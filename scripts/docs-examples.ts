// Helpers for the docs site's example pages (see scripts/build-docs-examples.ts).
import type { FailedRule } from './verapdf.js';

/** One example as the docs site shows it: its source, its rendered PDF and veraPDF's verdict. */
export type DocsExample = {
  /** File name without extension, e.g. `tables`; also the docs page slug. */
  name: string;
  /** Source as readers would write it (imports from `react-tagged-pdf`). */
  source: string;
  /** Path of the PDF under the site's `public/` directory, e.g. `examples/tables.pdf`. */
  pdf: string;
  /** `passed`/`failed`: veraPDF PDF/UA-1 result; `not-run`: the build skipped veraPDF. */
  verapdf: { status: 'passed' | 'failed' | 'not-run'; profile: 'PDF/UA-1'; validator: string; failedRules: FailedRule[] };
};

const OUTPUT = /new URL\(\s*['"]\.\.\/test-output\/([\w.-]+\.pdf)['"]/;

/** The file name of the PDF an example script writes to `test-output/`. */
export function examplePdfName(source: string): string {
  const match = OUTPUT.exec(source);
  if (!match?.[1]) throw new Error("Example does not write its PDF to new URL('../test-output/<name>.pdf', ...)");
  return match[1];
}

/** The example's source as a reader would write it: imports from the package, no repo-only run hint. */
export function displaySource(source: string): string {
  return source
    .replace(/^\/\/ Run with .*\r?\n/, '')
    .replaceAll(/from '\.\.\/src\/index\.js'/g, "from 'react-tagged-pdf'");
}

/**
 * What to report when examples failed veraPDF: each failed example with the rules it failed, or
 * `undefined` when every example passed or was not validated (`VERAPDF=skip`).
 */
export function nonCompliant(examples: readonly DocsExample[]): string | undefined {
  const failed = examples.filter((e) => e.verapdf.status === 'failed');
  if (failed.length === 0) return undefined;
  return [
    `${failed.length} example(s) failed veraPDF PDF/UA-1 validation:`,
    ...failed.flatMap((e) => [
      `  ${e.name}`,
      ...e.verapdf.failedRules.map((r) => `    ${r.rule} (${r.failedChecks} failed checks): ${r.description}`),
    ]),
  ].join('\n');
}

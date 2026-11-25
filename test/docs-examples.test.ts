import { describe, expect, it } from 'vitest';
import { type DocsExample, displaySource, examplePdfName, nonCompliant } from '../scripts/docs-examples.js';

const tablesExample = `// Run with \`npm run example:tables\`, then open test-output/tables.pdf.
// Shows simple data tables.
import { mkdir } from 'node:fs/promises';
import { Document, P, Page, renderToFile } from '../src/index.js';

const out = fileURLToPath(new URL('../test-output/tables.pdf', import.meta.url));
`;

describe('examplePdfName', () => {
  it('finds the PDF an example writes under test-output/', () => {
    expect(examplePdfName(tablesExample)).toBe('tables.pdf');
  });

  it('fails loudly when the example does not write to test-output/', () => {
    expect(() => examplePdfName(`await renderToFile(<Document />, 'out.pdf');`)).toThrow(/test-output/);
  });
});

describe('displaySource', () => {
  it('imports from the published package and drops the repo-only "Run with" line', () => {
    expect(displaySource(tablesExample)).toBe(`// Shows simple data tables.
import { mkdir } from 'node:fs/promises';
import { Document, P, Page, renderToFile } from 'react-tagged-pdf';

const out = fileURLToPath(new URL('../test-output/tables.pdf', import.meta.url));
`);
  });
});

describe('nonCompliant', () => {
  const example = (name: string, status: DocsExample['verapdf']['status'], failedRules: DocsExample['verapdf']['failedRules'] = []) =>
    ({
      name,
      source: '',
      pdf: `examples/${name}.pdf`,
      verapdf: { status, profile: 'PDF/UA-1', validator: 'verapdf/cli', failedRules },
    }) satisfies DocsExample;

  it('is undefined when every example passed or was not validated', () => {
    expect(nonCompliant([example('hello', 'passed'), example('tables', 'not-run')])).toBeUndefined();
  });

  it('names each failed example and the rules it failed', () => {
    const report = nonCompliant([
      example('hello', 'passed'),
      example('headings', 'failed', [{ rule: '7.4.2-1', failedChecks: 2, description: 'Heading levels skipped' }]),
    ]);
    expect(report).toBe(
      [
        '1 example(s) failed veraPDF PDF/UA-1 validation:',
        '  headings',
        '    7.4.2-1 (2 failed checks): Heading levels skipped',
      ].join('\n'),
    );
  });
});

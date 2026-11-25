import { describe, expect, it } from 'vitest';
import { displaySource, examplePdfName } from '../scripts/docs-examples.js';

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

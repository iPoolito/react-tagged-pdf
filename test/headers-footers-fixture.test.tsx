import { describe, expect, it } from 'vitest';
import { renderToBuffer } from '../src/index.js';
import fixture, { BODY } from './fixtures/headers-footers.js';
import { structOutline, textRuns } from './support/read-pdf.js';

describe('headers and footers fixture (validated by veraPDF in npm run test:ua)', () => {
  it('keeps the header, footer and divider out of the structure tree', async () => {
    const pdf = await renderToBuffer(fixture);
    expect(await structOutline(pdf)).toBe(
      [
        'Document',
        '  H1 "Annual report"',
        `  P ${JSON.stringify(BODY)}`,
        '  H2 "Outlook"',
        `  P ${JSON.stringify(BODY)}`,
      ].join('\n'),
    );
  });

  it('draws the header and "Page X of Y" on every page', async () => {
    const pages = await textRuns(await renderToBuffer(fixture));
    expect(pages.length).toBeGreaterThan(2);
    pages.forEach((page, i) => {
      const text = page.runs.map((r) => r.str);
      expect(text).toContain('Annual report 2026');
      expect(text).toContain(`Page ${i + 1} of ${pages.length}`);
    });
  });
});

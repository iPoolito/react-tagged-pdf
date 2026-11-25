import { describe, expect, it } from 'vitest';
import { renderToBuffer } from '../src/index.js';
import fixture, { ROWS } from './fixtures/long-table.js';
import { structOutline, textRuns } from './support/read-pdf.js';

describe('long table fixture (validated by veraPDF in npm run test:ua)', () => {
  it('is one Table element holding every row, across pages', async () => {
    const pdf = await renderToBuffer(fixture);
    expect(await structOutline(pdf)).toBe(
      [
        'Document',
        '  H1 "Service log"',
        '  P "One row per day. The table continues on the following pages."',
        '  Table',
        '    TR',
        '      TH [Scope=Column] "Day"',
        '      TH [Scope=Column] "Note"',
        ...ROWS.flatMap(({ day, note }) => ['    TR', `      TH [Scope=Row] "${day}"`, `      TD "${note}"`]),
        '  P "End of log."',
      ].join('\n'),
    );
  });

  it('spans several pages, each starting or ending with whole rows', async () => {
    const pages = await textRuns(await renderToBuffer(fixture));
    expect(pages.length).toBeGreaterThanOrEqual(3);
    // Each continuation page starts with a row's first cell.
    for (const page of pages.slice(1)) expect(page.runs[0]!.str).toMatch(/^Day \d+$/);
  });
});

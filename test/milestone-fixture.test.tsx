import { describe, expect, it } from 'vitest';
import { renderToBuffer } from '../src/index.js';
import fixture from './fixtures/milestone.js';
import { linkAnnotations, structOutline, textRuns } from './support/read-pdf.js';

describe('v0.0.1 milestone fixture (validated by veraPDF in npm run test:ua)', () => {
  it('tags a title, headings, a linked paragraph, a list, a described image and a table', async () => {
    const pdf = await renderToBuffer(fixture);
    expect(await structOutline(pdf)).toBe(
      [
        'Document',
        '  H1 "Quarterly report"',
        '  P "Sales grew this quarter. Read the [Link] for details."',
        '    Link "full methodology" (1 OBJR)',
        '  H2 "Highlights"',
        '  L',
        '    LI',
        '      Lbl "•"',
        '      LBody "Sales rose in every quarter."',
        '    LI',
        '      Lbl "•"',
        '      LBody "Two new regions opened."',
        '  H2 "Sales chart"',
        '  Figure [Alt="Bar chart: sales rose in each of the four quarters."]',
        '  H2 "Sales by region"',
        '  Table',
        '    TR',
        '      TH [Scope=Column] "Region"',
        '      TH [Scope=Column] "Sales"',
        '    TR',
        '      TD "North"',
        '      TD "120"',
        '    TR',
        '      TD "South"',
        '      TD "95"',
      ].join('\n'),
    );
  });

  it('fits on one page and gives the link annotation its text as /Contents', async () => {
    const pdf = await renderToBuffer(fixture);
    expect(await textRuns(pdf)).toHaveLength(1);
    expect((await linkAnnotations(pdf)).map((a) => [a.uri, a.contents])).toEqual([
      ['https://example.com/methodology', 'full methodology'],
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { renderToBuffer } from '../src/index.js';
import fixture from './fixtures/tables.js';
import { structOutline, textRuns } from './support/read-pdf.js';

describe('tables fixture (validated by veraPDF in npm run test:ua)', () => {
  it('tags header-row, header-column and two-way tables as Table > TR > TH/TD with Scope', async () => {
    const pdf = await renderToBuffer(fixture);
    expect(await structOutline(pdf)).toBe(
      [
        'Document',
        '  H1 "Tables"',
        '  H2 "Fruit prices (header row)"',
        '  Table',
        '    TR',
        '      TH [Scope=Column] "Fruit"',
        '      TH [Scope=Column] "Origin"',
        '      TH [Scope=Column] "Price per kg"',
        '    TR',
        '      TD "Apples"',
        '      TD "Spain"',
        '      TD "1.20"',
        '    TR',
        '      TD "Pears ( [Span] )"',
        '        Span [Lang="fr-FR"] "Doyenné du Comice"',
        '      TD "France"',
        '      TD "2.40"',
        '  H2 "Opening hours (header column)"',
        '  Table',
        '    TR',
        '      TH [Scope=Row] "Monday"',
        '      TD "9:00–17:00"',
        '    TR',
        '      TH [Scope=Row] "Saturday"',
        '      TD "10:00–14:00"',
        '    TR',
        '      TH [Scope=Row] "Sunday"',
        '      TD "Closed"',
        '  H2 "Results (both)"',
        '  Table',
        '    TR',
        '      TH [Scope=Column] "Team"',
        '      TH [Scope=Column] "Won"',
        '      TH [Scope=Column] "Notes"',
        '    TR',
        '      TH [Scope=Row] "North"',
        '      TD "7"',
        '      TD "See [Link]"',
        '        Link "the report" (1 OBJR)',
        '    TR',
        '      TH [Scope=Row] "South"',
        '      TD "5"',
        '      TD',
        '    TR',
        '      TH [Scope=Row] "Total"',
        '      TD "12"',
        '      TD',
        '  P "Prices include VAT."',
      ].join('\n'),
    );
  });

  it('fits on one page', async () => {
    expect(await textRuns(await renderToBuffer(fixture))).toHaveLength(1);
  });
});

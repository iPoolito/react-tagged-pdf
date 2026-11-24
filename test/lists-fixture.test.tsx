import { describe, expect, it } from 'vitest';
import { renderToBuffer } from '../src/index.js';
import fixture, { SPLIT_ITEM } from './fixtures/lists.js';
import { structOutline, textRuns } from './support/read-pdf.js';

describe('lists fixture (validated by veraPDF in npm run test:ua)', () => {
  it('tags ordered, unordered and nested lists as L > LI > Lbl + LBody', async () => {
    const pdf = await renderToBuffer(fixture);
    expect(await structOutline(pdf)).toBe(
      [
        'Document',
        '  H1 "Lists"',
        '  H2 "Shopping"',
        '  L',
        '    LI',
        '      Lbl "•"',
        '      LBody "Fruit [L]"',
        '        L',
        '          LI',
        '            Lbl "1."',
        '            LBody "Apples"',
        '          LI',
        '            Lbl "2."',
        '            LBody "Pears, of two kinds: [L]"',
        '              L',
        '                LI',
        '                  Lbl "•"',
        '                  LBody "Conference"',
        '                LI',
        '                  Lbl "•"',
        '                  LBody',
        '                    Span [Lang="fr-FR"] "Doyenné du Comice"',
        '    LI',
        '      Lbl "•"',
        '      LBody "Bread from [Link]"',
        '        Link "the bakery" (1 OBJR)',
        '  H2 "Steps"',
        '  L',
        '    LI',
        '      Lbl "1."',
        '      LBody "Preheat the oven."',
        '    LI',
        '      Lbl "2."',
        '      LBody "Mix the ingredients. [P]"',
        '        P "Do not overmix."',
        '    LI',
        '      Lbl "3."',
        '      LBody "Bake for twenty minutes."',
        '    LI',
        '      Lbl "4."',
        `      LBody ${JSON.stringify(SPLIT_ITEM)}`,
        '    LI',
        '      Lbl "5."',
        '      LBody "Serve."',
      ].join('\n'),
    );
  });

  it('splits the long item over two pages, its number only on the first', async () => {
    const pages = await textRuns(await renderToBuffer(fixture));
    expect(pages).toHaveLength(2);
    const visible = pages.map((p) => p.runs.filter((r) => r.str.trim()).map((r) => r.str));
    expect(visible[0]!.at(-5)).toBe('4.');
    expect(visible[1]).not.toContain('4.');
    expect(visible[1]!.slice(-2)).toEqual(['5.', 'Serve.']);
  });

  it('writes no ListNumbering attribute (not required by PDF/UA-1; PDFKit cannot write it)', async () => {
    const pdf = await renderToBuffer(fixture);
    expect(pdf.toString('latin1')).not.toContain('ListNumbering');
  });
});

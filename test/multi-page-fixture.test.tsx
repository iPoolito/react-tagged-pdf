import { describe, expect, it } from 'vitest';
import { renderToBuffer } from '../src/index.js';
import fixture, { SPLIT_TEXT } from './fixtures/multi-page.js';
import { structOutline, textRuns } from './support/read-pdf.js';

describe('multi-page fixture (validated by veraPDF in npm run test:ua)', () => {
  it('has one structure element per split paragraph and section', async () => {
    const pdf = await renderToBuffer(fixture);
    const split = JSON.stringify(SPLIT_TEXT);
    expect(await structOutline(pdf)).toBe(
      [
        'Document',
        '  H1 "Multi-page report"',
        `  P ${split}`,
        '  Sect',
        '    H2 "Framed section"',
        `    P ${split}`,
        '  H2 "After a page break"',
        '  P "This heading starts at the top of a new page."',
        '  H2 [Lang="fr-FR"] "Annexe"',
        '  P [Lang="fr-FR"] "Un modèle de page paysage, sur sa propre page."',
      ].join('\n'),
    );
  });

  it('spreads the content over several Letter pages and one landscape page', async () => {
    const pages = await textRuns(await renderToBuffer(fixture));
    const sizes = pages.map((p) => `${p.width}x${p.height}`);
    expect(sizes.length).toBeGreaterThanOrEqual(4);
    expect(sizes.slice(0, -1).every((s) => s === '612x792')).toBe(true);
    expect(sizes.at(-1)).toBe('841.89x595.28');
    expect(pages.at(-2)!.runs[0]!.str).toBe('After a page break');
  });
});

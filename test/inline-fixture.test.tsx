import { describe, expect, it } from 'vitest';
import { renderToBuffer } from '../src/index.js';
import fixture, { WRAPPING_LINK } from './fixtures/inline-links.js';
import { linkAnnotations, structOutline } from './support/read-pdf.js';

describe('inline styles and links fixture (validated by veraPDF in npm run test:ua)', () => {
  it('has no element per styled run, and one Link element per link with one OBJR per line', async () => {
    const pdf = await renderToBuffer(fixture);
    expect(await structOutline(pdf)).toBe(
      [
        'Document',
        '  H1 "Inline styles"',
        '  P "Mixed runs: bold, italic, red, larger and both, all in one paragraph that wraps."',
        '  P "Here is [Link] , then a [Link] and an [Link] ."',
        `    Link ${JSON.stringify(WRAPPING_LINK)} (2 OBJR)`,
        '    Link "short one" (1 OBJR)',
        '    Link "email link" (1 OBJR)',
      ].join('\n'),
    );
  });

  it('fills every annotation /Contents: the link text, or the description', async () => {
    const annots = await linkAnnotations(await renderToBuffer(fixture));
    expect(annots.map((a) => [a.uri, a.contents])).toEqual([
      ['https://example.com/inline', WRAPPING_LINK],
      ['https://example.com/inline', WRAPPING_LINK],
      ['https://example.com/terms', 'Terms of service'],
      ['mailto:team@example.com', 'email link'],
    ]);
    for (const a of annots) expect(a.parentTreeOwner).toBe(a.owner?.ref);
  });
});

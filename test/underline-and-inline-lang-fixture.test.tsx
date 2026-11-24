import { describe, expect, it } from 'vitest';
import { renderToBuffer } from '../src/index.js';
import fixture, { WRAPPING_LINK } from './fixtures/underline-and-inline-lang.js';
import { paintedRects, structOutline } from './support/read-pdf.js';

describe('underline and inline language fixture (validated by veraPDF in npm run test:ua)', () => {
  it('nests Span elements with Lang and Link elements in reading order', async () => {
    const pdf = await renderToBuffer(fixture);
    expect(await structOutline(pdf)).toBe(
      [
        'Document',
        '  H1 "Subrayado"',
        '  P "Aquí hay [Link] , y otro [Link] ."',
        `    Link ${JSON.stringify(WRAPPING_LINK)} (2 OBJR)`,
        '    Link "sin subrayar" (2 OBJR)',
        '  P "Ella dijo [Span] al entrar. Lea [Link] o [Span] ."',
        '    Span [Lang="en-US"] "good morning"',
        '    Link "la guía [Span]" (2 OBJR)',
        '      Span [Lang="en-US"] "Getting Started"',
        '    Span [Lang="en-GB"] "the [Link]"',
        '      Link "colour chart" (1 OBJR)',
      ].join('\n'),
    );
  });

  it('draws every underline inside tagged content: none for the undecorated link', async () => {
    const rects = await paintedRects(await renderToBuffer(fixture));
    // Heading; the long link's two lines; none for "sin subrayar"; the guide link's own text, then its
    // Span on the next line; the colour chart link.
    expect(rects.map((r) => r.tag)).toEqual(['H1', 'Link', 'Link', 'Link', 'Span', 'Link']);
  });
});

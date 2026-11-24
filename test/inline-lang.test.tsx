import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { Document, H1, Link, P, Page, type PageProps, Span, renderToBuffer } from '../src/index.js';
import { linkAnnotations, paintedRects, structOutline } from './support/read-pdf.js';

const render = (children: ReactNode, page: Omit<PageProps, 'children'> = {}) =>
  renderToBuffer(
    <Document title="Inline language" lang="es-ES">
      <Page {...page}>{children}</Page>
    </Document>,
  );
const URL = 'https://example.com';

describe('Span lang', () => {
  it('a Span without lang stays untagged', async () => {
    const pdf = await render(
      <P>
        Hola <Span style={{ fontWeight: 'bold' }}>mundo</Span>.
      </P>,
    );
    expect(await structOutline(pdf)).toBe(['Document', '  P "Hola mundo."'].join('\n'));
  });

  it('is a Span element with Lang, nested in its paragraph in reading order', async () => {
    const pdf = await render(
      <P>
        Dijo <Span lang="en-US">good morning</Span> y se fue.
      </P>,
    );
    expect(await structOutline(pdf)).toBe(
      ['Document', '  P "Dijo [Span] y se fue."', '    Span [Lang="en-US"] "good morning"'].join('\n'),
    );
  });

  it('works in headings, keeping the inherited style and nested untagged spans', async () => {
    const pdf = await render(
      <H1>
        Título <Span lang="en-GB">with <Span style={{ fontStyle: 'italic' }}>colour</Span></Span>
      </H1>,
    );
    expect(await structOutline(pdf)).toBe(
      ['Document', '  H1 "Título [Span]"', '    Span [Lang="en-GB"] "with colour"'].join('\n'),
    );
  });

  it('can hold a Link, which nests inside it', async () => {
    const pdf = await render(
      <P>
        Vea <Span lang="en-US">the <Link href={URL}>privacy policy</Link> page</Span> hoy.
      </P>,
    );
    expect(await structOutline(pdf)).toBe(
      [
        'Document',
        '  P "Vea [Span] hoy."',
        '    Span [Lang="en-US"] "the [Link] page"',
        '      Link "privacy policy" (1 OBJR)',
      ].join('\n'),
    );
    const [annot] = await linkAnnotations(pdf);
    expect(annot!.owner?.type).toBe('Link');
    expect(annot!.parentTreeOwner).toBe(annot!.owner?.ref);
    // The link underline is drawn in the link's own content.
    expect((await paintedRects(pdf)).map((r) => r.tag)).toEqual(['Link']);
  });

  it('can sit inside a Link: the Span nests in the Link, which keeps its annotation and underline', async () => {
    const pdf = await render(
      <P>
        Lea <Link href={URL}>la guía <Span lang="en-US">Getting Started</Span></Link>.
      </P>,
    );
    expect(await structOutline(pdf)).toBe(
      [
        'Document',
        '  P "Lea [Link] ."',
        '    Link "la guía [Span]" (1 OBJR)',
        '      Span [Lang="en-US"] "Getting Started"',
      ].join('\n'),
    );
    expect((await linkAnnotations(pdf)).map((a) => [a.owner?.type, a.contents])).toEqual([
      ['Link', 'la guía Getting Started'],
    ]);
    // Both parts of the link are underlined, each inside its own marked content.
    expect((await paintedRects(pdf)).map((r) => r.tag)).toEqual(['Link', 'Span']);
  });

  it('stays one Span element when it wraps across a page break', async () => {
    const nineLines = Array.from({ length: 9 }, (_, i) => (
      <P key={i} style={{ lineHeight: 20, marginBottom: 0 }}>{`Línea ${i + 1}`}</P>
    ));
    const pdf = await render(
      <>
        {nineLines}
        <P style={{ lineHeight: 20 }}>
          {'aaaa '.repeat(4)}
          <Span lang="en-US">an English phrase that wraps onto the next page</Span>
        </P>
      </>,
      { size: [250, 300], margin: 50 },
    );
    expect((await structOutline(pdf)).split('\n').slice(-2)).toEqual([
      '  P "aaaa aaaa aaaa aaaa [Span]"',
      '    Span [Lang="en-US"] "an English phrase that wraps onto the next page"',
    ]);
  });

  it.each([' ', '', 42])('rejects the invalid lang %j like the block lang prop', async (lang) => {
    await expect(render(<P><Span lang={lang as string}>x</Span></P>)).rejects.toThrow(
      '<Span> `lang` must be a non-empty BCP 47 language tag, e.g. lang="es-ES".',
    );
  });
});

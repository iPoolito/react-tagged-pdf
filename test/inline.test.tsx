import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { Document, H1, Link, P, Page, type PageProps, Section, Span, renderToBuffer } from '../src/index.js';
import { linkAnnotations, pageContent, structOutline, textRuns } from './support/read-pdf.js';

const render = (children: ReactNode, page: Omit<PageProps, 'children'> = {}) =>
  renderToBuffer(
    <Document title="Inline" lang="en-US">
      <Page {...page}>{children}</Page>
    </Document>,
  );
const words = (s: string) => s.split(/\s+/).filter(Boolean);

const runsOf = async (pdf: Uint8Array) => (await textRuns(pdf)).flatMap((p) => p.runs);
const runWith = async (pdf: Uint8Array, str: string) => {
  const run = (await runsOf(pdf)).find((r) => r.str.trim() === str);
  if (!run) throw new Error(`no run ${JSON.stringify(str)}`);
  return run;
};

describe('Span', () => {
  it('draws a bold span in the bold face, inside the one P of its paragraph', async () => {
    const pdf = await render(
      <P>
        Some <Span style={{ fontWeight: 'bold' }}>bold</Span> words
      </P>,
    );
    expect((await runWith(pdf, 'bold')).font).toBe('NotoSans-Bold');
    expect((await runWith(pdf, 'Some')).font).toBe('NotoSans-Regular');
    expect(await structOutline(pdf)).toBe(['Document', '  P "Some bold words"'].join('\n'));
  });

  it('nests: an italic span inside a bold span is bold italic, and color inherits into it', async () => {
    const pdf = await render(
      <P>
        Plain{' '}
        <Span style={{ fontWeight: 'bold', color: '#ff0000' }}>
          bold <Span style={{ fontStyle: 'italic' }}>both</Span>
        </Span>{' '}
        <Span style={{ fontStyle: 'italic', color: 'blue' }}>italic</Span>
      </P>,
    );
    expect((await runWith(pdf, 'bold')).font).toBe('NotoSans-Bold');
    expect((await runWith(pdf, 'both')).font).toBe('NotoSans-BoldItalic');
    expect((await runWith(pdf, 'italic')).font).toBe('NotoSans-Italic');
    // Fill colors are set, in drawing order: black, red (bold), red (both), black (space), blue.
    const content = await pageContent(pdf);
    const fills = [...content.matchAll(/\b([\d.]+ [\d.]+ [\d.]+) (?:rg|scn)\b/g)].map((m) => m[1]);
    expect(fills).toEqual(['0 0 0', '1 0 0', '1 0 0', '0 0 0', '0 0 1']);
  });

  it('works inside headings: a span can drop the heading weight but keeps its size', async () => {
    const pdf = await render(
      <H1>
        Title <Span style={{ fontWeight: 'normal' }}>subtitle</Span>
      </H1>,
    );
    expect((await runWith(pdf, 'Title')).font).toBe('NotoSans-Bold');
    const sub = await runWith(pdf, 'subtitle');
    expect(sub.font).toBe('NotoSans-Regular');
    expect(sub.size).toBeCloseTo(24);
    expect(await structOutline(pdf)).toBe(['Document', '  H1 "Title subtitle"'].join('\n'));
  });

  it('sets runs of different sizes on one baseline, and the line grows to fit the largest', async () => {
    const pdf = await render(
      <>
        <P style={{ marginBottom: 0 }}>small</P>
        <P style={{ marginBottom: 0 }}>
          left <Span style={{ fontSize: 36 }}>BIG</Span> right
        </P>
        <P>after</P>
      </>,
    );
    const [small, left, big, right, after] = await Promise.all(
      ['small', 'left', 'BIG', 'right', 'after'].map((s) => runWith(pdf, s)),
    );
    expect(big!.size).toBeCloseTo(36);
    expect(left!.y).toBeCloseTo(big!.y);
    expect(right!.y).toBeCloseTo(big!.y);
    // Noto Sans: ascender 1.069 em, descender 0.293 em, no line gap. Line box tops: 72, 72 + 16.344.
    // The mixed line's baseline sits 1.069 × 36 below its top; the next line starts 1.362 × 36 below it.
    const top = (run: { y: number }) => 841.89 - run.y;
    expect(top(small!)).toBeCloseTo(72 + 1.069 * 12, 1);
    expect(top(big!)).toBeCloseTo(72 + 16.344 + 1.069 * 36, 1);
    expect(top(after!)).toBeCloseTo(72 + 16.344 + 1.362 * 36 + 1.069 * 12, 1);
  });

  it('never breaks a line at a run boundary inside a word', async () => {
    const pdf = await render(
      <P>
        {'aaaa '.repeat(9)}un<Span style={{ fontWeight: 'bold' }}>break</Span>able
      </P>,
      { size: [200, 400], margin: 20 },
    );
    const [un, brk, able] = await Promise.all(['un', 'break', 'able'].map((s) => runWith(pdf, s)));
    expect(brk!.y).toBeCloseTo(un!.y);
    expect(able!.y).toBeCloseTo(un!.y);
    expect(brk!.x).toBeCloseTo(un!.x + un!.width, 1);
    expect(able!.x).toBeCloseTo(brk!.x + brk!.width, 1);
  });

  it('wraps mixed runs within the margins and splits them line-wise across pages as one P', async () => {
    const parts = Array.from({ length: 60 }, (_, i) =>
      i % 3 === 1 ? (
        <Span key={i} style={{ fontWeight: 'bold', fontSize: 14 }}>{`bold${i} `}</Span>
      ) : i % 3 === 2 ? (
        <Span key={i} style={{ fontStyle: 'italic', color: 'green' }}>{`italic${i} `}</Span>
      ) : (
        `plain${i} `
      ),
    );
    const expected = Array.from({ length: 60 }, (_, i) => `${['plain', 'bold', 'italic'][i % 3]}${i}`);
    const pdf = await render(<P>{parts}</P>, { size: [300, 300], margin: 50 });
    const pages = await textRuns(pdf);
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      for (const run of page.runs) {
        expect(run.x).toBeGreaterThanOrEqual(50 - 0.01);
        expect(run.x + run.width).toBeLessThanOrEqual(250 + 0.01);
        expect(run.y).toBeGreaterThanOrEqual(50);
        expect(run.y).toBeLessThanOrEqual(250);
      }
    }
    expect(words(pages.flatMap((p) => p.runs.map((r) => r.str)).join(' '))).toEqual(expected);
    expect(await structOutline(pdf)).toBe(['Document', `  P ${JSON.stringify(expected.join(' '))}`].join('\n'));
  });
});

describe('Span errors', () => {
  it('rejects box properties in a span style', async () => {
    await expect(
      render(
        <P>
          a <Span style={{ padding: 4 } as never}>b</Span>
        </P>,
      ),
    ).rejects.toThrow(
      '<Span> `style.padding` is not supported on inline elements; use it on the enclosing block. ' +
        'Inline styles support fontFamily, fontSize, fontWeight, fontStyle, color.',
    );
  });

  it('rejects invalid style values with the span named', async () => {
    await expect(render(<P><Span style={{ color: 'nope' }}>b</Span></P>)).rejects.toThrow('<Span> `style.color`');
  });

  it('only contains text and spans', async () => {
    await expect(render(<P><Span><Section /></Span></P>)).rejects.toThrow(
      '<Span> may only contain text, <Span> and <Link>, found <Section>.',
    );
  });

  it('is not a block', async () => {
    await expect(render(<Span>loose</Span>)).rejects.toThrow(
      '<Page> may only contain <P>, <H1>–<H6>, <Section> and <PageBreak> children, found <Span>.',
    );
  });
});

/** Width of `text` as drawn alone in a default paragraph, read back from the PDF. */
const drawnWidth = async (text: string) => (await runWith(await render(<P>{text}</P>), text)).width;

describe('Link', () => {
  const POLICY = 'https://example.com/policy';

  it('is a Link element inside its paragraph, holding its text and an OBJR to its annotation', async () => {
    const pdf = await render(
      <P>
        Read the <Link href={POLICY}>privacy policy</Link> today.
      </P>,
    );
    expect(await structOutline(pdf)).toBe(
      ['Document', '  P "Read the [Link] today."', '    Link "privacy policy" (1 OBJR)'].join('\n'),
    );
    const [annot, ...rest] = await linkAnnotations(pdf);
    expect(rest).toEqual([]);
    expect(annot!.uri).toBe(POLICY);
    expect(annot!.owner?.type).toBe('Link');
    expect(annot!.structParent).toBeTypeOf('number');
    expect(annot!.parentTreeOwner).toBe(annot!.owner?.ref);
  });

  it('covers the link text: from where it starts on the line to its end, over the line box', async () => {
    const pdf = await render(
      <P>
        Read the <Link href={POLICY}>privacy policy</Link> today.
      </P>,
    );
    const [annot] = await linkAnnotations(pdf);
    const [x1, y1, x2, y2] = annot!.rect;
    const start = 72 + (await drawnWidth('Read the privacy policy')) - (await drawnWidth('privacy policy'));
    expect(x1).toBeCloseTo(start, 1);
    expect(x2! - x1!).toBeCloseTo(await drawnWidth('privacy policy'), 1);
    // A4, 72 pt top margin, Noto Sans 12 pt line box of 16.344 pt.
    expect(y2).toBeCloseTo(841.89 - 72, 1);
    expect(y2! - y1!).toBeCloseTo(16.344, 1);
  });

  it('fills /Contents with the visible link text, whitespace collapsed', async () => {
    const pdf = await render(
      <P>
        See <Link href={POLICY}>
          the <Span style={{ fontWeight: 'bold' }}>privacy</Span>
          {'  '}policy
        </Link>
      </P>,
    );
    expect((await linkAnnotations(pdf)).map((a) => a.contents)).toEqual(['the privacy policy']);
  });

  it('uses the description prop as /Contents instead', async () => {
    const pdf = await render(
      <P>
        Details <Link href={POLICY} description="Privacy policy (opens example.com)">here</Link>.
      </P>,
    );
    expect((await linkAnnotations(pdf)).map((a) => a.contents)).toEqual(['Privacy policy (opens example.com)']);
  });

  it('writes non-ASCII link text and descriptions to /Contents exactly', async () => {
    const pdf = await render(
      <P lang="es-ES">
        Lea los <Link href={POLICY}>Términos y condiciones</Link> y la{' '}
        <Link href={POLICY} description="Política de privacidad – “España” 🔒">política</Link>.
      </P>,
    );
    expect((await linkAnnotations(pdf)).map((a) => a.contents)).toEqual([
      'Términos y condiciones',
      'Política de privacidad – “España” 🔒',
    ]);
  });

  it('works inside headings and spans, taking the surrounding style', async () => {
    const pdf = await render(
      <H1>
        Read <Span style={{ fontStyle: 'italic' }}><Link href={POLICY}>this</Link></Span>
      </H1>,
    );
    expect(await structOutline(pdf)).toBe(['Document', '  H1 "Read [Link]"', '    Link "this" (1 OBJR)'].join('\n'));
    const run = await runWith(pdf, 'this');
    expect(run.font).toBe('NotoSans-BoldItalic');
    expect(run.size).toBeCloseTo(24);
  });

  it('gives a link that wraps onto two lines one rectangle per line, both under the one Link', async () => {
    const pdf = await render(
      <P style={{ lineHeight: 20 }}>
        {'aaaa '.repeat(4)}
        <Link href={POLICY}>a link that wraps onto the next line</Link> after
      </P>,
      { size: [250, 400], margin: 20 },
    );
    expect(await structOutline(pdf)).toBe(
      [
        'Document',
        '  P "aaaa aaaa aaaa aaaa [Link] after"',
        '    Link "a link that wraps onto the next line" (2 OBJR)',
      ].join('\n'),
    );
    const annots = await linkAnnotations(pdf);
    expect(annots).toHaveLength(2);
    const [first, second] = annots;
    expect(first!.owner).toEqual(second!.owner);
    expect(first!.owner?.type).toBe('Link');
    expect(annots.map((a) => a.parentTreeOwner)).toEqual([first!.owner?.ref, first!.owner?.ref]);
    expect(annots.map((a) => a.contents)).toEqual(Array(2).fill('a link that wraps onto the next line'));
    // Consecutive 20 pt line boxes; the second rectangle starts at the left margin.
    expect(first!.rect[1]! - second!.rect[1]!).toBeCloseTo(20);
    expect(first!.rect[3]! - first!.rect[1]!).toBeCloseTo(20);
    expect(second!.rect[0]).toBeCloseTo(20);
    // Each rectangle stays inside the content box.
    for (const a of annots) expect(a.rect[2]).toBeLessThanOrEqual(230 + 0.01);
  });

  it('continues a link on the next page under the same Link element', async () => {
    const nineLines = Array.from({ length: 9 }, (_, i) => (
      <P key={i} style={{ lineHeight: 20, marginBottom: 0 }}>{`Line ${i + 1}`}</P>
    ));
    // The content area holds ten 20 pt lines, so the paragraph's first line is the page's last.
    const pdf = await render(
      <>
        {nineLines}
        <P style={{ lineHeight: 20 }}>
          {'aaaa '.repeat(4)}
          <Link href={POLICY}>a link that wraps onto the next line</Link>
        </P>
      </>,
      { size: [250, 300], margin: 50 },
    );
    const annots = await linkAnnotations(pdf);
    expect(annots.map((a) => a.page)).toEqual([1, 2, 2]);
    const owner = annots[0]!.owner;
    expect(owner?.type).toBe('Link');
    expect(annots.map((a) => a.owner)).toEqual([owner, owner, owner]);
    expect(annots.map((a) => a.parentTreeOwner)).toEqual(Array(3).fill(owner?.ref));
    expect((await structOutline(pdf)).split('\n').slice(-2)).toEqual([
      '  P "aaaa aaaa aaaa aaaa [Link]"',
      '    Link "a link that wraps onto the next line" (3 OBJR)',
    ]);
  });
});

describe('Link errors', () => {
  it.each(['#section-2', '/terms', 'terms.html', 'www.example.com'])('rejects the non-URL href %j', async (href) => {
    await expect(render(<P><Link href={href}>x</Link></P>)).rejects.toThrow(
      `<Link> href ${JSON.stringify(href)} is not supported yet: only external URLs with a scheme ` +
        '(e.g. "https://example.com") are; internal links and anchors are not.',
    );
  });

  it.each([undefined, '', ' '])('requires an href (got %j)', async (href) => {
    await expect(render(<P><Link href={href as string}>x</Link></P>)).rejects.toThrow(
      '<Link> requires a non-empty `href` prop: an external URL such as "https://example.com".',
    );
  });

  it('accepts mailto: and other URL schemes', async () => {
    const pdf = await render(<P><Link href="mailto:team@example.com">write to us</Link></P>);
    expect((await linkAnnotations(pdf)).map((a) => a.uri)).toEqual(['mailto:team@example.com']);
  });

  it('needs visible text', async () => {
    await expect(render(<P>a <Link href="https://example.com" description="Home"> </Link></P>)).rejects.toThrow(
      '<Link> href "https://example.com" has no visible text; put the link text inside <Link>.',
    );
  });

  it('rejects an empty description', async () => {
    await expect(render(<P><Link href="https://example.com" description=" ">x</Link></P>)).rejects.toThrow(
      '<Link> `description` must be a non-empty string',
    );
  });

  it('cannot be nested', async () => {
    await expect(
      render(<P><Link href="https://a.example"><Link href="https://b.example">x</Link></Link></P>),
    ).rejects.toThrow('<Link> may only contain text and <Span>, found <Link>.');
  });

  it('is not a block', async () => {
    await expect(render(<Link href="https://example.com">x</Link>)).rejects.toThrow('found <Link>.');
  });
});

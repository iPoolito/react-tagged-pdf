import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { Document, H2, Link, P, Page, type PageProps, Span, renderToBuffer } from '../src/index.js';
import { pageContent, paintedRects, textRuns } from './support/read-pdf.js';

const render = (children: ReactNode, page: Omit<PageProps, 'children'> = {}) =>
  renderToBuffer(
    <Document title="Decoration" lang="en-US">
      <Page {...page}>{children}</Page>
    </Document>,
  );
const URL = 'https://example.com';

const runWith = async (pdf: Uint8Array, str: string) => {
  const run = (await textRuns(pdf)).flatMap((p) => p.runs).find((r) => r.str.trim() === str);
  if (!run) throw new Error(`no run ${JSON.stringify(str)}`);
  return run;
};

// Noto Sans post table: underlinePosition -100, underlineThickness 50, 1000 units per em.
// The top of the underline is 0.1 em below the baseline, and it is 0.05 em thick.
type Box = { x: number; y: number; width: number; height: number };
const expectUnderlineOf = (rect: Box, run: { x: number; y: number; width: number; size: number }) => {
  expect(rect.x).toBeCloseTo(run.x, 2);
  expect(rect.width).toBeCloseTo(run.width, 1);
  expect(rect.height).toBeCloseTo(0.05 * run.size, 3);
  expect(rect.y + rect.height).toBeCloseTo(run.y - 0.1 * run.size, 2);
};

describe('Link underline', () => {
  it('underlines a link by default, inside the Link marked content, from the font underline metrics', async () => {
    const pdf = await render(
      <P>
        Read the <Link href={URL}>policy</Link> today.
      </P>,
    );
    const rects = await paintedRects(pdf);
    expect(rects).toHaveLength(1);
    expect(rects[0]!.tag).toBe('Link');
    expectUnderlineOf(rects[0]!, await runWith(pdf, 'policy'));
  });

  it("draws no underline for a link styled textDecoration: 'none'", async () => {
    const pdf = await render(
      <P>
        Read the <Link href={URL} style={{ textDecoration: 'none' }}>policy</Link> today.
      </P>,
    );
    expect(await paintedRects(pdf)).toEqual([]);
  });

  it('imposes no link color: text and underline take the inherited color, or the link style color', async () => {
    const pdf = await render(
      <P style={{ color: '#00ff00' }}>
        <Link href={URL}>green</Link> <Link href={URL} style={{ color: '#0000ff' }}>blue</Link>
      </P>,
    );
    const fills = [...(await pageContent(pdf)).matchAll(/\b([\d.]+ [\d.]+ [\d.]+) (?:rg|scn)\b/g)].map((m) => m[1]);
    // Each link: text fill, then its underline fill, in the same color; the space between is green.
    expect(fills).toEqual(['0 1 0', '0 1 0', '0 1 0', '0 0 1', '0 0 1']);
  });

  it('a span inside a link can turn the underline off for its part only', async () => {
    const pdf = await render(
      <P>
        <Link href={URL}>
          on <Span style={{ textDecoration: 'none', fontWeight: 'bold' }}>off</Span>
        </Link>
      </P>,
    );
    const [rect, ...rest] = await paintedRects(pdf);
    expect(rest).toEqual([]);
    // Under "on " (a space inside the line is underlined, as in CSS), stopping where "off" starts.
    expect(rect!.x).toBeCloseTo((await runWith(pdf, 'on')).x, 2);
    expect(rect!.x + rect!.width).toBeCloseTo((await runWith(pdf, 'off')).x, 1);
  });

  it('draws one segment per line fragment of a wrapping link, never under the trailing space at a line end', async () => {
    const pdf = await render(
      <P>
        {'aaaa '.repeat(4)}
        <Link href={URL}>a link that wraps onto the next line</Link> after
      </P>,
      { size: [250, 400], margin: 20 },
    );
    const rects = await paintedRects(pdf);
    expect(rects).toHaveLength(2);
    // The first line ends inside the link: its underline stops at the last glyph, not the space after it.
    const first = (await textRuns(pdf))[0]!.runs.find((r) => r.str.startsWith('a link'))!;
    expectUnderlineOf(rects[0]!, first);
    expect(rects[1]!.x).toBeCloseTo(20);
    expect(rects[1]!.y).toBeLessThan(rects[0]!.y);
    for (const r of rects) expect(r.x + r.width).toBeLessThanOrEqual(230 + 0.01);
  });

  it('continues the underline on the next page inside the Link content there', async () => {
    const nineLines = Array.from({ length: 9 }, (_, i) => (
      <P key={i} style={{ lineHeight: 20, marginBottom: 0 }}>{`Line ${i + 1}`}</P>
    ));
    const pdf = await render(
      <>
        {nineLines}
        <P style={{ lineHeight: 20 }}>
          {'aaaa '.repeat(4)}
          <Link href={URL}>a link that wraps onto the next line</Link>
        </P>
      </>,
      { size: [250, 300], margin: 50 },
    );
    const rects = await paintedRects(pdf);
    expect(rects.map((r) => [r.page, r.tag])).toEqual([
      [1, 'Link'],
      [2, 'Link'],
      [2, 'Link'],
    ]);
  });
});

describe('textDecoration style', () => {
  it('underlines a paragraph, inherited by its spans, inside the P marked content', async () => {
    const pdf = await render(
      <P style={{ textDecoration: 'underline' }}>
        plain <Span style={{ fontWeight: 'bold' }}>bold</Span>
      </P>,
    );
    const rects = await paintedRects(pdf);
    expect(rects.map((r) => r.tag)).toEqual(['P', 'P']);
    expectUnderlineOf(rects[1]!, await runWith(pdf, 'bold'));
  });

  it('underlines a heading and a span, scaled to their font sizes', async () => {
    const pdf = await render(
      <>
        <H2 style={{ textDecoration: 'underline' }}>Heading</H2>
        <P>
          some <Span style={{ textDecoration: 'underline', fontSize: 30 }}>big</Span> text
        </P>
      </>,
    );
    const rects = await paintedRects(pdf);
    expect(rects.map((r) => r.tag)).toEqual(['H2', 'P']);
    expectUnderlineOf(rects[0]!, await runWith(pdf, 'Heading'));
    expectUnderlineOf(rects[1]!, await runWith(pdf, 'big'));
  });

  it('does not change line breaking', async () => {
    const text = 'word '.repeat(40);
    const plain = await textRuns(await render(<P>{text}</P>, { size: [200, 600], margin: 20 }));
    const underlined = await textRuns(
      await render(<P style={{ textDecoration: 'underline' }}>{text}</P>, { size: [200, 600], margin: 20 }),
    );
    expect(underlined[0]!.runs.map((r) => [r.str, r.y])).toEqual(plain[0]!.runs.map((r) => [r.str, r.y]));
  });

  it.each(['line-through', 'Underline', true])('rejects textDecoration %j', async (value) => {
    await expect(render(<P style={{ textDecoration: value as never }}>x</P>)).rejects.toThrow(
      `<P> \`style.textDecoration\` must be 'underline' or 'none'; got ${JSON.stringify(value)}.`,
    );
  });
});

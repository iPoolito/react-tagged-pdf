import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { Document, H1, P, Page, PageBreak, type PageProps, Section, renderToBuffer } from '../src/index.js';
import { pageContent, structOutline, textRuns } from './support/read-pdf.js';

const render = (children: ReactNode, page: Omit<PageProps, 'children'> = {}) =>
  renderToBuffer(
    <Document title="Pages" lang="en-US">
      <Page {...page}>{children}</Page>
    </Document>,
  );

const words = (s: string) => s.split(/\s+/).filter(Boolean);
const LONG = Array.from({ length: 900 }, (_, i) => `word${i}`).join(' ');

/** A small page whose content area is exactly 10 lines of 20 pt: 300 × 300 with 50 pt margins. */
const SMALL: Omit<PageProps, 'children'> = { size: [300, 300], margin: 50 };
const line = { lineHeight: 20, marginBottom: 0 } as const;
const tenLines = Array.from({ length: 10 }, (_, i) => (
  <P key={i} style={line}>
    {`Line ${i + 1}`}
  </P>
));

/** Artifact marked-content bodies of one page. */
const artifacts = async (pdf: Uint8Array, page: number) =>
  [...(await pageContent(pdf, page)).matchAll(/\/Artifact <<\s*\/Type \/Layout\s*>> BDC([\s\S]*?)EMC/g)].map(
    (m) => m[1]!,
  );

describe('page size and margins', () => {
  it.each([
    ['A3', 841.89, 1190.55],
    ['A4', 595.28, 841.89],
    ['A5', 419.53, 595.28],
    ['Letter', 612, 792],
    ['Legal', 612, 1008],
  ] as const)('renders %s pages', async (size, width, height) => {
    const [page] = await textRuns(await render(<P>Sized</P>, { size }));
    expect(page!.width).toBeCloseTo(width);
    expect(page!.height).toBeCloseTo(height);
  });

  it('renders a custom [width, height] size in points', async () => {
    const [page] = await textRuns(await render(<P>Landscape</P>, { size: [841.89, 595.28] }));
    expect(page!.width).toBeCloseTo(841.89);
    expect(page!.height).toBeCloseTo(595.28);
  });

  it('defaults to A4 with 72 pt margins', async () => {
    const [page] = await textRuns(await render(<P>Default</P>));
    expect(page!.width).toBeCloseTo(595.28);
    expect(page!.runs[0]!.x).toBeCloseTo(72);
  });

  it('keeps text inside numeric margins on every page', async () => {
    const pages = await textRuns(await render(<P>{LONG}</P>, { margin: 36 }));
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      for (const run of page.runs) {
        expect(run.x).toBeGreaterThanOrEqual(36 - 0.01);
        expect(run.x + run.width).toBeLessThanOrEqual(page.width - 36 + 0.01);
        expect(run.y).toBeGreaterThanOrEqual(36);
        expect(run.y).toBeLessThanOrEqual(page.height - 36);
      }
    }
  });

  it('applies per-side margins, defaulting the sides left out to 72', async () => {
    const pages = await textRuns(await render(<P>{LONG}</P>, { margin: { left: 20, bottom: 200 } }));
    for (const page of pages) {
      for (const run of page.runs) {
        expect(run.x).toBeGreaterThanOrEqual(20 - 0.01);
        expect(run.x + run.width).toBeLessThanOrEqual(page.width - 72 + 0.01);
        expect(run.y).toBeGreaterThanOrEqual(200);
      }
    }
    expect(Math.min(...pages[0]!.runs.map((r) => r.x))).toBeCloseTo(20);
  });

  it.each([
    [{ size: 'B5' }, "<Page> `size` must be one of 'A3', 'A4', 'A5', 'Letter', 'Legal' or [width, height]"],
    [{ size: [0, 100] }, '<Page> `size` must be one of'],
    [{ margin: -1 }, '<Page> `margin` must be a non-negative number of points; got -1.'],
    [{ margin: { top: -5 } }, '<Page> `margin.top` must be a non-negative number of points; got -5.'],
    [{ margin: { inner: 5 } }, '<Page> `margin` has unknown key "inner"; use top, right, bottom, left.'],
    [{ margin: '1in' }, '<Page> `margin` must be a number of points or { top, right, bottom, left }; got "1in".'],
    [{ size: [100, 100], margin: 50 }, '<Page> margins leave no content area: 0 × 0 pt on a 100 × 100 pt page.'],
  ])('rejects invalid page props %j', async (props, message) => {
    await expect(render(<P>x</P>, props as never)).rejects.toThrow(message);
  });
});

describe('content flowing across pages', () => {
  it('splits a long paragraph line-wise into one P structure element', async () => {
    const pdf = await render(<P>{LONG}</P>);
    const pages = await textRuns(pdf);
    expect(pages.length).toBeGreaterThan(1);
    expect(words(pages.flatMap((p) => p.runs.map((r) => r.str)).join(' '))).toEqual(words(LONG));
    expect(await structOutline(pdf)).toBe(['Document', `  P ${JSON.stringify(LONG)}`].join('\n'));
  });

  it('fills a page exactly, then continues at the top margin of the next page', async () => {
    const pages = await textRuns(await render([...tenLines, <P key="next" style={line}>Next</P>], SMALL));
    expect(pages.map((p) => p.runs.map((r) => r.str))).toEqual([tenLines.map((_, i) => `Line ${i + 1}`), ['Next']]);
    expect(pages[1]!.runs[0]!.y).toBeCloseTo(pages[0]!.runs[0]!.y);
  });

  it('drops the top margin of a block that a page break moves to the next page', async () => {
    const pages = await textRuns(
      await render([...tenLines, <P key="next" style={{ ...line, marginTop: 40 }}>Next</P>], SMALL),
    );
    expect(pages[1]!.runs[0]!.str).toBe('Next');
    expect(pages[1]!.runs[0]!.y).toBeCloseTo(pages[0]!.runs[0]!.y);
  });

  it('keeps a split paragraph in its language and style', async () => {
    const pdf = await renderToBuffer(
      <Document title="Pages" lang="en-US">
        <Page lang="es-ES">
          <P style={{ fontSize: 14 }}>{LONG}</P>
        </Page>
      </Document>,
    );
    expect(await structOutline(pdf)).toBe(['Document', `  P [Lang="es-ES"] ${JSON.stringify(LONG)}`].join('\n'));
    const pages = await textRuns(pdf);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flatMap((p) => p.runs).every((r) => Math.abs(r.size - 14) < 0.01)).toBe(true);
  });

  it('keeps a split Section as one Sect and draws a sliced frame on each page', async () => {
    const pdf = await render(
      <Section style={{ borderWidth: 2, borderColor: '#00ff00', backgroundColor: '#0000ff', padding: 6 }}>
        <H1>Title</H1>
        <P>{LONG}</P>
      </Section>,
    );
    expect(await structOutline(pdf)).toBe(['Document', '  Sect', '    H1 "Title"', `    P ${JSON.stringify(LONG)}`].join('\n'));
    const pages = await textRuns(pdf);
    expect(pages.length).toBeGreaterThanOrEqual(2);
    for (let n = 1; n <= pages.length; n++) {
      const painted = (await artifacts(pdf, n)).join('\n');
      expect(painted).toMatch(/\b0 0 1 (rg|scn)\b/); // background on every page
      expect(painted).toMatch(/\b0 1 0 (RG|SCN)\b/); // border on every page
      // Two sides, plus the top edge on the first page and the bottom edge on the last.
      const edges = painted.match(/\bm\b/g)?.length;
      expect(edges).toBe(n === 1 || n === pages.length ? 3 : 2);
    }
  });

  it('moves a block that has not started yet to the next page whole, with its border', async () => {
    const pdf = await render(
      [...tenLines, <Section key="boxed" style={{ borderWidth: 1 }}><P style={line}>Boxed</P></Section>],
      SMALL,
    );
    const pages = await textRuns(pdf);
    expect(pages.map((p) => p.runs.map((r) => r.str))).toEqual([tenLines.map((_, i) => `Line ${i + 1}`), ['Boxed']]);
    expect(await artifacts(pdf, 1)).toEqual([]);
    const [frame] = await artifacts(pdf, 2);
    expect(frame).toMatch(/\bre\b/); // a closed rectangle: the Section starts on page 2
  });

  it('throws a clear error when a single line is taller than the page content area', async () => {
    await expect(render(<P style={{ lineHeight: 300 }}>Huge</P>, SMALL)).rejects.toThrow(
      '<P> "Huge" has a 300 pt line that does not fit in the page content area (200 pt left below its border and padding).',
    );
  });
});

describe('PageBreak', () => {
  it('starts the following content at the top of a new page, dropping its top margin', async () => {
    const pdf = await render(
      <>
        <P>Before</P>
        <PageBreak />
        <P style={{ marginTop: 40 }}>After</P>
      </>,
    );
    const pages = await textRuns(pdf);
    expect(pages.map((p) => p.runs.map((r) => r.str))).toEqual([['Before'], ['After']]);
    expect(pages[1]!.runs[0]!.y).toBeCloseTo(pages[0]!.runs[0]!.y);
    expect(await structOutline(pdf)).toBe(['Document', '  P "Before"', '  P "After"'].join('\n'));
  });

  it('never adds a blank page: consecutive, leading and trailing breaks', async () => {
    const pdf = await render(
      <>
        <PageBreak />
        <P>One</P>
        <PageBreak />
        <PageBreak />
        <P>Two</P>
        <PageBreak />
      </>,
    );
    expect((await textRuns(pdf)).map((p) => p.runs.map((r) => r.str))).toEqual([['One'], ['Two']]);
  });

  it('breaks inside a Section without splitting its structure element', async () => {
    const pdf = await render(
      <Section>
        <P>First</P>
        <PageBreak />
        <P>Second</P>
      </Section>,
    );
    expect((await textRuns(pdf)).length).toBe(2);
    expect(await structOutline(pdf)).toBe(['Document', '  Sect', '    P "First"', '    P "Second"'].join('\n'));
  });

  it('rejects children', async () => {
    const Break = PageBreak as unknown as (props: { children: ReactNode }) => ReactNode;
    await expect(render(<Break>oops</Break>)).rejects.toThrow('<PageBreak> takes no children, found text "oops".');
  });

  it('is not allowed inside a paragraph', async () => {
    await expect(
      render(
        <P>
          text
          <PageBreak />
        </P>,
      ),
    ).rejects.toThrow('<P> may only contain text, <Span> and <Link>, found <PageBreak>.');
  });
});

describe('several Page templates', () => {
  it('renders them in order, each on a new page with its own geometry, under one Document', async () => {
    const pdf = await renderToBuffer(
      <Document title="Pages" lang="en-US">
        <Page size="Letter">
          <P>Body</P>
        </Page>
        <Page size={[841.89, 595.28]} margin={36}>
          <P>Appendix</P>
        </Page>
      </Document>,
    );
    const pages = await textRuns(pdf);
    expect(pages.map((p) => [p.width, p.height, p.runs.map((r) => r.str)])).toEqual([
      [612, 792, ['Body']],
      [841.89, 595.28, ['Appendix']],
    ]);
    expect(pages[1]!.runs[0]!.x).toBeCloseTo(36);
    expect(await structOutline(pdf)).toBe(['Document', '  P "Body"', '  P "Appendix"'].join('\n'));
  });
});

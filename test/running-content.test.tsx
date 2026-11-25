import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Artifact, Document, H1, H3, Link, P, Page, type PageProps, renderToBuffer, Span } from '../src/index.js';
import { pageContent, structOutline, textRuns } from './support/read-pdf.js';

const render = (children: ReactNode, page: Omit<PageProps, 'children'> = {}) =>
  renderToBuffer(
    <Document title="Running content" lang="en-US">
      <Page {...page}>{children}</Page>
    </Document>,
  );

/** A small page whose content area holds 10 lines of 20 pt: 300 × 300 with 50 pt margins. */
const SMALL: Omit<PageProps, 'children'> = { size: [300, 300], margin: 50 };
const lines = (n: number) =>
  Array.from({ length: n }, (_, i) => (
    <P key={i} style={{ lineHeight: 20, marginBottom: 0 }}>
      {`Line ${i + 1}`}
    </P>
  ));

const footer: PageProps['footer'] = ({ pageNumber, totalPages }) => (
  <P style={{ fontSize: 8 }}>{`Page ${pageNumber} of ${totalPages}`}</P>
);

/** Number of Pagination artifacts on one page. */
const paginationArtifacts = async (pdf: Uint8Array, page: number) =>
  [...(await pageContent(pdf, page)).matchAll(/\/Artifact <<\s*\/Type \/Pagination\s*>> BDC([\s\S]*?)EMC/g)].length;

describe('Page footer', () => {
  it('draws "Page X of Y" on every page with the final page count', async () => {
    const pages = await textRuns(await render(lines(25), { ...SMALL, footer }));
    expect(pages).toHaveLength(3);
    pages.forEach((page, i) => {
      expect(page.runs.map((r) => r.str)).toContain(`Page ${i + 1} of 3`);
    });
  });

  it('keeps the footer out of the structure tree', async () => {
    const pdf = await render(
      <>
        <H1>Title</H1>
        <P>Body</P>
      </>,
      { footer },
    );
    expect(await structOutline(pdf)).toBe(['Document', '  H1 "Title"', '  P "Body"'].join('\n'));
    expect(await paginationArtifacts(pdf, 1)).toBe(1);
  });
});

describe('Page header', () => {
  it('draws the header in the top margin, the footer in the bottom margin, body in between', async () => {
    const pdf = await render(lines(3), {
      ...SMALL,
      header: () => <P style={{ fontSize: 8 }}>Quarterly report</P>,
      footer,
    });
    const [page] = await textRuns(pdf);
    const run = (str: string) => page!.runs.find((r) => r.str === str)!;
    // PDF user space: y grows upwards. Top margin is y > 250, bottom margin y < 50.
    expect(run('Quarterly report').y).toBeGreaterThan(250);
    expect(run('Quarterly report').y).toBeLessThan(275);
    expect(run('Page 1 of 1').y).toBeGreaterThan(25);
    expect(run('Page 1 of 1').y).toBeLessThan(50);
    expect(run('Line 1').y).toBeLessThan(250);
    expect(await paginationArtifacts(pdf, 1)).toBe(2);
    expect(await structOutline(pdf)).toBe(['Document', '  P "Line 1"', '  P "Line 2"', '  P "Line 3"'].join('\n'));
  });

  it('accepts plain text and <Span> as content', async () => {
    const [page] = await textRuns(
      await render(<P>Body</P>, {
        header: ({ pageNumber }) => (
          <>
            Draft <Span style={{ fontWeight: 'bold' }}>{`#${pageNumber}`}</Span>
          </>
        ),
      }),
    );
    expect(page!.runs.map((r) => r.str).join('')).toContain('Draft #1');
  });

  it('numbers pages across every <Page> template of the document', async () => {
    const pdf = await renderToBuffer(
      <Document title="Two templates" lang="en-US">
        <Page {...SMALL} footer={footer}>
          {lines(15)}
        </Page>
        <Page size="A5" footer={({ pageNumber, totalPages }) => <P>{`Annex ${pageNumber}/${totalPages}`}</P>}>
          <P>Annex</P>
        </Page>
      </Document>,
    );
    const pages = await textRuns(pdf);
    expect(pages.map((p) => p.runs.map((r) => r.str).find((s) => /of|\//.test(s)))).toEqual([
      'Page 1 of 3',
      'Page 2 of 3',
      'Annex 3/3',
    ]);
  });

  it('draws nothing when the function returns null', async () => {
    const pdf = await render(<P>Body</P>, { header: () => null });
    expect(await paginationArtifacts(pdf, 1)).toBe(0);
  });
});

describe('running content errors', () => {
  it('throws when a header does not fit in half the top margin', async () => {
    await expect(render(<P>Body</P>, { ...SMALL, header: () => <P style={{ fontSize: 40 }}>Huge</P> })).rejects.toThrow(
      /<Page> header on page 1 is [\d.]+ pt tall but only 25 pt fit/,
    );
  });

  it('throws when a footer does not fit in half the bottom margin', async () => {
    await expect(render(<P>Body</P>, { ...SMALL, footer: () => <P style={{ fontSize: 40 }}>Huge</P> })).rejects.toThrow(
      /<Page> footer on page 1 is [\d.]+ pt tall but only 25 pt fit/,
    );
  });

  it('rejects a <Link>, which an artifact would hide from assistive technology', async () => {
    await expect(
      render(<P>Body</P>, { footer: () => <P><Link href="https://example.com">site</Link></P> }),
    ).rejects.toThrow(/<Page footer> cannot contain <Link>/);
  });

  it('rejects a header that is not a function', async () => {
    await expect(render(<P>Body</P>, { header: 'Title' as never })).rejects.toThrow(
      /<Page> `header` must be a function of \{ pageNumber, totalPages \}/,
    );
  });
});

/** Text drawn inside artifacts of one `/Type` on one page. */
const artifactBodies = async (pdf: Uint8Array, page: number, type: string) =>
  [...(await pageContent(pdf, page)).matchAll(new RegExp(`/Artifact <<\\s*/Type /${type}\\s*>> BDC([\\s\\S]*?)EMC`, 'g'))].map(
    (m) => m[1]!,
  );

describe('<Artifact>', () => {
  it('flows decorative blocks with the content but keeps them out of the structure tree', async () => {
    const pdf = await render(
      <>
        <P>Before</P>
        <Artifact>
          <P style={{ borderWidth: 1, padding: 4 }}>* * *</P>
        </Artifact>
        <P>After</P>
      </>,
    );
    expect(await structOutline(pdf)).toBe(['Document', '  P "Before"', '  P "After"'].join('\n'));
    const [layout] = await artifactBodies(pdf, 1, 'Layout');
    expect(layout).toMatch(/ re\n/); // its border
    expect(layout).toMatch(/TJ|Tj/); // and its text, in the same artifact
    const [page] = await textRuns(pdf);
    const y = (str: string) => page!.runs.find((r) => r.str === str)!.y;
    expect(y('Before')).toBeGreaterThan(y('* * *'));
    expect(y('* * *')).toBeGreaterThan(y('After'));
  });

  it('takes a type: Pagination for page furniture placed in the flow', async () => {
    const pdf = await render(
      <Artifact type="Pagination">
        <P>Confidential</P>
      </Artifact>,
    );
    expect(await paginationArtifacts(pdf, 1)).toBe(1);
  });

  it('does not check headings inside it, which are not tagged', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await render(
        <>
          <H1>Title</H1>
          <Artifact>
            <H3>Decorative</H3>
          </Artifact>
        </>,
      );
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('rejects a <Link> and an unknown type', async () => {
    await expect(
      render(
        <Artifact>
          <P>
            <Link href="https://example.com">site</Link>
          </P>
        </Artifact>,
      ),
    ).rejects.toThrow(/<Artifact> cannot contain <Link>/);
    await expect(render(<Artifact type={'Header' as never}><P>x</P></Artifact>)).rejects.toThrow(
      /<Artifact> `type` must be 'Layout', 'Page' or 'Pagination'; got "Header"/,
    );
  });
});

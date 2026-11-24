import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Document, P, Page, renderToBuffer, renderToFile } from '../src/index.js';
import helloWorld from './fixtures/hello-world.js';
import longParagraph, { LONG_TEXT } from './fixtures/long-paragraph.js';
import { pdfFacts, structOutline, textRuns } from './support/read-pdf.js';

const STANDARD_14 = /^(Courier|Helvetica|Times|Symbol|ZapfDingbats)/;

describe('renderToBuffer', () => {
  it('produces a Document > P structure tree for the hello-world fixture', async () => {
    const pdf = await renderToBuffer(helloWorld);
    expect(await structOutline(pdf)).toMatchInlineSnapshot(`
      "Document
        P "Hello, tagged PDF world!""
    `);
  });

  it('writes the document-level metadata PDF/UA-1 requires', async () => {
    const facts = await pdfFacts(await renderToBuffer(helloWorld));
    expect(facts.version).toBe('1.7');
    expect(facts.catalogLang).toBe('en-US');
    expect(facts.markInfoMarked).toBe(true);
    expect(facts.displayDocTitle).toBe(true);
    expect(facts.infoTitle).toBe('Hello world');
    expect(facts.xmp).toMatch(/<dc:title>[\s\S]*Hello world[\s\S]*<\/dc:title>/);
    expect(facts.xmp).toMatch(/<pdfuaid:part>1<\/pdfuaid:part>/);
  });

  it('embeds the bundled Noto Sans font and never emits a standard-14 font', async () => {
    const { fonts } = await pdfFacts(await renderToBuffer(helloWorld));
    expect(fonts.length).toBeGreaterThan(0);
    for (const font of fonts) {
      expect(font.embedded).toBe(true);
      expect(font.baseFont).not.toMatch(STANDARD_14);
      // Subset fonts are named "ABCDEF+NotoSans-Regular".
      expect(font.baseFont).toMatch(/^[A-Z]{6}\+NotoSans-Regular$/);
    }
  });

  it.each([
    ['title', <Document lang="en-US" {...({} as { title: string })}><Page><P>x</P></Page></Document>],
    ['lang', <Document title="T" {...({} as { lang: string })}><Page><P>x</P></Page></Document>],
    ['title', <Document title="  " lang="en-US"><Page><P>x</P></Page></Document>],
    ['lang', <Document title="T" lang=""><Page><P>x</P></Page></Document>],
  ])('throws a clear error when <Document> is missing %s', async (prop, element) => {
    await expect(renderToBuffer(element)).rejects.toThrow(`<Document> requires a non-empty \`${prop}\` prop`);
  });

  it('wraps a long paragraph onto several lines inside the page margins', async () => {
    const [page] = await textRuns(await renderToBuffer(longParagraph));
    const margin = 72;
    const lines = new Set(page!.runs.map((r) => Math.round(r.y)));
    expect(lines.size).toBeGreaterThan(3);
    for (const run of page!.runs) {
      expect(run.x).toBeGreaterThanOrEqual(margin - 0.01);
      expect(run.x + run.width).toBeLessThanOrEqual(page!.width - margin + 0.01);
    }
    // Every word survives wrapping, in order.
    const words = (s: string) => s.split(/\s+/).filter(Boolean);
    expect(words(page!.runs.map((r) => r.str).join(' '))).toEqual(words(`${LONG_TEXT} A second, short paragraph.`));
  });

  it('flows content that overflows one page onto further pages', async () => {
    const paragraphs = Array.from({ length: 80 }, (_, i) => <P key={i}>Paragraph {i + 1}</P>);
    const element = (
      <Document title="T" lang="en-US">
        <Page>{paragraphs}</Page>
      </Document>
    );
    const pages = await textRuns(await renderToBuffer(element));
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flatMap((p) => p.runs.map((r) => r.str))).toEqual(paragraphs.map((_, i) => `Paragraph ${i + 1}`));
  });

  it('surfaces errors thrown by components while rendering', async () => {
    function Broken(): never {
      throw new Error('boom from a component');
    }
    const element = (
      <Document title="T" lang="en-US">
        <Page>
          <Broken />
        </Page>
      </Document>
    );
    await expect(renderToBuffer(element)).rejects.toThrow('boom from a component');
  });

  it('accepts the strict option', async () => {
    const pdf = await renderToBuffer(helloWorld, { strict: true });
    expect(await structOutline(pdf)).toContain('P "Hello, tagged PDF world!"');
  });
});

describe('renderToFile', () => {
  it('writes the same PDF structure to disk', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'rtp-'));
    const path = join(dir, 'hello.pdf');
    await renderToFile(helloWorld, path);
    const bytes = await readFile(path);
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(await structOutline(bytes)).toContain('P "Hello, tagged PDF world!"');
  });
});

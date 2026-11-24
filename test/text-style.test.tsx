import { describe, expect, it } from 'vitest';
import { Document, H1, H2, P, Page, Section, renderToBuffer } from '../src/index.js';
import { pageContent, textRuns } from './support/read-pdf.js';

const runsOf = async (pdf: Uint8Array) => (await textRuns(pdf))[0]!.runs;
const runWith = async (pdf: Uint8Array, str: string) => {
  const run = (await runsOf(pdf)).find((r) => r.str === str);
  if (!run) throw new Error(`no run ${JSON.stringify(str)}`);
  return run;
};

describe('text style', () => {
  it('draws text at the default 12 pt and headings at their default sizes', async () => {
    const pdf = await renderToBuffer(
      <Document title="Sizes" lang="en-US">
        <Page>
          <H1>Big</H1>
          <H2>Smaller</H2>
          <P>Body</P>
        </Page>
      </Document>,
    );
    expect((await runWith(pdf, 'Big')).size).toBeCloseTo(24);
    expect((await runWith(pdf, 'Smaller')).size).toBeCloseTo(20);
    expect((await runWith(pdf, 'Body')).size).toBeCloseTo(12);
  });

  it('inherits fontSize from an ancestor; a heading keeps its own default size', async () => {
    const pdf = await renderToBuffer(
      <Document title="Sizes" lang="en-US">
        <Page>
          <Section style={{ fontSize: 9 }}>
            <H1>Heading</H1>
            <Section>
              <P>Small print</P>
            </Section>
          </Section>
          <P style={{ fontSize: 15 }}>Own size</P>
        </Page>
      </Document>,
    );
    expect((await runWith(pdf, 'Small print')).size).toBeCloseTo(9);
    expect((await runWith(pdf, 'Heading')).size).toBeCloseTo(24);
    expect((await runWith(pdf, 'Own size')).size).toBeCloseTo(15);
  });

  it('fills text with the inherited color', async () => {
    const pdf = await renderToBuffer(
      <Document title="Color" lang="en-US">
        <Page>
          <Section style={{ color: '#ff0000' }}>
            <P>Red</P>
          </Section>
          <P style={{ color: 'blue' }}>Blue</P>
        </Page>
      </Document>,
    );
    const content = await pageContent(pdf);
    // Each paragraph's marked content sets its fill color before drawing.
    const [, red, blue] = content.split(/\/P <<\s*\/MCID \d+\s*>> BDC/);
    expect(red).toMatch(/\b1 0 0 (rg|scn)\b/);
    expect(blue).toMatch(/\b0 0 1 (rg|scn)\b/);
  });

  it('spaces lines by lineHeight in points, and lineHeight inherits', async () => {
    const words = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    const pdf = await renderToBuffer(
      <Document title="Line height" lang="en-US">
        <Page>
          <Section style={{ lineHeight: 30 }}>
            <P>{words}</P>
          </Section>
        </Page>
      </Document>,
    );
    const ys = [...new Set((await runsOf(pdf)).map((r) => Math.round(r.y * 100) / 100))];
    expect(ys.length).toBeGreaterThan(2);
    for (let i = 1; i < ys.length; i++) expect(ys[i - 1]! - ys[i]!).toBeCloseTo(30);
  });
});

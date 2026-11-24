import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { Document, P, Page, Section, renderToBuffer } from '../src/index.js';
import { pageContent, structOutline, textRuns } from './support/read-pdf.js';

const PAGE_MARGIN = 72;
const render = (children: ReactNode) =>
  renderToBuffer(
    <Document title="Box" lang="en-US">
      <Page>{children}</Page>
    </Document>,
  );
const runWith = async (pdf: Uint8Array, str: string) => {
  const [page] = await textRuns(pdf);
  const run = page!.runs.find((r) => r.str === str);
  if (!run) throw new Error(`no run ${JSON.stringify(str)}`);
  return { ...run, pageWidth: page!.width };
};

describe('box style', () => {
  it('offsets content by margin + border + padding, and box props are not inherited', async () => {
    const pdf = await render(
      <Section style={{ margin: 10, borderWidth: 1, padding: 5 }}>
        <Section>
          <P>Inside</P>
        </Section>
      </Section>,
    );
    // 72 page margin + 10 margin + 1 border + 5 padding; the inner Section and P add nothing.
    expect((await runWith(pdf, 'Inside')).x).toBeCloseTo(88);
  });

  it('supports per-side margin and padding that override the shorthand', async () => {
    const pdf = await render(<P style={{ padding: 4, paddingLeft: 20, marginLeft: 6 }}>Sides</P>);
    expect((await runWith(pdf, 'Sides')).x).toBeCloseTo(PAGE_MARGIN + 6 + 20);
  });

  it('moves following content down by top margin, border and padding', async () => {
    const plain = await runWith(await render(<P>Text</P>), 'Text');
    const boxed = await runWith(
      await render(<P style={{ marginTop: 30, borderWidth: 2, paddingTop: 8 }}>Text</P>),
      'Text',
    );
    // PDF y grows upwards, so content 40 pt lower has a 40 pt smaller baseline.
    expect(plain.y - boxed.y).toBeCloseTo(40);
  });

  it('separates blocks by the bottom margin of the first plus box of the second', async () => {
    const pdf = await render(
      <>
        <P style={{ marginBottom: 0 }}>First</P>
        <P>Second</P>
      </>,
    );
    const spaced = await render(
      <>
        <P style={{ marginBottom: 50 }}>First</P>
        <P>Second</P>
      </>,
    );
    const gap = async (bytes: Uint8Array) => (await runWith(bytes, 'First')).y - (await runWith(bytes, 'Second')).y;
    expect((await gap(spaced)) - (await gap(pdf))).toBeCloseTo(50);
  });

  it('wraps text inside the padded content box', async () => {
    const words = Array.from({ length: 80 }, (_, i) => `w${i}`).join(' ');
    const [page] = await textRuns(await render(<P style={{ padding: 40 }}>{words}</P>));
    for (const run of page!.runs) {
      expect(run.x).toBeGreaterThanOrEqual(PAGE_MARGIN + 40 - 0.01);
      expect(run.x + run.width).toBeLessThanOrEqual(page!.width - PAGE_MARGIN - 40 + 0.01);
    }
  });

  it('paints background and border as Layout artifacts outside the structure tree', async () => {
    const pdf = await render(
      <Section style={{ backgroundColor: '#0000ff', borderWidth: 2, borderColor: '#00ff00' }}>
        <P>Boxed</P>
      </Section>,
    );
    const content = await pageContent(pdf);
    const artifacts = [...content.matchAll(/\/Artifact <<\s*\/Type \/Layout\s*>> BDC([\s\S]*?)EMC/g)].map((m) => m[1]!);
    expect(artifacts.length).toBeGreaterThan(0);
    const painted = artifacts.join('\n');
    expect(painted).toMatch(/\bre\b/);
    expect(painted).toMatch(/\b0 0 1 (rg|scn)\b/); // blue fill color...
    expect(painted).toMatch(/\bf\b/); // ...filled
    expect(painted).toMatch(/\b0 1 0 (RG|SCN)\b/); // green stroke color...
    expect(painted).toMatch(/\bS\b/); // ...stroked
    expect(await structOutline(pdf)).toBe(['Document', '  Sect', '    P "Boxed"'].join('\n'));
  });
});

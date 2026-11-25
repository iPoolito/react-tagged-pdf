import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { Document, H1, Link, List, ListItem, P, Page, PageBreak, type PageProps, Section, Span, renderToBuffer } from '../src/index.js';
import { paintedRects, structOutline, textRuns } from './support/read-pdf.js';

const render = (children: ReactNode, page: Omit<PageProps, 'children'> = {}) =>
  renderToBuffer(
    <Document title="Lists" lang="en-US">
      <Page {...page}>{children}</Page>
    </Document>,
  );

describe('List', () => {
  it('an unordered list is L, each item LI with a bullet Lbl and an LBody holding its text', async () => {
    const pdf = await render(
      <List>
        <ListItem>Apples</ListItem>
        <ListItem>Pears</ListItem>
      </List>,
    );
    expect(await structOutline(pdf)).toBe(
      [
        'Document',
        '  L',
        '    LI',
        '      Lbl "•"',
        '      LBody "Apples"',
        '    LI',
        '      Lbl "•"',
        '      LBody "Pears"',
      ].join('\n'),
    );
  });

  it('an ordered list numbers its items 1., 2., 3.', async () => {
    const pdf = await render(
      <List ordered>
        <ListItem>One</ListItem>
        <ListItem>Two</ListItem>
        <ListItem>Three</ListItem>
      </List>,
    );
    const outline = await structOutline(pdf);
    expect(outline.split('\n').filter((l) => l.includes('Lbl'))).toEqual([
      '      Lbl "1."',
      '      Lbl "2."',
      '      Lbl "3."',
    ]);
  });

  it('a nested list is an L inside the LBody, after the item text, bullets alternating • and – by depth', async () => {
    const pdf = await render(
      <List>
        <ListItem>
          Fruit
          <List ordered>
            <ListItem>Apples</ListItem>
            <ListItem>
              Pears
              <List>
                <ListItem>Conference</ListItem>
              </List>
            </ListItem>
          </List>
        </ListItem>
        <ListItem>Bread</ListItem>
      </List>,
    );
    expect(await structOutline(pdf)).toBe(
      [
        'Document',
        '  L',
        '    LI',
        '      Lbl "•"',
        '      LBody "Fruit [L]"',
        '        L',
        '          LI',
        '            Lbl "1."',
        '            LBody "Apples"',
        '          LI',
        '            Lbl "2."',
        '            LBody "Pears [L]"',
        '              L',
        '                LI',
        '                  Lbl "•"',
        '                  LBody "Conference"',
        '    LI',
        '      Lbl "•"',
        '      LBody "Bread"',
      ].join('\n'),
    );
  });

  it('item text keeps its Span lang and Link elements; paragraphs inside an item are P elements', async () => {
    const pdf = await render(
      <List>
        <ListItem>
          See <Link href="https://example.com">the guide</Link> or say <Span lang="fr-FR">bonjour</Span>.
          <P>A second paragraph.</P>
        </ListItem>
      </List>,
    );
    expect(await structOutline(pdf)).toBe(
      [
        'Document',
        '  L',
        '    LI',
        '      Lbl "•"',
        '      LBody "See [Link] or say [Span] . [P]"',
        '        Link "the guide" (1 OBJR)',
        '        Span [Lang="fr-FR"] "bonjour"',
        '        P "A second paragraph."',
      ].join('\n'),
    );
  });

  it('puts each label in the indent, on its item\'s first baseline; nested items are indented further', async () => {
    const pdf = await render(
      <List>
        <ListItem>
          Fruit
          <List>
            <ListItem>Apples</ListItem>
          </List>
        </ListItem>
      </List>,
      { margin: 72 },
    );
    const [page] = await textRuns(pdf);
    const at = (str: string) => page!.runs.find((r) => r.str === str)!;
    const [bullet, fruit, dash, apples] = [at('•'), at('Fruit'), at('–'), at('Apples')];
    // The default indent is 24 pt per list level, with a 6 pt gap before the content.
    expect(fruit.x).toBeCloseTo(72 + 24, 1);
    expect(apples.x).toBeCloseTo(72 + 48, 1);
    expect(bullet.x + bullet.width).toBeCloseTo(fruit.x - 6, 1);
    expect(dash.x + dash.width).toBeCloseTo(apples.x - 6, 1);
    expect(bullet.y).toBeCloseTo(fruit.y, 3);
    expect(dash.y).toBeCloseTo(apples.y, 3);
    expect(apples.y).toBeLessThan(fruit.y);
  });

  it('style and lang inherit to items; the label shares the text style but is never underlined', async () => {
    const pdf = await render(
      <List lang="de-DE" style={{ fontSize: 14 }}>
        <ListItem style={{ fontWeight: 'bold', textDecoration: 'underline' }} lang="en-GB">
          Colour
        </ListItem>
      </List>,
    );
    expect(await structOutline(pdf)).toBe(
      ['Document', '  L [Lang="de-DE"]', '    LI [Lang="en-GB"]', '      Lbl "•"', '      LBody "Colour"'].join('\n'),
    );
    const [page] = await textRuns(pdf);
    expect(page!.runs.filter((r) => r.str.trim()).map((r) => [r.str, r.size, r.font])).toEqual([
      ['•', 14, 'NotoSans-Bold'],
      ['Colour', 14, 'NotoSans-Bold'],
    ]);
    expect((await paintedRects(pdf)).map((r) => r.tag)).toEqual(['LBody']);
  });

  it('flows across pages: one L, each label on the same page and baseline as its item\'s first line', async () => {
    const items = Array.from({ length: 12 }, (_, i) => `Item ${i + 1}`);
    const pdf = await render(
      <List ordered>
        {items.map((item) => (
          <ListItem key={item}>{item}</ListItem>
        ))}
      </List>,
      { size: [200, 150], margin: 20 },
    );
    const outline = (await structOutline(pdf)).split('\n');
    expect(outline.filter((l) => l.trim() === 'L')).toHaveLength(1);
    expect(outline.filter((l) => l.trim() === 'LI')).toHaveLength(12);
    const pages = await textRuns(pdf);
    expect(pages.length).toBeGreaterThan(1);
    for (const { runs } of pages) {
      const visible = runs.filter((r) => r.str.trim());
      expect(visible.length % 2).toBe(0);
      for (let i = 0; i < visible.length; i += 2) {
        const [label, text] = [visible[i]!, visible[i + 1]!];
        expect(text.str).toBe(`Item ${label.str.replace('.', '')}`);
        expect(label.y).toBeCloseTo(text.y, 3);
      }
    }
  });

  it('an item that splits across pages is one LI; its label stays with its first line', async () => {
    const long = 'This item is long enough to wrap over several lines and continue on the next page';
    const pdf = await render(
      <List>
        <ListItem>{long}</ListItem>
        <ListItem>Short</ListItem>
      </List>,
      { size: [200, 100], margin: 20 },
    );
    expect(await structOutline(pdf)).toBe(
      [
        'Document',
        '  L',
        '    LI',
        '      Lbl "•"',
        `      LBody ${JSON.stringify(long)}`,
        '    LI',
        '      Lbl "•"',
        '      LBody "Short"',
      ].join('\n'),
    );
    const pages = await textRuns(pdf);
    expect(pages.length).toBeGreaterThan(1);
    const labels = pages.map((p) => p.runs.filter((r) => r.str === '•').length);
    expect(labels[0]).toBe(1);
    expect(labels.reduce((a, b) => a + b)).toBe(2);
    expect(pages.at(-1)!.runs.at(-1)!.str).toBe('Short');
  });

  it('an item whose first line does not fit moves to the next page with its label', async () => {
    const pdf = await render(
      <>
        <P style={{ marginBottom: 0 }}>Filler line one. Filler line two that wraps further.</P>
        <List>
          <ListItem>Moved</ListItem>
        </List>
      </>,
      { size: [200, 80], margin: 20 },
    );
    const pages = await textRuns(pdf);
    expect(pages).toHaveLength(2);
    expect(pages[0]!.runs.some((r) => r.str === '•')).toBe(false);
    expect(pages[1]!.runs.filter((r) => r.str.trim()).map((r) => r.str)).toEqual(['•', 'Moved']);
  });
});

describe('List errors', () => {
  it('a List may only contain ListItems', async () => {
    await expect(
      render(
        <List>
          <P>Not an item</P>
        </List>,
      ),
    ).rejects.toThrow('<List> may only contain <ListItem> children, found <P>.');
  });

  it('a ListItem must be inside a List', async () => {
    await expect(render(<ListItem>Loose</ListItem>)).rejects.toThrow('<ListItem> must be a child of <List>.');
  });

  it('ordered must be a boolean', async () => {
    await expect(
      render(
        // @ts-expect-error: testing a runtime type error
        <List ordered="yes">
          <ListItem>One</ListItem>
        </List>,
      ),
    ).rejects.toThrow('<List> `ordered` must be true or false; got "yes".');
  });

  it('a ListItem needs content', async () => {
    await expect(
      render(
        <List>
          <ListItem> </ListItem>
        </List>,
      ),
    ).rejects.toThrow('<ListItem> has no content');
  });

  it('a ListItem needs text somewhere, for its label to sit on', async () => {
    await expect(
      render(
        <List>
          <ListItem>
            <Section />
            <PageBreak />
          </ListItem>
        </List>,
      ),
    ).rejects.toThrow('<ListItem> has no content');
  });

  it('names text, Span and Link among what a ListItem may contain', async () => {
    await expect(
      render(
        <List>
          <ListItem>
            <Page />
          </ListItem>
        </List>,
      ),
    ).rejects.toThrow(
      '<ListItem> may only contain text, <Span>, <Link>, <P>, <H1>–<H6>, <Section>, <List>, <Image> and <PageBreak> children, found <Page>.',
    );
  });

  it('an empty List adds nothing to the document', async () => {
    const pdf = await render(
      <>
        <H1>Title</H1>
        <List>{[]}</List>
      </>,
    );
    expect(await structOutline(pdf)).toBe(['Document', '  H1 "Title"'].join('\n'));
  });
});

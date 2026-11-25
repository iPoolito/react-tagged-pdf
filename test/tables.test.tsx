import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { Artifact, Document, H1, P, Page, type PageProps, Table, TD, TH, TR, renderToBuffer } from '../src/index.js';
import { paintedRects, structOutline, textRuns } from './support/read-pdf.js';

const render = (children: ReactNode, page: Omit<PageProps, 'children'> = {}) =>
  renderToBuffer(
    <Document title="Tables" lang="en-US">
      <Page {...page}>{children}</Page>
    </Document>,
  );

describe('Table', () => {
  it('a table with a header row is Table > TR > TH/TD, header cells scoped to their column', async () => {
    const pdf = await render(
      <Table>
        <TR>
          <TH>Fruit</TH>
          <TH>Price</TH>
        </TR>
        <TR>
          <TD>Apples</TD>
          <TD>1.20</TD>
        </TR>
      </Table>,
    );
    expect(await structOutline(pdf)).toBe(
      [
        'Document',
        '  Table',
        '    TR',
        '      TH [Scope=Column] "Fruit"',
        '      TH [Scope=Column] "Price"',
        '    TR',
        '      TD "Apples"',
        '      TD "1.20"',
      ].join('\n'),
    );
  });

  it('a header column: the first cell of each row is a TH scoped to its row', async () => {
    const pdf = await render(
      <Table>
        <TR>
          <TH>Apples</TH>
          <TD>1.20</TD>
        </TR>
        <TR>
          <TH>Pears</TH>
          <TD>0.90</TD>
        </TR>
      </Table>,
    );
    expect(await structOutline(pdf)).toBe(
      [
        'Document',
        '  Table',
        '    TR',
        '      TH [Scope=Row] "Apples"',
        '      TD "1.20"',
        '    TR',
        '      TH [Scope=Row] "Pears"',
        '      TD "0.90"',
      ].join('\n'),
    );
  });

  it('header row and header column: the corner and top row are Column, the first cells below are Row', async () => {
    const pdf = await render(
      <Table>
        <TR>
          <TH>Fruit</TH>
          <TH>Price</TH>
        </TR>
        <TR>
          <TH>Apples</TH>
          <TD>1.20</TD>
        </TR>
      </Table>,
    );
    const ths = (await structOutline(pdf)).split('\n').filter((l) => l.includes('TH'));
    expect(ths).toEqual([
      '      TH [Scope=Column] "Fruit"',
      '      TH [Scope=Column] "Price"',
      '      TH [Scope=Row] "Apples"',
    ]);
  });

  it('an explicit scope overrides the default', async () => {
    const pdf = await render(
      <Table>
        <TR>
          <TH scope="Row">Total</TH>
          <TH>3.10</TH>
        </TR>
      </Table>,
    );
    expect(await structOutline(pdf)).toContain('TH [Scope=Row] "Total"');
  });

  it('cells hold styled text and links, and an empty cell is an empty TD', async () => {
    const pdf = await render(
      <Table>
        <TR>
          <TH>Name</TH>
          <TH>Note</TH>
        </TR>
        <TR>
          <TD lang="fr-FR">Poire</TD>
          <TD />
        </TR>
      </Table>,
    );
    expect(await structOutline(pdf)).toContain(['      TD [Lang="fr-FR"] "Poire"', '      TD'].join('\n'));
  });

  it('header cells are bold by default', async () => {
    const [page] = await textRuns(
      await render(
        <Table>
          <TR>
            <TH>Head</TH>
          </TR>
          <TR>
            <TD>Data</TD>
          </TR>
        </Table>,
      ),
    );
    expect(page!.runs.map((r) => [r.str, r.font])).toEqual([
      ['Head', 'NotoSans-Bold'],
      ['Data', 'NotoSans-Regular'],
    ]);
  });
});

describe('Table columns', () => {
  const twoRows = (first?: number) => (
    <Table>
      <TR>
        <TD style={first ? { width: first } : undefined}>A</TD>
        <TD>B</TD>
        <TD>C</TD>
      </TR>
      <TR>
        <TD>D</TD>
        <TD>E</TD>
        <TD>F</TD>
      </TR>
    </Table>
  );
  // A4 with 72 pt margins: 451.28 pt of content width; cells have 4 pt of padding.
  const xs = async (pdf: Buffer) => (await textRuns(pdf))[0]!.runs
      .filter((r) => r.str.trim())
      .slice(0, 3)
      .map((r) => Number(r.x.toFixed(2)));

  it('share the table width equally by default', async () => {
    const width = 451.28 / 3;
    expect(await xs(await render(twoRows()))).toEqual([76, 76 + width, 76 + 2 * width].map((n) => Number(n.toFixed(2))));
  });

  it('a cell style.width fixes its column; the other columns share what is left', async () => {
    const rest = (451.28 - 100) / 2;
    expect(await xs(await render(twoRows(100)))).toEqual([76, 176, 176 + rest].map((n) => Number(n.toFixed(2))));
  });

  it('each row is as tall as its tallest cell, and cell borders span the full row height', async () => {
    const pdf = await render(
      <Table>
        <TR>
          <TD style={{ borderWidth: 1 }}>Short</TD>
          <TD style={{ borderWidth: 1 }}>A cell long enough to wrap onto a second line in its narrow column</TD>
        </TR>
      </Table>,
      { size: [300, 300], margin: 20 },
    );
    const borders = (await paintedRects(pdf)).filter((r) => r.tag === 'Artifact');
    expect(borders).toHaveLength(2);
    expect(borders[0]!.height).toBeCloseTo(borders[1]!.height, 5);
    const runs = (await textRuns(pdf))[0]!.runs;
    expect(runs.length).toBeGreaterThan(2);
  });

  it('throws when cells of one column set different widths', async () => {
    await expect(
      render(
        <Table>
          <TR>
            <TD style={{ width: 100 }}>A</TD>
          </TR>
          <TR>
            <TD style={{ width: 120 }}>B</TD>
          </TR>
        </Table>,
      ),
    ).rejects.toThrow('<Table> column 1 has cells with different `style.width` values (100, 120 pt)');
  });

  it('throws when fixed widths leave no room for the other columns', async () => {
    await expect(
      render(
        <Table>
          <TR>
            <TD style={{ width: 500 }}>A</TD>
            <TD>B</TD>
          </TR>
        </Table>,
      ),
    ).rejects.toThrow('<Table> column widths add up to 500 pt');
  });
});

describe('Table pages', () => {
  const rows = (n: number) => (
    <Table>
      <TR>
        <TH>Item</TH>
      </TR>
      {Array.from({ length: n }, (_, i) => (
        <TR key={i}>
          <TD>Row {i + 1}</TD>
        </TR>
      ))}
    </Table>
  );

  it('a table that does not fit below the content on a page moves to the next page whole', async () => {
    const pdf = await render(
      <>
        <H1>Report</H1>
        <P>{'Filler text. '.repeat(40)}</P>
        {rows(6)}
      </>,
      { size: [300, 300], margin: 20 },
    );
    const pages = await textRuns(pdf);
    expect(pages).toHaveLength(2);
    expect(pages[1]!.runs.map((r) => r.str)).toEqual(['Item', ...Array.from({ length: 6 }, (_, i) => `Row ${i + 1}`)]);
  });

  it('throws when a table is taller than a page (page breaking inside tables is not supported yet)', async () => {
    await expect(render(rows(40), { size: [300, 300], margin: 20 })).rejects.toThrow(
      /<Table> starting "Item" is [\d.]+ pt tall and does not fit on one page .*not supported yet/,
    );
  });
});

describe('Table warnings', () => {
  let warn: MockInstance<typeof console.warn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it('warns when a table has no TH', async () => {
    await render(
      <Table>
        <TR>
          <TD>Apples</TD>
          <TD>1.20</TD>
        </TR>
      </Table>,
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('<Table> starting "Apples" has no <TH> header cells');
  });

  it('does not warn for a decorative table inside an Artifact, which is not in the structure tree', async () => {
    await render(
      <Artifact>
        <Table>
          <TR>
            <TD>Ornament</TD>
          </TR>
        </Table>
      </Artifact>,
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not warn when a table has a TH', async () => {
    await render(
      <Table>
        <TR>
          <TH>Fruit</TH>
        </TR>
        <TR>
          <TD>Apples</TD>
        </TR>
      </Table>,
    );
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('Table errors', () => {
  const cell = (props: Record<string, unknown>) => (
    <Table>
      <TR>
        <TH>A</TH>
        <TD {...props}>B</TD>
      </TR>
    </Table>
  );

  it.each(['rowSpan', 'colSpan'])('%s throws "not supported yet"', async (prop) => {
    await expect(render(cell({ [prop]: 2 }))).rejects.toThrow(`<TD> \`${prop}\` is not supported yet`);
  });

  it('rows must have the same number of cells', async () => {
    await expect(
      render(
        <Table>
          <TR>
            <TH>A</TH>
            <TH>B</TH>
          </TR>
          <TR>
            <TD>C</TD>
          </TR>
        </Table>,
      ),
    ).rejects.toThrow('<Table> rows must all have the same number of cells: row 1 has 2, row 2 has 1.');
  });

  it('Table may only contain TR, and TR only TH and TD', async () => {
    await expect(render(<Table>loose</Table>)).rejects.toThrow('<Table> may only contain <TR> children, found text "loose".');
    await expect(
      render(
        <Table>
          <TR>
            <P>x</P>
          </TR>
        </Table>,
      ),
    ).rejects.toThrow('<TR> may only contain <TH> and <TD> children, found <P>.');
  });

  it('TR, TH and TD outside their parents throw', async () => {
    await expect(render(<TR />)).rejects.toThrow('<TR> must be a child of <Table>.');
    await expect(render(<TD>x</TD>)).rejects.toThrow('<TD> must be a child of <TR>.');
  });

  it('rejects an unknown scope and cell margins', async () => {
    await expect(
      render(
        <Table>
          <TR>
            <TH scope={'Both' as never}>A</TH>
          </TR>
        </Table>,
      ),
    ).rejects.toThrow("<TH> `scope` must be 'Column' or 'Row'; got \"Both\".");
    await expect(render(cell({ style: { marginTop: 4 } }))).rejects.toThrow(
      '<TD> `style.marginTop` is not supported on table cells',
    );
  });
});

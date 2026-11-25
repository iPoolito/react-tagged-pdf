// Run with `npm run example:tables`, then open test-output/tables.pdf.
// Shows simple data tables:
// - in Acrobat's Tags panel each <Table> is a <Table> of <TR> rows of <TH>/<TD> cells;
// - header cells carry a Scope attribute: Column for a header row, Row for a header column, so a
//   screen reader announces "Price, 1.20" when moving through the cells;
// - columns share the width equally unless a cell's style.width fixes one;
// - a table without any <TH> renders but logs a warning.
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, H1, H2, P, Page, renderToFile, Table, TD, TH, TR } from '../src/index.js';

const out = fileURLToPath(new URL('../test-output/tables.pdf', import.meta.url));
await mkdir(dirname(out), { recursive: true });

const cell = { borderWidth: 0.5, borderColor: '#999999' };
const head = { ...cell, backgroundColor: '#eeeeee' };

await renderToFile(
  <Document title="Tables" lang="en-US">
    <Page size="A5" margin={48}>
      <H1>Tables</H1>
      <H2>Train times</H2>
      <Table>
        <TR>
          <TH style={head}>Train</TH>
          <TH style={head}>Departs</TH>
          <TH style={head}>Arrives</TH>
        </TR>
        {[
          ['IC 101', '08:15', '10:40'],
          ['RE 7', '09:02', '12:30'],
          ['IC 105', '12:15', '14:40'],
        ].map(([train, departs, arrives]) => (
          <TR key={train}>
            <TD style={cell}>{train}</TD>
            <TD style={cell}>{departs}</TD>
            <TD style={cell}>{arrives}</TD>
          </TR>
        ))}
      </Table>
      <H2>Fares</H2>
      <Table>
        <TR>
          <TH style={{ ...head, width: 90 }}>Fare</TH>
          <TH style={head}>Single</TH>
          <TH style={head}>Return</TH>
        </TR>
        <TR>
          <TH style={head}>Adult</TH>
          <TD style={cell}>24.00</TD>
          <TD style={cell}>40.00</TD>
        </TR>
        <TR>
          <TH style={head}>Child</TH>
          <TD style={cell}>12.00</TD>
          <TD style={cell}>20.00</TD>
        </TR>
      </Table>
      <P>Fares in euros.</P>
    </Page>
  </Document>,
  out,
);
console.log(`Wrote ${out}`);

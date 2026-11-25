// Run with `npm run example:long-table`, then open test-output/long-table.pdf.
// Shows a table that continues over several pages:
// - it breaks only between rows; a row is never split (a row taller than a page throws);
// - the header row is kept with the first data row, never left alone at the bottom of a page;
// - in Acrobat's Tags panel it is still one <Table> holding every <TR>, whichever page it is on;
// - the table's border is open where it continues on the next page.
// Header rows are not repeated on continuation pages yet.
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, H1, P, Page, renderToFile, Table, TD, TH, TR } from '../src/index.js';

const out = fileURLToPath(new URL('../test-output/long-table.pdf', import.meta.url));
await mkdir(dirname(out), { recursive: true });

const cell = { borderWidth: 0.5, borderColor: '#999999' };
const head = { ...cell, backgroundColor: '#eeeeee' };
const stations = ['Lisboa', 'Porto', 'Coimbra', 'Aveiro', 'Braga', 'Faro', 'Évora', 'Leiria'];

await renderToFile(
  <Document title="Timetable" lang="en-US">
    <Page size="A5" margin={48}>
      <H1>Timetable</H1>
      <P>Every departure of the day. The table continues on the following pages.</P>
      <Table style={{ borderWidth: 1, borderColor: '#555555' }}>
        <TR>
          <TH style={{ ...head, width: 60 }}>Departs</TH>
          <TH style={head}>To</TH>
          <TH style={head}>Platform</TH>
        </TR>
        {Array.from({ length: 48 }, (_, i) => {
          const time = `${String(6 + Math.floor(i / 3)).padStart(2, '0')}:${String((i % 3) * 20).padStart(2, '0')}`;
          return (
            <TR key={time}>
              <TH style={cell}>{time}</TH>
              <TD style={cell}>{stations[i % stations.length]}</TD>
              <TD style={cell}>{String((i % 4) + 1)}</TD>
            </TR>
          );
        })}
      </Table>
      <P>Times are local.</P>
    </Page>
  </Document>,
  out,
);
console.log(`Wrote ${out}`);

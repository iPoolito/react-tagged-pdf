// A table that continues over several pages: it breaks only between rows, cell borders and the
// shaded header row are Layout artifacts, the table's own border is sliced at each page break,
// and the structure tree still has one Table element holding every row.
import { Document, H1, P, Page, Table, TD, TH, TR } from '../../src/index.js';

const cell = { borderWidth: 0.5, borderColor: '#666666' };
const head = { ...cell, backgroundColor: '#e8e8e8' };

/** Rows of the table: a day label, a short note and, every seventh row, a note that wraps. */
export const ROWS = Array.from({ length: 60 }, (_, i) => ({
  day: `Day ${i + 1}`,
  note: i % 7 === 3 ? 'Maintenance window: the service is read-only while the database is migrated.' : 'Normal operation.',
}));

export default (
  <Document title="Service log" lang="en-US">
    <Page size="A5" margin={36}>
      <H1>Service log</H1>
      <P>One row per day. The table continues on the following pages.</P>
      <Table style={{ borderWidth: 1, borderColor: '#333333' }}>
        <TR>
          <TH style={{ ...head, width: 70 }}>Day</TH>
          <TH style={head}>Note</TH>
        </TR>
        {ROWS.map(({ day, note }) => (
          <TR key={day}>
            <TH style={cell}>{day}</TH>
            <TD style={cell}>{note}</TD>
          </TR>
        ))}
      </Table>
      <P>End of log.</P>
    </Page>
  </Document>
);

// Simple data tables: one with a header row, one with a header column, one with both (and an
// explicit scope, a fixed-width column, an empty cell, a link and a language change in cells),
// with bordered cells and a shaded header row.
import { Document, H1, H2, Link, P, Page, Span, Table, TD, TH, TR } from '../../src/index.js';

const cell = { borderWidth: 0.5, borderColor: '#666666' };
const head = { ...cell, backgroundColor: '#e8e8e8' };

export default (
  <Document title="Tables" lang="en-US">
    <Page size="A5" margin={36}>
      <H1>Tables</H1>
      <H2>Fruit prices (header row)</H2>
      <Table>
        <TR>
          <TH style={head}>Fruit</TH>
          <TH style={head}>Origin</TH>
          <TH style={head}>Price per kg</TH>
        </TR>
        <TR>
          <TD style={cell}>Apples</TD>
          <TD style={cell}>Spain</TD>
          <TD style={cell}>1.20</TD>
        </TR>
        <TR>
          <TD style={cell}>
            Pears (<Span lang="fr-FR">Doyenné du Comice</Span>)
          </TD>
          <TD style={cell}>France</TD>
          <TD style={cell}>2.40</TD>
        </TR>
      </Table>
      <H2>Opening hours (header column)</H2>
      <Table>
        <TR>
          <TH style={{ ...head, width: 110 }}>Monday</TH>
          <TD style={cell}>9:00–17:00</TD>
        </TR>
        <TR>
          <TH style={head}>Saturday</TH>
          <TD style={cell}>10:00–14:00</TD>
        </TR>
        <TR>
          <TH style={head}>Sunday</TH>
          <TD style={cell}>Closed</TD>
        </TR>
      </Table>
      <H2>Results (both)</H2>
      <Table>
        <TR>
          <TH style={head}>Team</TH>
          <TH style={head}>Won</TH>
          <TH style={head}>Notes</TH>
        </TR>
        <TR>
          <TH style={head}>North</TH>
          <TD style={cell}>7</TD>
          <TD style={cell}>
            See <Link href="https://example.com/north">the report</Link>
          </TD>
        </TR>
        <TR>
          <TH style={head}>South</TH>
          <TD style={cell}>5</TD>
          <TD style={cell} />
        </TR>
        <TR>
          <TH scope="Row" style={head}>
            Total
          </TH>
          <TD style={cell}>12</TD>
          <TD style={cell} />
        </TR>
      </Table>
      <P>Prices include VAT.</P>
    </Page>
  </Document>
);

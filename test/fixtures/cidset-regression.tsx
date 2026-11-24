// Regression fixture for the PDFKit CIDSet bug (veraPDF PDF/UA-1 rule 7.21.4.2-2).
// With this wider glyph set, PDFKit's PDF/UA subset writes an incomplete CIDSet
// unless createPdfDocument() applies its `subset = '1'` workaround.
import { Document, Page, P } from '../../src/index.js';

export default (
  <Document title="Glyph coverage" lang="es-ES">
    <Page>
      <P>Hola mundo, un párrafo. ¿Qué tal? — “comillas” € ñ Ω Ж</P>
    </Page>
  </Document>
);

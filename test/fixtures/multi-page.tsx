// Content flowing across pages: a paragraph and a framed Section that split across a
// page boundary, a PageBreak, and a second Page template with its own size and margins.
// Split elements must stay one structure element each (PDFKit writes /MCR for the later pages).
import { Document, H1, H2, P, Page, PageBreak, Section } from '../../src/index.js';

export const SPLIT_TEXT = Array.from(
  { length: 40 },
  (_, i) => `Sentence ${i + 1} of a paragraph long enough to continue on the next page.`,
).join(' ');

export default (
  <Document title="Multi-page report" lang="en-US">
    <Page size="Letter" margin={{ top: 54, right: 54, bottom: 72, left: 54 }}>
      <H1>Multi-page report</H1>
      <P>{SPLIT_TEXT}</P>
      <Section style={{ borderWidth: 1, borderColor: '#1a3a6b', backgroundColor: '#eef2f8', padding: 8 }}>
        <H2>Framed section</H2>
        <P>{SPLIT_TEXT}</P>
      </Section>
      <PageBreak />
      <H2>After a page break</H2>
      <P>This heading starts at the top of a new page.</P>
    </Page>
    <Page size={[841.89, 595.28]} margin={36} lang="fr-FR">
      <H2>Annexe</H2>
      <P>Un modèle de page paysage, sur sa propre page.</P>
    </Page>
  </Document>
);

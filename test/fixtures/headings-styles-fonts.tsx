// Headings (no skipped levels: a skip is a hard veraPDF failure, rule 7.4.2-1),
// nested sections, box and text styles, a registered font and per-element languages.
import { fileURLToPath } from 'node:url';
import { Document, Font, H1, H2, H3, P, Page, Section } from '../../src/index.js';

Font.register({
  family: 'Report Sans',
  src: fileURLToPath(new URL('../../fonts/NotoSans-BoldItalic.ttf', import.meta.url)),
});

export default (
  <Document title="Annual report" lang="en-US">
    <Page>
      <H1 style={{ color: '#1a3a6b' }}>Annual report</H1>
      <P>A short introduction in the document language.</P>
      <Section style={{ padding: 8, borderWidth: 1, borderColor: '#1a3a6b', marginBottom: 12 }}>
        <H2>Results</H2>
        <P style={{ lineHeight: 20 }}>Revenue grew in every region.</P>
        <Section lang="es-ES" style={{ backgroundColor: '#eef2f8', padding: 6 }}>
          <H3>Resumen en español</H3>
          <P>Los ingresos crecieron en todas las regiones.</P>
        </Section>
      </Section>
      <Section style={{ fontSize: 10, color: '#444444' }}>
        <H2>Notes</H2>
        <P lang="fr-FR">Les chiffres ne sont pas audités.</P>
        <P style={{ fontFamily: 'Report Sans' }}>Set in a registered font.</P>
      </Section>
    </Page>
  </Document>
);

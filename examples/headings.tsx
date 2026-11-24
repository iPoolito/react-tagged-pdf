// Run with `npm run example:headings`, then open test-output/headings.pdf.
// Shows headings (H1–H4, no skipped levels), nested Sections, box and text styles,
// a registered font family and per-element languages. Everything fits on one page.
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, Font, H1, H2, H3, H4, P, Page, renderToFile, Section } from '../src/index.js';

const font = (file: string) => fileURLToPath(new URL(`../fonts/${file}`, import.meta.url));

// Register a family under its own name. A text style picks the closest face by weight and style.
Font.register({ family: 'Titular', src: font('NotoSans-Bold.ttf'), weight: 'bold' });
Font.register({ family: 'Titular', src: font('NotoSans-BoldItalic.ttf'), weight: 'bold', style: 'italic' });

const brand = '#1a3a6b';

const out = fileURLToPath(new URL('../test-output/headings.pdf', import.meta.url));
await mkdir(dirname(out), { recursive: true });

await renderToFile(
  <Document title="Informe trimestral" lang="es-ES">
    <Page>
      <H1 style={{ fontFamily: 'Titular', color: brand }}>Informe trimestral</H1>
      <P style={{ color: '#444444' }}>
        Este documento usa encabezados, secciones, estilos y una fuente registrada. Todo el texto hereda el idioma del
        documento (es-ES) salvo los elementos que declaran su propio lang.
      </P>

      <Section style={{ padding: 10, borderWidth: 1, borderColor: brand, marginBottom: 12 }}>
        <H2 style={{ color: brand }}>Resultados</H2>
        <P style={{ lineHeight: 18 }}>
          Los ingresos crecieron en todas las regiones. Este párrafo usa un lineHeight de 18 puntos.
        </P>

        <Section style={{ backgroundColor: '#eef2f8', padding: 8, marginBottom: 6 }}>
          <H3>Por región</H3>
          <P style={{ fontWeight: 'bold' }}>Norte: +12 %</P>
          <P>Sur: +8 %</P>
        </Section>

        <Section lang="en-US" style={{ backgroundColor: '#f6f1e7', padding: 8 }}>
          <H3>Summary in English</H3>
          <P>Revenue grew in every region. This section declares lang="en-US".</P>
          <H4 style={{ fontStyle: 'italic' }}>A fourth-level heading</H4>
          <P style={{ fontStyle: 'italic' }}>Italic text uses the bundled Noto Sans Italic face.</P>
        </Section>
      </Section>

      <Section style={{ fontSize: 10, color: '#555555' }}>
        <H2>Notas</H2>
        <P>Las cifras no están auditadas. Esta sección hereda fontSize 10 y un color gris.</P>
        <P lang="fr-FR">Les chiffres ne sont pas audités.</P>
        <P style={{ fontFamily: 'Titular', fontStyle: 'italic' }}>Texto en la familia registrada «Titular».</P>
      </Section>
    </Page>
  </Document>,
  out,
);
console.log(`Wrote ${out}`);

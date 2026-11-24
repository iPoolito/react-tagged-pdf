// Run with `npm run example:pages`, then open test-output/pages.pdf.
// Shows content flowing across pages:
// - a Letter page template with custom margins;
// - body text that continues on the next page (one paragraph is split across the break:
//   in Acrobat's Tags panel it is still a single <P>);
// - a Section with border and background that splits: each page draws its slice of the
//   frame, open at the break (no bottom border before it, no top border after it);
// - a <PageBreak/> that starts a chapter at the top of a new page;
// - a second page template, landscape with 36 pt margins, for the annex.
// There is no keep-with-next yet, so a heading can end up alone at the bottom of a page.
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, H1, H2, H3, P, Page, PageBreak, renderToFile, Section } from '../src/index.js';

const brand = '#1a3a6b';
const parrafo = (n: number) =>
  `Párrafo ${n}. El contenido que no cabe en una página continúa en la siguiente, línea a línea. ` +
  'Los lectores de pantalla siguen anunciando cada párrafo como uno solo aunque esté partido, porque ' +
  'el contenido marcado de ambas páginas pertenece al mismo elemento de estructura. Los márgenes de la ' +
  'plantilla se respetan en todas las páginas físicas que genera.';

const out = fileURLToPath(new URL('../test-output/pages.pdf', import.meta.url));
await mkdir(dirname(out), { recursive: true });

await renderToFile(
  <Document title="Informe largo" lang="es-ES">
    <Page size="Letter" margin={{ top: 54, right: 54, bottom: 72, left: 54 }}>
      <H1 style={{ color: brand }}>Informe largo</H1>
      <P style={{ color: '#444444' }}>
        Plantilla Letter (612 × 792 pt) con márgenes de 54 pt y 72 pt abajo. Todo lo que sigue fluye por varias
        páginas sin que el autor tenga que partirlo a mano.
      </P>

      <H2>1. Contexto</H2>
      {Array.from({ length: 7 }, (_, i) => (
        <P key={i} style={{ lineHeight: 15 }}>
          {parrafo(i + 1)}
        </P>
      ))}

      <Section style={{ borderWidth: 1, borderColor: brand, backgroundColor: '#eef2f8', padding: 10, marginTop: 6 }}>
        <H3>Recuadro que se parte entre páginas</H3>
        {Array.from({ length: 9 }, (_, i) => (
          <P key={i}>{parrafo(i + 8)}</P>
        ))}
      </Section>

      <PageBreak />
      <H2>2. Metodología</H2>
      <P>
        Este capítulo empieza arriba de una página nueva gracias a {'<PageBreak/>'}. Un salto en una página que aún
        no tiene contenido se ignora, así que nunca aparecen páginas en blanco.
      </P>
    </Page>

    <Page size={[792, 612]} margin={36}>
      <H2 style={{ color: brand }}>Anexo (página apaisada)</H2>
      <P>
        Una segunda plantilla {'<Page>'} con tamaño propio [792, 612] y márgenes de 36 pt. Cada plantilla empieza en
        una página nueva y todo sigue bajo un único elemento Document.
      </P>
    </Page>
  </Document>,
  out,
);
console.log(`Wrote ${out}`);

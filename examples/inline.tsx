// Run with `npm run example:inline`, then open test-output/inline.pdf.
// Shows inline styles and links inside paragraphs and headings:
// - <Span> runs in bold, italic, color and another size, mixed in one paragraph that wraps:
//   lines break between words, never at the edge of a styled run, and runs of different
//   sizes share one baseline (the line grows to fit the largest);
// - a <Link> long enough to wrap onto a second line: it is clickable on both lines (two
//   annotation rectangles) and in Acrobat's Tags panel it is a single <Link> holding its text
//   and both annotations (OBJR); a <Span> adds no tag of its own;
// - links are underlined by default, so they never rely on color alone; the underline follows
//   the link onto its next line and stops at the last glyph, never under a line-end space;
// - a link whose `description` replaces the link text as the annotation's /Contents, which is
//   what assistive technology announces (hover it in Acrobat to see the tooltip);
// - an English phrase inside a Spanish paragraph: <Span lang="en-US"> becomes a <Span> tag with
//   Lang en-US in the Tags panel, so a screen reader switches pronunciation for those words;
// - a paragraph with styled runs and a link that splits across the page break, still one <P>.
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, H1, H2, Link, P, Page, renderToFile, Span } from '../src/index.js';

const brand = '#1a3a6b';
const enlace = { color: brand } as const;
const negrita = { fontWeight: 'bold' } as const;
const cursiva = { fontStyle: 'italic' } as const;

const out = fileURLToPath(new URL('../test-output/inline.pdf', import.meta.url));
await mkdir(dirname(out), { recursive: true });

await renderToFile(
  <Document title="Estilos en línea y enlaces" lang="es-ES">
    <Page size="A5" margin={42}>
      <H1 style={{ color: brand }}>
        Estilos <Span style={{ fontWeight: 'normal', fontStyle: 'italic' }}>en línea</Span>
      </H1>
      <P>
        Dentro de un párrafo se puede escribir en <Span style={negrita}>negrita</Span>, en{' '}
        <Span style={cursiva}>cursiva</Span>, en <Span style={{ color: '#b00020' }}>otro color</Span>, con un{' '}
        <Span style={{ fontSize: 18 }}>tamaño mayor</Span> o con{' '}
        <Span style={{ ...negrita, ...cursiva, color: brand }}>todo a la vez</Span>. El párrafo se parte en líneas
        entre palabras, nunca en el borde de un fragmento con estilo: in<Span style={negrita}>ter</Span>
        rumpido sigue siendo una sola palabra.
      </P>

      <H2>Enlaces</H2>
      <P>
        Consulte la{' '}
        <Link href="https://example.com/privacidad" style={enlace}>
          política de privacidad completa, que es lo bastante larga para continuar en la línea siguiente
        </Link>{' '}
        antes de seguir. Un enlace también puede llevar una descripción propia: lea los{' '}
        <Link href="https://example.com/terminos" description="Términos del servicio (example.com)" style={enlace}>
          términos
        </Link>{' '}
        o escríbanos a <Link href="mailto:equipo@example.com" style={enlace}>equipo@example.com</Link>. También
        puede llamarnos al <Link href="tel:+34600000000" style={enlace}>600 000 000</Link>.
      </P>
      <P>
        Todos los enlaces van subrayados para que no dependan solo del color. En la guía{' '}
        <Span lang="en-US" style={cursiva}>Getting Started</Span> (en inglés) se explica cómo empezar; el
        lector de pantalla pronuncia esas palabras en inglés.
      </P>

      <H2 style={{ marginTop: 24 }}>Un párrafo que cambia de página</H2>
      {Array.from({ length: 3 }, (_, i) => (
        <P key={i}>
          Párrafo {i + 1}. El texto con <Span style={negrita}>fragmentos en negrita</Span> y{' '}
          <Span style={cursiva}>en cursiva</Span> fluye por las páginas línea a línea igual que el texto sin estilo.
          Si el salto de página cae en medio, el lector de pantalla sigue anunciando un único párrafo, y un{' '}
          <Link href="https://example.com/ayuda" style={enlace}>
            enlace partido entre dos páginas sigue siendo un único elemento Link
          </Link>{' '}
          con un rectángulo pulsable en cada línea.
        </P>
      ))}
    </Page>
  </Document>,
  out,
);
console.log(`Wrote ${out}`);

// Underlined links (the default, wrapping across lines), a link with textDecoration 'none', an
// underlined heading and inline language changes, including a Span lang inside a Link and a
// Link inside a Span lang. Every underline is drawn inside its run's marked content.
import { Document, H1, Link, P, Page, Span } from '../../src/index.js';

export const WRAPPING_LINK = 'un enlace lo bastante largo para continuar en la línea siguiente';

export default (
  <Document title="Subrayado e idioma en línea" lang="es-ES">
    <Page size={[360, 400]} margin={36}>
      <H1 style={{ textDecoration: 'underline' }}>Subrayado</H1>
      <P>
        Aquí hay <Link href="https://example.com/largo">{WRAPPING_LINK}</Link>, y otro{' '}
        <Link href="https://example.com/sin" style={{ textDecoration: 'none', fontWeight: 'bold' }}>
          sin subrayar
        </Link>
        .
      </P>
      <P>
        Ella dijo <Span lang="en-US">good morning</Span> al entrar. Lea{' '}
        <Link href="https://example.com/guia">la guía <Span lang="en-US">Getting Started</Span></Link> o{' '}
        <Span lang="en-GB">
          the <Link href="https://example.com/colour">colour chart</Link>
        </Span>
        .
      </P>
    </Page>
  </Document>
);

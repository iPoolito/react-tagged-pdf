// Inline styled runs and links. Spans add no structure; each Link is a Link element with
// one OBJR per line it occupies, and every annotation has a non-empty /Contents.
import { Document, H1, Link, P, Page, Span } from '../../src/index.js';

export const WRAPPING_LINK = 'a link long enough to wrap onto the following line of this paragraph';

export default (
  <Document title="Inline styles and links" lang="en-US">
    <Page size={[360, 400]} margin={36}>
      <H1>
        Inline <Span style={{ fontStyle: 'italic', color: '#1a3a6b' }}>styles</Span>
      </H1>
      <P>
        Mixed runs: <Span style={{ fontWeight: 'bold' }}>bold</Span>,{' '}
        <Span style={{ fontStyle: 'italic' }}>italic</Span>,{' '}
        <Span style={{ color: '#b00020' }}>red</Span>, <Span style={{ fontSize: 18 }}>larger</Span> and{' '}
        <Span style={{ fontWeight: 'bold', fontStyle: 'italic' }}>both</Span>, all in one paragraph that wraps.
      </P>
      <P>
        Here is <Link href="https://example.com/inline" style={{ color: '#1a3a6b' }}>{WRAPPING_LINK}</Link>, then
        a <Link href="https://example.com/terms" description="Terms of service">short one</Link> and an{' '}
        <Link href="mailto:team@example.com">email link</Link>.
      </P>
    </Page>
  </Document>
);

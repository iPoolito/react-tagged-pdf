// Running header and "Page X of Y" footer on every page of a multi-page document, plus a
// standalone decorative <Artifact>. None of it may appear in the structure tree: veraPDF
// must see it all as artifacts (header/footer as /Pagination, the divider as /Layout).
import { Artifact, Document, H1, H2, P, Page } from '../../src/index.js';

export const BODY = Array.from(
  { length: 30 },
  (_, i) => `Sentence ${i + 1} of the annual report, long enough to need several pages.`,
).join(' ');

export default (
  <Document title="Annual report" lang="en-US">
    <Page
      size="A5"
      margin={{ top: 64, right: 48, bottom: 64, left: 48 }}
      header={() => <P style={{ fontSize: 8, color: '#555555' }}>Annual report 2026</P>}
      footer={({ pageNumber, totalPages }) => <P style={{ fontSize: 8 }}>{`Page ${pageNumber} of ${totalPages}`}</P>}
    >
      <H1>Annual report</H1>
      <P>{BODY}</P>
      <Artifact>
        <P style={{ color: '#999999', borderWidth: 0.5, borderColor: '#999999', padding: 2 }}>* * *</P>
      </Artifact>
      <H2>Outlook</H2>
      <P>{BODY}</P>
    </Page>
  </Document>
);

import { Document, Page, P } from '../../src/index.js';

export const LONG_TEXT =
  'Accessible documents let everyone read them, including people who use screen readers, ' +
  'magnifiers or braille displays. A tagged PDF carries a structure tree that tells assistive ' +
  'technology what each piece of content is and in which order to read it. This paragraph is ' +
  'deliberately long so that it has to wrap across several lines, and every line must stay ' +
  'inside the page margins without losing or reordering a single word.';

export default (
  <Document title="Long paragraph" lang="en-US">
    <Page>
      <P>{LONG_TEXT}</P>
      <P>A second, short paragraph.</P>
    </Page>
  </Document>
);

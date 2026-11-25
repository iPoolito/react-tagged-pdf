import { fileURLToPath } from 'node:url';
import { type FC, type ReactNode, useLayoutEffect, useState } from 'react';
import { describe, expect, it } from 'vitest';
import {
  Artifact,
  Document,
  Font,
  type FontSource,
  H1,
  Image,
  Link,
  List,
  ListItem,
  P,
  Page,
  PageBreak,
  renderToBuffer,
  Section,
  Span,
  Table,
  TD,
  TH,
  TR,
  ValidationError,
  type ValidationCode,
} from '../src/index.js';

const PNG = fileURLToPath(new URL('./fixtures/images/chart.png', import.meta.url));

/** The components with their prop types loosened, to pass the invalid props a JavaScript caller could. */
const X = { Document, Image, Link, List, TD } as unknown as Record<'Document' | 'Image' | 'Link' | 'List' | 'TD', FC<any>>;

/** A document whose second page holds `children`; `page` are that page's props. Paths point into Page[2]. */
const doc = (children: ReactNode, page: Record<string, unknown> = {}) => (
  <Document title="T" lang="en-US">
    <Page>
      <H1>Fine</H1>
    </Page>
    <Page {...page}>{children}</Page>
  </Document>
);

/** What `run` threw (or rejected with), asserted to be a ValidationError. */
async function thrown(run: () => unknown): Promise<ValidationError> {
  let error: unknown;
  try {
    await run();
  } catch (e) {
    error = e;
  }
  expect(error).toBeInstanceOf(ValidationError);
  return error as ValidationError;
}

const render = (element: ReactNode) => () => renderToBuffer(element);

/** How to trigger one code, and where it should point. `path: undefined` means no component path. */
type Case = { code: ValidationCode; run: () => unknown; path?: string; message: RegExp };

const cases: Record<string, Case> = {
  'a <Document> with no title': {
    code: 'RTP_DOCUMENT_NO_TITLE',
    run: render(
      // @ts-expect-error title is required
      <Document lang="en-US">
        <Page>
          <H1>x</H1>
        </Page>
      </Document>,
    ),
    path: 'Document',
    message: /requires a non-empty `title` prop/,
  },
  'a <Document> with no lang': {
    code: 'RTP_DOCUMENT_NO_LANG',
    run: render(
      <X.Document title="T">
        <Page />
      </X.Document>,
    ),
    path: 'Document',
    message: /requires a non-empty `lang` prop/,
  },
  'a root that is not a <Document>': {
    code: 'RTP_ROOT_NOT_DOCUMENT',
    run: render(<Page />),
    message: /must be a single <Document> at the root/,
  },
  'a <Document> with no pages': {
    code: 'RTP_DOCUMENT_NO_PAGES',
    run: render(<Document title="T" lang="en-US">{null}</Document>),
    path: 'Document',
    message: /must contain at least one <Page>/,
  },
  'an unknown page size': {
    code: 'RTP_PAGE_INVALID_SIZE',
    run: render(doc(<P>x</P>, { size: 'B9' })),
    path: 'Document > Page[2]',
    message: /<Page> `size` must be one of/,
  },
  'a negative page margin': {
    code: 'RTP_PAGE_INVALID_MARGIN',
    run: render(doc(<P>x</P>, { margin: -1 })),
    path: 'Document > Page[2]',
    message: /<Page> `margin` must be a non-negative number/,
  },
  'margins that leave no content area': {
    code: 'RTP_PAGE_NO_CONTENT_AREA',
    run: render(doc(<P>x</P>, { margin: 400 })),
    path: 'Document > Page[2]',
    message: /<Page> margins leave no content area/,
  },
  'a <Span> directly in a <Section>': {
    code: 'RTP_INVALID_CHILD',
    run: render(
      doc(
        <Section>
          <Span>x</Span>
        </Section>,
      ),
    ),
    path: 'Document > Page[2] > Section > Span',
    message: /<Section> may only contain/,
  },
  'a <ListItem> outside a <List>': {
    code: 'RTP_INVALID_CHILD',
    run: render(doc(<ListItem>x</ListItem>)),
    path: 'Document > Page[2] > ListItem',
    message: /<ListItem> must be a child of <List>/,
  },
  'a <List> with a non-boolean `ordered`': {
    code: 'RTP_INVALID_PROP',
    run: render(
      doc(
        <X.List ordered="yes">
          <ListItem>x</ListItem>
        </X.List>,
      ),
    ),
    path: 'Document > Page[2] > List',
    message: /<List> `ordered` must be true or false/,
  },
  'an empty `lang`': {
    code: 'RTP_INVALID_LANG',
    run: render(doc(<P lang="">x</P>)),
    path: 'Document > Page[2] > P',
    message: /<P> `lang` must be a non-empty BCP 47 language tag/,
  },
  'a <Link> in an <Artifact>': {
    code: 'RTP_LINK_IN_ARTIFACT',
    run: render(
      doc(
        <Artifact>
          <P>
            <Link href="https://example.com">x</Link>
          </P>
        </Artifact>,
      ),
    ),
    path: 'Document > Page[2] > Artifact',
    message: /<Artifact> cannot contain <Link>/,
  },
  'an <Image> with no src': {
    code: 'RTP_IMAGE_NO_SRC',
    run: render(doc(<X.Image alt="Chart" />)),
    path: 'Document > Page[2] > Image',
    message: /<Image> requires a `src`/,
  },
  'an <Image> with neither alt nor decorative': {
    code: 'RTP_IMAGE_NO_ALT',
    run: render(doc(<X.Image src={PNG} />)),
    path: 'Document > Page[2] > Image',
    message: /needs a text alternative/,
  },
  'an <Image> with both alt and decorative': {
    code: 'RTP_IMAGE_ALT_AND_DECORATIVE',
    run: render(doc(<X.Image src={PNG} alt="Chart" decorative />)),
    path: 'Document > Page[2] > Image',
    message: /has both `alt` and `decorative`/,
  },
  'an empty <ListItem>': {
    code: 'RTP_LIST_ITEM_EMPTY',
    run: render(
      doc(
        <List>
          <ListItem>x</ListItem>
          <ListItem> </ListItem>
        </List>,
      ),
    ),
    path: 'Document > Page[2] > List > ListItem',
    message: /<ListItem> has no content/,
  },
  'a <TR> with no cells': {
    code: 'RTP_TABLE_ROW_EMPTY',
    run: render(
      doc(
        <Table>
          <TR />
        </Table>,
      ),
    ),
    path: 'Document > Page[2] > Table > TR',
    message: /<TR> has no cells/,
  },
  'rows with different numbers of cells': {
    code: 'RTP_TABLE_RAGGED_ROWS',
    run: render(
      doc(
        <Table>
          <TR>
            <TH>a</TH>
          </TR>
          <TR>
            <TD>1</TD>
            <TD>2</TD>
          </TR>
        </Table>,
      ),
    ),
    path: 'Document > Page[2] > Table',
    message: /rows must all have the same number of cells/,
  },
  'a cell with colSpan': {
    code: 'RTP_TABLE_SPAN_UNSUPPORTED',
    run: render(
      doc(
        <Table>
          <TR>
            <X.TD colSpan={2}>a</X.TD>
          </TR>
        </Table>,
      ),
    ),
    path: 'Document > Page[2] > Table > TR > TD',
    message: /<TD> `colSpan` is not supported yet/,
  },
  'cells of one column with different widths': {
    code: 'RTP_TABLE_COLUMN_WIDTH_CONFLICT',
    run: render(
      doc(
        <Table>
          <TR>
            <TH style={{ width: 100 }}>a</TH>
          </TR>
          <TR>
            <TD style={{ width: 120 }}>1</TD>
          </TR>
        </Table>,
      ),
    ),
    path: 'Document > Page[2] > Table',
    message: /column 1 has cells with different `style.width` values/,
  },
  'a <Link> with no href': {
    code: 'RTP_LINK_NO_HREF',
    run: render(
      doc(
        <P>
          <X.Link>x</X.Link>
        </P>,
      ),
    ),
    path: 'Document > Page[2] > P > Link',
    message: /<Link> requires a non-empty `href` prop/,
  },
  'a <Link> to an anchor': {
    code: 'RTP_LINK_HREF_UNSUPPORTED',
    run: render(
      doc(
        <P>
          <Link href="#top">x</Link>
        </P>,
      ),
    ),
    path: 'Document > Page[2] > P > Link',
    message: /is not supported yet: only external URLs/,
  },
  'a javascript: <Link>': {
    code: 'RTP_LINK_SCHEME_NOT_ALLOWED',
    run: render(
      doc(
        <P>
          <Link href="javascript:alert(1)">x</Link>
        </P>,
      ),
    ),
    path: 'Document > Page[2] > P > Link',
    message: /uses the scheme "javascript:", which is not allowed/,
  },
  'a <Link> with no text': {
    code: 'RTP_LINK_NO_TEXT',
    run: render(
      doc(
        <P>
          <Link href="https://example.com"> </Link>
        </P>,
      ),
    ),
    path: 'Document > Page[2] > P > Link',
    message: /has no visible text/,
  },
  'an invalid style value': {
    code: 'RTP_INVALID_STYLE',
    run: render(doc(<P style={{ fontSize: -1 }}>x</P>)),
    path: 'Document > Page[2] > P',
    message: /<P> `style.fontSize`/,
  },
  'an unknown style key': {
    code: 'RTP_UNKNOWN_STYLE_KEY',
    run: render(doc(<P style={{ colour: 'red' } as object}>x</P>)),
    path: 'Document > Page[2] > P',
    message: /<P> `style` has unknown key "colour"/,
  },
  'a margin on a table cell': {
    code: 'RTP_STYLE_NOT_SUPPORTED',
    run: render(
      doc(
        <Table>
          <TR>
            <TD style={{ margin: 4 } as object}>a</TD>
          </TR>
        </Table>,
      ),
    ),
    path: 'Document > Page[2] > Table > TR > TD',
    message: /<TD> `style.margin` is not supported on table cells/,
  },
  // Layout knows which <Page> it is laying out, not the component inside it.
  'padding that leaves no content width': {
    code: 'RTP_NO_CONTENT_WIDTH',
    run: render(
      doc(
        <Section style={{ paddingLeft: 1000 }}>
          <P>x</P>
        </Section>,
      ),
    ),
    path: 'Document > Page[2]',
    message: /<Section> has no room for content/,
  },
  'a line taller than the page': {
    code: 'RTP_LINE_TOO_TALL',
    run: render(doc(<P style={{ fontSize: 2000 }}>x</P>)),
    path: 'Document > Page[2]',
    message: /line that does not fit in the page content area/,
  },
  'column widths wider than the table': {
    code: 'RTP_TABLE_TOO_WIDE',
    run: render(
      doc(
        <Table>
          <TR>
            <TD style={{ width: 5000 }}>a</TD>
          </TR>
        </Table>,
      ),
    ),
    path: 'Document > Page[2]',
    message: /<Table> column widths add up to 5000 pt/,
  },
  'a table row taller than the page': {
    code: 'RTP_TABLE_ROW_TOO_TALL',
    run: render(
      doc(
        <Table>
          <TR>
            <TD style={{ paddingTop: 2000 }}>a</TD>
          </TR>
        </Table>,
      ),
    ),
    path: 'Document > Page[2]',
    message: /a table row is never split across pages/,
  },
  'an image wider than its content width': {
    code: 'RTP_IMAGE_TOO_WIDE',
    run: render(doc(<Image src={PNG} alt="Chart" style={{ width: 5000 }} />)),
    path: 'Document > Page[2]',
    message: /wider than the .* pt of content width/,
  },
  'an image taller than the page': {
    code: 'RTP_IMAGE_TOO_TALL',
    run: render(doc(<Image src={PNG} alt="Chart" style={{ width: 100, height: 5000 }} />)),
    path: 'Document > Page[2]',
    message: /does not fit in the page content area/,
  },
  'image bytes that are not a JPEG or PNG': {
    code: 'RTP_IMAGE_UNREADABLE',
    run: render(doc(<Image src={Buffer.from('not an image')} alt="Chart" />)),
    path: 'Document > Page[2]',
    message: /could not be read as a JPEG or PNG/,
  },
  'a header taller than half the top margin': {
    code: 'RTP_RUNNING_CONTENT_TOO_TALL',
    run: render(doc(<P>x</P>, { header: () => <P style={{ fontSize: 200 }}>Big</P> })),
    path: 'Document > Page[2] > header',
    message: /<Page> header on page 2 is .* pt tall/,
  },
  'a <PageBreak> in a footer': {
    code: 'RTP_INVALID_CHILD',
    run: render(doc(<P>x</P>, { footer: () => <PageBreak /> })),
    path: 'Document > Page[2] > footer',
    message: /<Page footer> cannot contain <PageBreak>/,
  },
  // Fonts are resolved with the style, so these point at the component again.
  'a font family that is not registered': {
    code: 'RTP_FONT_NOT_REGISTERED',
    run: render(doc(<P style={{ fontFamily: 'Nope Sans' }}>x</P>)),
    path: 'Document > Page[2] > P',
    message: /Font family "Nope Sans" is not registered/,
  },
  'a standard-14 font': {
    code: 'RTP_FONT_NOT_EMBEDDED',
    run: render(doc(<P style={{ fontFamily: 'Helvetica' }}>x</P>)),
    path: 'Document > Page[2] > P',
    message: /is a PDF standard-14 font, which is not embedded/,
  },
  'Font.register without a family': {
    code: 'RTP_FONT_NO_FAMILY',
    run: () => Font.register({ family: '', src: Buffer.from('') }),
    message: /Font.register requires a non-empty `family`/,
  },
  'Font.register without a src': {
    code: 'RTP_FONT_NO_SRC',
    run: () => Font.register({ family: 'Brand' } as FontSource),
    message: /requires `src`: a file path or the font bytes/,
  },
  'Font.register with a path that is not a file': {
    code: 'RTP_FONT_UNREADABLE',
    run: () => Font.register({ family: 'Brand', src: '/no/such/font.ttf' }),
    message: /cannot read `src` "\/no\/such\/font.ttf"/,
  },
  'a state update after the first render': {
    code: 'RTP_STATE_UPDATE',
    run: render(doc(<Counter />)),
    message: /renders once; state updates after the first render are not supported/,
  },
};

/** Updates its own text right after mounting, which a render-once document cannot follow. */
function Counter() {
  const [count, setCount] = useState(0);
  useLayoutEffect(() => setCount(1), []);
  return <P>{count}</P>;
}

/** Every code; the type checker fails here when a code is added without being listed. */
const allCodes = Object.keys({
  RTP_ROOT_NOT_DOCUMENT: true,
  RTP_DOCUMENT_NO_TITLE: true,
  RTP_DOCUMENT_NO_LANG: true,
  RTP_DOCUMENT_NO_PAGES: true,
  RTP_PAGE_INVALID_SIZE: true,
  RTP_PAGE_INVALID_MARGIN: true,
  RTP_PAGE_NO_CONTENT_AREA: true,
  RTP_INVALID_CHILD: true,
  RTP_INVALID_PROP: true,
  RTP_INVALID_LANG: true,
  RTP_LINK_IN_ARTIFACT: true,
  RTP_IMAGE_NO_SRC: true,
  RTP_IMAGE_NO_ALT: true,
  RTP_IMAGE_ALT_AND_DECORATIVE: true,
  RTP_IMAGE_UNREADABLE: true,
  RTP_IMAGE_TOO_WIDE: true,
  RTP_IMAGE_TOO_TALL: true,
  RTP_LIST_ITEM_EMPTY: true,
  RTP_TABLE_ROW_EMPTY: true,
  RTP_TABLE_RAGGED_ROWS: true,
  RTP_TABLE_SPAN_UNSUPPORTED: true,
  RTP_TABLE_COLUMN_WIDTH_CONFLICT: true,
  RTP_TABLE_TOO_WIDE: true,
  RTP_TABLE_ROW_TOO_TALL: true,
  RTP_LINK_NO_HREF: true,
  RTP_LINK_HREF_UNSUPPORTED: true,
  RTP_LINK_SCHEME_NOT_ALLOWED: true,
  RTP_LINK_NO_TEXT: true,
  RTP_INVALID_STYLE: true,
  RTP_UNKNOWN_STYLE_KEY: true,
  RTP_STYLE_NOT_SUPPORTED: true,
  RTP_NO_CONTENT_WIDTH: true,
  RTP_LINE_TOO_TALL: true,
  RTP_RUNNING_CONTENT_TOO_TALL: true,
  RTP_FONT_NO_FAMILY: true,
  RTP_FONT_NO_SRC: true,
  RTP_FONT_UNREADABLE: true,
  RTP_FONT_NOT_REGISTERED: true,
  RTP_FONT_NOT_EMBEDDED: true,
  RTP_STATE_UPDATE: true,
} satisfies Record<ValidationCode, true>);

it('has a case for every code', () => {
  const covered = new Set(Object.values(cases).map((c) => c.code));
  expect(allCodes.filter((code) => !covered.has(code as ValidationCode))).toEqual([]);
});

describe('invalid input throws a ValidationError with a stable code', () => {
  it.each(Object.entries(cases))('%s', async (_, { code, run, path, message }) => {
    const error = await thrown(run);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ValidationError');
    expect(error.code).toBe(code);
    expect(error.path).toBe(path);
    expect(error.message).toMatch(message);
    if (path) expect(error.message).toContain(`(at ${path})`);
  });
});

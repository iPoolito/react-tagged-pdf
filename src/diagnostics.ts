// Accessibility diagnostics: problems that do not stop rendering by default, and become an
// `AccessibilityError` in strict mode. Each has a stable code to match on and the path of the
// component it is about.

/**
 * Stable identifier of an accessibility problem.
 * - `RTP_HEADING_FIRST_NOT_H1`: the first heading is not an `<H1>`.
 * - `RTP_HEADING_SKIP`: a heading skips a level going down (e.g. `<H1>` then `<H3>`).
 * - `RTP_TABLE_NO_TH`: a `<Table>` has no `<TH>` header cells.
 * - `RTP_IMAGE_EMPTY_ALT`: an `<Image>` has an empty `alt`, so it is drawn as decoration.
 */
export type DiagnosticCode = 'RTP_HEADING_FIRST_NOT_H1' | 'RTP_HEADING_SKIP' | 'RTP_TABLE_NO_TH' | 'RTP_IMAGE_EMPTY_ALT';

/**
 * One accessibility problem. `path` is the component it is about, from the root, e.g.
 * `Document > Page[1] > Section > H3`.
 */
export type Diagnostic = { code: DiagnosticCode; path: string; message: string };

/** One line naming the code, the component and the problem. */
export const formatDiagnostic = (d: Diagnostic) => `react-tagged-pdf ${d.code} at ${d.path}: ${d.message}`;

/** Thrown by `renderToBuffer`/`renderToFile` in strict mode when the document has accessibility problems. */
export class AccessibilityError extends Error {
  /** The code of the first problem; every problem is in `diagnostics`. */
  readonly code: DiagnosticCode;
  readonly diagnostics: readonly Diagnostic[];

  constructor(diagnostics: readonly [Diagnostic, ...Diagnostic[]]) {
    const lines = diagnostics.map(formatDiagnostic);
    super(
      lines.length === 1
        ? lines[0]
        : `react-tagged-pdf found ${lines.length} accessibility problems:\n${lines.map((l) => `  - ${l}`).join('\n')}`,
    );
    this.name = 'AccessibilityError';
    this.code = diagnostics[0].code;
    this.diagnostics = diagnostics;
  }
}

/** Strict mode throws on any diagnostic; otherwise each one is a `console.warn`. */
export function report(diagnostics: readonly Diagnostic[], strict: boolean): void {
  const [first, ...rest] = diagnostics;
  if (!first) return;
  if (strict) throw new AccessibilityError([first, ...rest]);
  for (const d of diagnostics) console.warn(formatDiagnostic(d));
}

// Validation errors: input that cannot be rendered at all. Always thrown, strict mode or not.

/**
 * Stable identifier of a validation error: input that cannot be rendered.
 *
 * Document and pages
 * - `RTP_ROOT_NOT_DOCUMENT`: the rendered element is not a single `<Document>`.
 * - `RTP_DOCUMENT_NO_TITLE`: `<Document>` has no `title`.
 * - `RTP_DOCUMENT_NO_LANG`: `<Document>` has no `lang`.
 * - `RTP_DOCUMENT_NO_PAGES`: `<Document>` has no `<Page>`.
 * - `RTP_PAGE_INVALID_SIZE`: `<Page>` `size` is not a known name or `[width, height]`.
 * - `RTP_PAGE_INVALID_MARGIN`: `<Page>` `margin` is not a non-negative number or `{ top, right, bottom, left }`.
 * - `RTP_PAGE_NO_CONTENT_AREA`: `<Page>` margins leave no room for content.
 *
 * Structure and props
 * - `RTP_INVALID_CHILD`: a component is somewhere it is not allowed (wrong parent or child, or children where none are taken).
 * - `RTP_INVALID_PROP`: a prop has a value of the wrong type or outside its allowed values.
 * - `RTP_INVALID_LANG`: a `lang` prop is not a non-empty language tag.
 * - `RTP_LINK_IN_ARTIFACT`: a `<Link>` in an `<Artifact>` or a running header/footer, where it could not be reached.
 *
 * Images
 * - `RTP_IMAGE_NO_SRC`: `<Image>` has no `src`.
 * - `RTP_IMAGE_NO_ALT`: `<Image>` has neither `alt` nor `decorative`.
 * - `RTP_IMAGE_ALT_AND_DECORATIVE`: `<Image>` has both `alt` and `decorative`.
 * - `RTP_IMAGE_UNREADABLE`: the image file or bytes are not a readable JPEG or PNG.
 * - `RTP_IMAGE_TOO_WIDE`: the image's explicit `style.width` is wider than the content width it is in.
 * - `RTP_IMAGE_TOO_TALL`: the image is taller than a page's content area.
 *
 * Lists and tables
 * - `RTP_LIST_ITEM_EMPTY`: `<ListItem>` has no content.
 * - `RTP_TABLE_ROW_EMPTY`: `<TR>` has no cells.
 * - `RTP_TABLE_RAGGED_ROWS`: the rows of a `<Table>` have different numbers of cells.
 * - `RTP_TABLE_SPAN_UNSUPPORTED`: a cell has a `rowSpan` or `colSpan` other than 1.
 * - `RTP_TABLE_COLUMN_WIDTH_CONFLICT`: cells of one column set different `style.width`s.
 * - `RTP_TABLE_TOO_WIDE`: column widths leave no room in the table's content width.
 * - `RTP_TABLE_ROW_TOO_TALL`: a table row is taller than a page's content area.
 *
 * Links
 * - `RTP_LINK_NO_HREF`: `<Link>` has no `href`.
 * - `RTP_LINK_HREF_UNSUPPORTED`: `href` is not an external URL with a scheme (internal links are not supported yet).
 * - `RTP_LINK_SCHEME_NOT_ALLOWED`: `href` uses a scheme other than http, https, mailto or tel.
 * - `RTP_LINK_NO_TEXT`: `<Link>` has no visible text.
 *
 * Style
 * - `RTP_INVALID_STYLE`: `style` is not an object, or a style value is invalid.
 * - `RTP_UNKNOWN_STYLE_KEY`: `style` has a key the library does not know.
 * - `RTP_STYLE_NOT_SUPPORTED`: a known style key that this component does not take (e.g. a margin on a table cell).
 *
 * Layout
 * - `RTP_NO_CONTENT_WIDTH`: margin, border and padding leave a box or cell no width for content.
 * - `RTP_LINE_TOO_TALL`: one line of text is taller than a page's content area.
 * - `RTP_RUNNING_CONTENT_TOO_TALL`: a running header or footer does not fit in half its page margin.
 *
 * Fonts
 * - `RTP_FONT_NO_FAMILY`: `Font.register` without a `family`.
 * - `RTP_FONT_NO_SRC`: `Font.register` without a `src`.
 * - `RTP_FONT_UNREADABLE`: the `Font.register` `src` path is not a readable file.
 * - `RTP_FONT_NOT_REGISTERED`: `style.fontFamily` names a family that is not registered.
 * - `RTP_FONT_NOT_EMBEDDED`: `style.fontFamily` names a PDF standard-14 font, which is not embedded (PDF/UA requires embedding).
 *
 * Rendering
 * - `RTP_STATE_UPDATE`: a component updated state after the first render; documents render once.
 */
export type ValidationCode =
  | 'RTP_ROOT_NOT_DOCUMENT'
  | 'RTP_DOCUMENT_NO_TITLE'
  | 'RTP_DOCUMENT_NO_LANG'
  | 'RTP_DOCUMENT_NO_PAGES'
  | 'RTP_PAGE_INVALID_SIZE'
  | 'RTP_PAGE_INVALID_MARGIN'
  | 'RTP_PAGE_NO_CONTENT_AREA'
  | 'RTP_INVALID_CHILD'
  | 'RTP_INVALID_PROP'
  | 'RTP_INVALID_LANG'
  | 'RTP_LINK_IN_ARTIFACT'
  | 'RTP_IMAGE_NO_SRC'
  | 'RTP_IMAGE_NO_ALT'
  | 'RTP_IMAGE_ALT_AND_DECORATIVE'
  | 'RTP_IMAGE_UNREADABLE'
  | 'RTP_IMAGE_TOO_WIDE'
  | 'RTP_IMAGE_TOO_TALL'
  | 'RTP_LIST_ITEM_EMPTY'
  | 'RTP_TABLE_ROW_EMPTY'
  | 'RTP_TABLE_RAGGED_ROWS'
  | 'RTP_TABLE_SPAN_UNSUPPORTED'
  | 'RTP_TABLE_COLUMN_WIDTH_CONFLICT'
  | 'RTP_TABLE_TOO_WIDE'
  | 'RTP_TABLE_ROW_TOO_TALL'
  | 'RTP_LINK_NO_HREF'
  | 'RTP_LINK_HREF_UNSUPPORTED'
  | 'RTP_LINK_SCHEME_NOT_ALLOWED'
  | 'RTP_LINK_NO_TEXT'
  | 'RTP_INVALID_STYLE'
  | 'RTP_UNKNOWN_STYLE_KEY'
  | 'RTP_STYLE_NOT_SUPPORTED'
  | 'RTP_NO_CONTENT_WIDTH'
  | 'RTP_LINE_TOO_TALL'
  | 'RTP_RUNNING_CONTENT_TOO_TALL'
  | 'RTP_FONT_NO_FAMILY'
  | 'RTP_FONT_NO_SRC'
  | 'RTP_FONT_UNREADABLE'
  | 'RTP_FONT_NOT_REGISTERED'
  | 'RTP_FONT_NOT_EMBEDDED'
  | 'RTP_STATE_UPDATE';

/** A length in points as messages show it: rounded to at most two decimals. */
export const round2 = (n: number) => Number(n.toFixed(2));

/** Put `segment` in front of a validation error's path: the error happened inside that component. */
let prependPath: (error: ValidationError, segment: string) => void;

/**
 * Thrown for input that cannot be rendered, by `renderToBuffer`/`renderToFile` and `Font.register`,
 * strict mode or not. `path` is the component it is about, from the root (e.g.
 * `Document > Page[1] > Table > TR > TD`), when known; the message then ends with `(at <path>)`.
 */
export class ValidationError extends Error {
  readonly code: ValidationCode;
  readonly path?: string;
  /** The message without the path. */
  readonly #problem: string;

  constructor(code: ValidationCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ValidationError';
    this.code = code;
    this.#problem = message;
  }

  static {
    prependPath = (error, segment) => {
      const path = error.path ? `${segment} > ${error.path}` : segment;
      // `path` is read-only to callers; only `within` sets it, as the error travels up the tree.
      Object.defineProperty(error, 'path', { value: path, enumerable: true, configurable: true, writable: false });
      error.message = `${error.#problem} (at ${path})`;
    };
  }
}

/**
 * Run `fn` inside the component named by `segment`: a `ValidationError` it throws gets `segment`
 * in front of its path. Nested calls build the path from the root down.
 */
export function within<T>(segment: string, fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof ValidationError) prependPath(error, segment);
    throw error;
  }
}

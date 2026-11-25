import { createElement, type ReactNode } from 'react';
import { HEADING_KINDS, type HeadingKind, type HeadingLevel } from './headings.js';
import type { ImageStyle, InlineStyle, Style } from './style.js';

export type { ImageStyle, InlineStyle };

const headingHostTypes = Object.fromEntries(HEADING_KINDS.map((kind) => [kind, `RTP_${kind}`])) as {
  [K in HeadingKind]: `RTP_${K}`;
};

/** Intrinsic host element names, private to the renderer. */
export const HostType = {
  Document: 'RTP_DOCUMENT',
  Page: 'RTP_PAGE',
  PageBreak: 'RTP_PAGE_BREAK',
  Section: 'RTP_SECTION',
  P: 'RTP_P',
  Span: 'RTP_SPAN',
  Link: 'RTP_LINK',
  List: 'RTP_LIST',
  ListItem: 'RTP_LIST_ITEM',
  Image: 'RTP_IMAGE',
  Table: 'RTP_TABLE',
  TR: 'RTP_TR',
  TH: 'RTP_TH',
  TD: 'RTP_TD',
  Artifact: 'RTP_ARTIFACT',
  ...headingHostTypes,
} as const;
export type HostType = (typeof HostType)[keyof typeof HostType];

export type DocumentProps = {
  /** Document title. Required by PDF/UA: written to dc:title and shown in the viewer title bar. */
  title: string;
  /** Natural language of the document as a BCP 47 tag, e.g. `en-US`. Required by PDF/UA. */
  lang: string;
  children?: ReactNode;
};

/** Props shared by every component below `<Document>`. */
export type CommonProps = {
  /** Natural language of this element's content as a BCP 47 tag, e.g. `es-ES`. Written as the element's `Lang`. */
  lang?: string;
  children?: ReactNode;
};

/** Props of block-level components. */
export type BlockProps = CommonProps & {
  /** Text properties (fontFamily, fontSize, ...) inherit to descendants like CSS. Lengths are points. */
  style?: Style;
};

/** Named paper sizes. */
export type PageSizeName = 'A3' | 'A4' | 'A5' | 'Letter' | 'Legal';
/** A named paper size, or `[width, height]` in points (e.g. `[841.89, 595.28]` for A4 landscape). */
export type PageSize = PageSizeName | readonly [width: number, height: number];
/** Points on all four sides, or per side (a side left out is 72). */
export type PageMargin = number | { top?: number; right?: number; bottom?: number; left?: number };

/** What a running header or footer is told about the physical page it is drawn on. */
export type PageInfo = {
  /** 1-based number of the physical page, counted across the whole document. */
  pageNumber: number;
  /** Number of physical pages in the whole document. */
  totalPages: number;
};
/**
 * Content repeated on every physical page of a `<Page>` template, such as "Page 3 of 7".
 * Called once per page, after the document is laid out, so `totalPages` is final. Returns
 * blocks (`<P>`, `<Section>`, ...) or text; `<Link>` is not allowed.
 */
export type RunningContent = (info: PageInfo) => ReactNode;

export type PageProps = CommonProps & {
  /** Paper size. Default `'A4'`. */
  size?: PageSize;
  /** Page margins in points. Default 72 on every side. */
  margin?: PageMargin;
  /**
   * Running header, drawn in the top margin of every physical page: its top half a top margin
   * below the page edge. A pagination artifact: screen readers skip it and it is not in the
   * structure tree. It must fit in half the top margin, else it throws `RTP_RUNNING_CONTENT_TOO_TALL`.
   */
  header?: RunningContent;
  /**
   * Running footer, drawn in the bottom margin of every physical page: its bottom half a bottom
   * margin above the page edge. A pagination artifact: screen readers skip it and it is not in
   * the structure tree. It must fit in half the bottom margin, else it throws `RTP_RUNNING_CONTENT_TOO_TALL`.
   */
  footer?: RunningContent;
};
/** `<PageBreak/>` takes no props and no children. */
export type PageBreakProps = Record<string, never>;
export type SectionProps = BlockProps;
export type PProps = BlockProps;

export type HeadingProps = BlockProps;

export type ListProps = BlockProps & {
  /** Numbered `1.`, `2.`, `3.`, … when true; bulleted when false (default). */
  ordered?: boolean;
};
export type ListItemProps = BlockProps;

/** Where an image's bytes come from: a file path, or the file's contents. */
export type ImageSource = string | Uint8Array;

type ImageCommonProps = {
  /** A JPEG or PNG file: its path, or its contents as a `Buffer`/`Uint8Array`. */
  src: ImageSource;
  /**
   * Natural language of the `alt` text as a BCP 47 tag, e.g. `es-ES`, when it differs from the
   * surrounding content's. Written as the Figure's `Lang`.
   */
  lang?: string;
  /** Size (`width`, `height`) and box properties. Lengths are points. */
  style?: ImageStyle;
};

/**
 * Every image is either described or explicitly decorative, never neither: give exactly one of
 * `alt` (what the image conveys, announced by screen readers) or `decorative`.
 */
export type ImageProps = ImageCommonProps &
  (
    | {
        /** A text alternative: what the image conveys. Becomes the Figure's `Alt`. */
        alt: string;
        decorative?: never;
      }
    | {
        /** The image adds no information: it becomes an artifact that assistive technology skips. */
        decorative: true;
        alt?: never;
      }
  );

export type TableProps = BlockProps;
/** A table row takes text properties only (fontFamily, fontSize, ...), which its cells inherit. */
export type TRProps = CommonProps & { style?: Style };
/**
 * Style of a table cell. `width` (points) fixes the width of the cell's column; columns without
 * one share the remaining width equally. Margins are not supported on cells.
 */
export type CellStyle = Style & { width?: number };
export type TDProps = CommonProps & {
  style?: CellStyle;
  /** Not supported yet: throws. */
  rowSpan?: number;
  /** Not supported yet: throws. */
  colSpan?: number;
};
export type THProps = TDProps & {
  /**
   * Which cells this header describes: `'Column'` (the cells below it) or `'Row'` (the cells to
   * its right). Default: `'Column'` when its whole row is header cells, `'Row'` when its row has
   * data cells (whatever its column).
   */
  scope?: 'Column' | 'Row';
};

/** Every artifact `/Type`, the source of `ArtifactType`. */
export const ARTIFACT_TYPES = ['Layout', 'Page', 'Pagination'] as const;
/** The `/Type` of an artifact: what kind of decoration it is. */
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export type ArtifactProps = {
  /**
   * What the decoration is: `'Layout'` (default) for ornaments, rules and other layout aids,
   * `'Pagination'` for page furniture such as running heads or page numbers, `'Page'` for
   * production aids such as cut marks.
   */
  type?: ArtifactType;
  /** Box properties (margin, border, padding, background) and text properties for its content. */
  style?: Style;
  children?: ReactNode;
};

export type SpanProps = {
  /**
   * Natural language of this run of text as a BCP 47 tag, e.g. `en-US`, when it differs from its
   * paragraph's (a foreign phrase), so screen readers switch pronunciation. Makes the span a `Span`
   * structure element with this `Lang`.
   */
  lang?: string;
  /** Overrides the inherited text style for this run of text, like CSS. */
  style?: InlineStyle;
  children?: ReactNode;
};

/** Root of every PDF. Maps to the `Document` structure element. */
export function Document(props: DocumentProps) {
  return createElement(HostType.Document, props);
}

/**
 * A page template: size and margins. Its content flows top to bottom onto as many
 * physical pages as it needs; each `<Page>` starts on a new page.
 */
export function Page(props: PageProps) {
  return createElement(HostType.Page, props);
}

/**
 * Starts the following content at the top of a new page. Allowed wherever a block is.
 * Adds nothing to the structure tree; ignored when the current page has no content yet.
 */
export function PageBreak(props: PageBreakProps = {}) {
  return createElement(HostType.PageBreak, props);
}

/** A group of related blocks, such as a heading and its paragraphs. Maps to the `Sect` structure element. */
export function Section(props: SectionProps) {
  return createElement(HostType.Section, props);
}

/** A paragraph of text. Maps to the `P` structure element. */
export function P(props: PProps) {
  return createElement(HostType.P, props);
}

/**
 * A bulleted or (with `ordered`) numbered list. Its only children are `<ListItem>`s; its items
 * are indented by its left padding (default 24 pt), where their bullets or numbers sit. Maps to
 * the `L` structure element.
 */
export function List(props: ListProps) {
  return createElement(HostType.List, props);
}

/**
 * One item of a `<List>`: text (with `<Span>` and `<Link>`) and blocks, including nested
 * `<List>`s. Maps to an `LI` structure element holding an `Lbl` (its generated bullet or number)
 * and an `LBody` (its content). Text directly inside it is content of the `LBody`.
 */
export function ListItem(props: ListItemProps) {
  return createElement(HostType.ListItem, props);
}

/**
 * A JPEG or PNG image, placed as a block wherever a block is allowed. With `alt` it is a `Figure`
 * structure element whose `Alt` is the text alternative and whose `BBox` is where it is drawn;
 * with `decorative` it is a Layout artifact, absent from the structure tree. Its size comes from
 * `style.width` and `style.height` (with only one, the other keeps the aspect ratio), else from
 * its pixels at one point per pixel. Without an explicit `style.width`, an image wider than the
 * content width is scaled down to fit it, keeping its aspect ratio; an explicit `style.width`
 * wider than the content width throws. It never splits across pages: one that does not fit the
 * rest of the page moves to the next.
 */
export function Image(props: ImageProps) {
  // createElement cannot take a union of props types; the host element only needs the props as given.
  return createElement(HostType.Image, props as ImageCommonProps);
}

/**
 * A simple data table: rows of header (`<TH>`) and data (`<TD>`) cells, one cell per row and
 * column. Its only children are `<TR>`s, all with the same number of cells. Columns share the
 * table's width equally unless a cell's `style.width` fixes its column's width. A long table
 * breaks between rows and continues on the next page; a row is never split, and one taller than
 * a page's content area throws `RTP_TABLE_ROW_TOO_TALL`. The first row is kept with the second,
 * so a header row is never left alone at the bottom of a page. Header rows are not repeated on
 * the following pages yet. Maps to one `Table` structure element however many pages it spans.
 * Reports `RTP_TABLE_NO_TH` when it has no `<TH>` (a warning, an error in strict mode): screen
 * readers need header cells to announce which row and column a cell belongs to.
 */
export function Table(props: TableProps) {
  return createElement(HostType.Table, props);
}

/** A table row of `<TH>` and `<TD>` cells. Maps to the `TR` structure element. */
export function TR(props: TRProps) {
  return createElement(HostType.TR, props);
}

/**
 * A header cell holding text (with `<Span>` and `<Link>`), bold by default. Maps to the `TH`
 * structure element with a `Scope` attribute (see `scope`).
 */
export function TH(props: THProps) {
  return createElement(HostType.TH, props);
}

/** A data cell holding text (with `<Span>` and `<Link>`). Maps to the `TD` structure element. */
export function TD(props: TDProps) {
  return createElement(HostType.TD, props);
}

/**
 * Decorative content that assistive technology should skip: blocks (text, borders, backgrounds)
 * that take their place in the flow and are painted, but are absent from the structure tree.
 * Headings inside it are not headings to a screen reader. It cannot contain `<Link>`.
 */
export function Artifact(props: ArtifactProps) {
  return createElement(HostType.Artifact, props);
}

/**
 * A run of text styled differently from the rest of its paragraph or heading: bold, italic,
 * another color, size, font or an underline. Without `lang` it adds no structure element and its
 * text belongs to the enclosing block; with `lang` it is a `Span` structure element in reading order.
 */
export function Span(props: SpanProps) {
  return createElement(HostType.Span, props);
}

export type LinkProps = {
  /**
   * An external URL whose scheme is `http:`, `https:`, `mailto:` or `tel:` (any case), e.g.
   * `https://example.com`, `mailto:team@example.com` or `tel:+34600000000`. Any other scheme
   * (`javascript:`, `file:`, `data:`, `ftp:`, …) throws; internal links and anchors are not supported yet.
   */
  href: string;
  /**
   * What assistive technology announces for the link (the annotation's `/Contents`).
   * Default: the link's visible text.
   */
  description?: string;
  /**
   * Overrides the inherited text style of the link text. Links are underlined by default so they
   * do not rely on color alone; `textDecoration: 'none'` turns that off. No link color is imposed.
   */
  style?: InlineStyle;
  children?: ReactNode;
};

/**
 * An inline hyperlink to an external URL, underlined by default. Maps to a `Link` structure
 * element that holds its text and a reference to one link annotation per line it occupies.
 */
export function Link(props: LinkProps) {
  return createElement(HostType.Link, props);
}

function heading(level: HeadingLevel) {
  const type = HostType[`H${level}`];
  const component = (props: HeadingProps) => createElement(type, props);
  return Object.defineProperty(component, 'name', { value: `H${level}` });
}

/** Level 1 heading. Maps to the `H1` structure element. Do not skip levels. */
export const H1 = heading(1);
/** Level 2 heading. Maps to the `H2` structure element. */
export const H2 = heading(2);
/** Level 3 heading. Maps to the `H3` structure element. */
export const H3 = heading(3);
/** Level 4 heading. Maps to the `H4` structure element. */
export const H4 = heading(4);
/** Level 5 heading. Maps to the `H5` structure element. */
export const H5 = heading(5);
/** Level 6 heading. Maps to the `H6` structure element. */
export const H6 = heading(6);

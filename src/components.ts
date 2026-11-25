import { createElement, type ReactNode } from 'react';
import { HEADING_KINDS, type HeadingKind, type HeadingLevel } from './headings.js';
import type { InlineStyle, Style } from './style.js';

export type { InlineStyle };

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
  Table: 'RTP_TABLE',
  TR: 'RTP_TR',
  TH: 'RTP_TH',
  TD: 'RTP_TD',
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

export type PageProps = CommonProps & {
  /** Paper size. Default `'A4'`. */
  size?: PageSize;
  /** Page margins in points. Default 72 on every side. */
  margin?: PageMargin;
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
   * its right). Default: `'Column'` when its whole row is header cells, `'Row'` when it is the
   * first cell of a row that has data cells, `'Column'` otherwise.
   */
  scope?: 'Column' | 'Row';
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
 * A simple data table: rows of header (`<TH>`) and data (`<TD>`) cells, one cell per row and
 * column. Its only children are `<TR>`s, all with the same number of cells. Columns share the
 * table's width equally unless a cell's `style.width` fixes its column's width. A table must fit
 * on one page (it moves to the next page whole when it does not fit on the current one). Maps to
 * the `Table` structure element. Warns when it has no `<TH>`: screen readers need header cells
 * to announce which row and column a cell belongs to.
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

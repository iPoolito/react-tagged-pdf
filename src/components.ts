import { createElement, type ReactNode } from 'react';
import { HEADING_KINDS, type HeadingKind, type HeadingLevel } from './headings.js';
import type { Style } from './style.js';

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

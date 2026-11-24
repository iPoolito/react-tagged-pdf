import { createElement, type ReactNode } from 'react';

/** Intrinsic host element names, private to the renderer. */
export const HostType = {
  Document: 'RTP_DOCUMENT',
  Page: 'RTP_PAGE',
  P: 'RTP_P',
} as const;
export type HostType = (typeof HostType)[keyof typeof HostType];

export type DocumentProps = {
  /** Document title. Required by PDF/UA: written to dc:title and shown in the viewer title bar. */
  title: string;
  /** Natural language of the document as a BCP 47 tag, e.g. `en-US`. Required by PDF/UA. */
  lang: string;
  children?: ReactNode;
};

export type PageProps = {
  children?: ReactNode;
};

export type PProps = {
  children?: ReactNode;
};

/** Root of every PDF. Maps to the `Document` structure element. */
export function Document(props: DocumentProps) {
  return createElement(HostType.Document, props);
}

/** A page (A4, 72 pt margins). Content flows top to bottom. */
export function Page(props: PageProps) {
  return createElement(HostType.Page, props);
}

/** A paragraph of text. Maps to the `P` structure element. */
export function P(props: PProps) {
  return createElement(HostType.P, props);
}

// The one table of heading kinds. Host types, structure tags, element defaults
// and error messages are derived from it.

export const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const;
export type HeadingLevel = (typeof HEADING_LEVELS)[number];
/** Structure tag of a heading, `H1`–`H6`. */
export type HeadingKind = `H${HeadingLevel}`;

export const HEADING_KINDS: readonly HeadingKind[] = HEADING_LEVELS.map((level) => `H${level}` as const);

/** Default font size in points of each heading level. */
export const HEADING_FONT_SIZE: Record<HeadingKind, number> = { H1: 24, H2: 20, H3: 16, H4: 14, H5: 12, H6: 12 };

export const headingLevel = (kind: HeadingKind): HeadingLevel => Number(kind.slice(1)) as HeadingLevel;

/** `<H1>–<H6>`, for error messages. */
export const HEADING_RANGE = `<${HEADING_KINDS[0]}>–<${HEADING_KINDS[HEADING_KINDS.length - 1]}>`;

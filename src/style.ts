// The `style` prop. Text properties inherit down the tree like CSS; all lengths are points.
import { ValidationError } from './diagnostics.js';
import { DEFAULT_FONT_FAMILY, type FontFace, type FontStyle, type FontWeight, resolveFont, weightNumber } from './fonts.js';
import { HEADING_FONT_SIZE, HEADING_KINDS, type HeadingKind } from './headings.js';
import { isPdfColor } from './pdf.js';

export type Style = {
  /** Inherited. A family registered with `Font.register`, or the bundled `"Noto Sans"` (default). */
  fontFamily?: string;
  /** Inherited. Points. Default 12. */
  fontSize?: number;
  /** Inherited. */
  fontWeight?: FontWeight;
  /** Inherited. */
  fontStyle?: FontStyle;
  /** Inherited. Any color PDFKit accepts: a CSS name (`'navy'`) or hex (`'#1a1a1a'`). Default black. */
  color?: string;
  /** Inherited. Height of each line box in points (not a multiplier). Default: the font's natural line height. */
  lineHeight?: number;
  /**
   * Inherited. `'underline'` draws a line under the text, placed and sized from the font's underline
   * metrics. Default `'none'`, except inside `<Link>`, which is underlined unless set to `'none'`.
   */
  textDecoration?: TextDecoration;

  /** Not inherited. Outer spacing on all four sides, in points; per-side properties override it. */
  margin?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  /** Not inherited. Inner spacing between the border and the content, in points; per-side properties override it. */
  padding?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  /** Not inherited. Border width in points on all four sides. Default 0 (no border). */
  borderWidth?: number;
  /** Not inherited. Default black. */
  borderColor?: string;
  /** Not inherited. Fills the border box. Default none. */
  backgroundColor?: string;
};

export type TextDecoration = 'underline' | 'none';

export type Sides = { top: number; right: number; bottom: number; left: number };
/** Resolved box properties of one block. Borders and backgrounds are painted as Layout artifacts. */
export type BoxStyle = {
  margin: Sides;
  padding: Sides;
  borderWidth: number;
  borderColor: string;
  backgroundColor?: string;
};

/** Fully resolved text style of a block or of one run of its text. */
export type TextStyle = {
  font: FontFace;
  fontSize: number;
  color: string;
  lineHeight?: number;
  textDecoration: TextDecoration;
};

/** Whether two resolved text styles look the same. Compares every `TextStyle` field. */
export const sameStyle = (a: TextStyle, b: TextStyle) =>
  a.font === b.font &&
  a.fontSize === b.fontSize &&
  a.color === b.color &&
  a.lineHeight === b.lineHeight &&
  a.textDecoration === b.textDecoration;

/** Inherited text properties before font resolution. */
export type InheritedText = {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: FontStyle;
  color: string;
  lineHeight?: number;
  textDecoration: TextDecoration;
};

export const ROOT_TEXT: InheritedText = {
  fontFamily: DEFAULT_FONT_FAMILY,
  fontSize: 12,
  fontWeight: 400,
  fontStyle: 'normal',
  color: 'black',
  textDecoration: 'none',
};

/** Built-in styles per element, applied under the author's `style` (like a browser's default stylesheet). */
const TEXT_BLOCK_DEFAULTS: Style = { marginBottom: 6 };
const LIST_INDENT = 24;
/** Space between a table cell's border and its text, in points. */
const CELL_PADDING = 4;
/** Elements with built-in styles. A nested list (inside a list item) has no margin, like in browsers. */
export type StyledKind = 'P' | HeadingKind | 'L' | 'nested L' | 'Table' | 'TH' | 'TD';
const ELEMENT_DEFAULTS: Record<StyledKind, Style> = {
  P: TEXT_BLOCK_DEFAULTS,
  Table: { marginBottom: 6 },
  TH: { padding: CELL_PADDING, fontWeight: 'bold' },
  TD: { padding: CELL_PADDING },
  L: { paddingLeft: LIST_INDENT, marginBottom: 6 },
  'nested L': { paddingLeft: LIST_INDENT },
  ...(Object.fromEntries(
    HEADING_KINDS.map((kind) => [kind, { ...TEXT_BLOCK_DEFAULTS, fontSize: HEADING_FONT_SIZE[kind], fontWeight: 'bold' }]),
  ) as Record<HeadingKind, Style>),
};

type Check = (value: unknown) => string | undefined;

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const length: Check = (v) => (isNumber(v) && v >= 0 ? undefined : 'must be a non-negative number of points');
const color: Check = (v) =>
  isPdfColor(v) ? undefined : "must be a CSS color name or hex color PDFKit accepts, e.g. 'navy' or '#1a1a1a'";

/** Every supported `style` key and what makes its value valid. Unknown keys are errors. */
const STYLE_CHECKS: Record<keyof Style, Check> = {
  fontFamily: (v) => (typeof v === 'string' && v.trim() !== '' ? undefined : 'must be a non-empty font family name'),
  fontSize: (v) => (isNumber(v) && v > 0 ? undefined : 'must be a number greater than 0 (points)'),
  fontWeight: (v) =>
    v === 'normal' || v === 'bold' || (isNumber(v) && v >= 100 && v <= 900 && v % 100 === 0)
      ? undefined
      : "must be 'normal', 'bold' or a multiple of 100 from 100 to 900",
  fontStyle: (v) => (v === 'normal' || v === 'italic' ? undefined : "must be 'normal' or 'italic'"),
  color,
  lineHeight: length,
  textDecoration: (v) => (v === 'underline' || v === 'none' ? undefined : "must be 'underline' or 'none'"),
  margin: length,
  marginTop: length,
  marginRight: length,
  marginBottom: length,
  marginLeft: length,
  padding: length,
  paddingTop: length,
  paddingRight: length,
  paddingBottom: length,
  paddingLeft: length,
  borderWidth: length,
  borderColor: color,
  backgroundColor: color,
};

/** Validate a raw `style` prop. `owner` names the component in error messages. */
export function parseStyle(raw: unknown, owner: string): Style {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ValidationError('RTP_INVALID_STYLE', `<${owner}> \`style\` must be an object.`);
  }
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    const check = Object.hasOwn(STYLE_CHECKS, key) ? STYLE_CHECKS[key as keyof Style] : undefined;
    if (!check) {
      throw new ValidationError(
        'RTP_UNKNOWN_STYLE_KEY',
        `<${owner}> \`style\` has unknown key ${JSON.stringify(key)}. Supported keys: ${Object.keys(STYLE_CHECKS).join(', ')}.`,
      );
    }
    const problem = check(value);
    if (problem) {
      throw new ValidationError(
        'RTP_INVALID_STYLE',
        `<${owner}> \`style.${key}\` ${problem}; got ${describeValue(value)}.`,
      );
    }
  }
  return raw as Style;
}

const INLINE_KEYS = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'color', 'textDecoration'] as const;

/**
 * Text properties an inline element may set. Box properties (margin, padding, border,
 * background) and lineHeight are block-only.
 */
export type InlineStyle = Pick<Style, (typeof INLINE_KEYS)[number]>;

/** Validate the `style` of an inline element: only text properties, which apply to its run of text. */
export function parseInlineStyle(raw: unknown, owner: string): InlineStyle {
  const style = parseStyle(raw, owner);
  for (const key of Object.keys(style)) {
    if (style[key as keyof Style] !== undefined && !(INLINE_KEYS as readonly string[]).includes(key)) {
      throw new ValidationError(
        'RTP_STYLE_NOT_SUPPORTED',
        `<${owner}> \`style.${key}\` is not supported on inline elements; use it on the enclosing block. ` +
          `Inline styles support ${INLINE_KEYS.join(', ')}.`,
      );
    }
  }
  return style;
}

const TEXT_KEYS = [...INLINE_KEYS, 'lineHeight'] as const;

/**
 * The `style` of an `<Image>`: its size and box properties (margin, padding, border, background).
 * `width` and `height` are the image's own size in points, inside any padding and border.
 */
export type ImageStyle = Omit<Style, (typeof TEXT_KEYS)[number]> & {
  /** Points. With only `width` or `height`, the other keeps the image's aspect ratio. Default: one point per pixel. */
  width?: number;
  height?: number;
};

/** Validate the `style` of an `<Image>`: size and box properties; text properties are refused. */
export function parseImageStyle(raw: unknown, owner: string): ImageStyle {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ValidationError('RTP_INVALID_STYLE', `<${owner}> \`style\` must be an object.`);
  }
  const { width, height, ...rest } = raw as Record<string, unknown>;
  for (const [key, value] of Object.entries({ width, height })) {
    if (value !== undefined && !(isNumber(value) && value > 0)) {
      throw new ValidationError(
        'RTP_INVALID_STYLE',
        `<${owner}> \`style.${key}\` must be a number of points greater than 0; got ${describeValue(value)}.`,
      );
    }
  }
  const box = parseStyle(rest, owner);
  for (const key of TEXT_KEYS) {
    if (box[key] !== undefined) {
      throw new ValidationError(
        'RTP_STYLE_NOT_SUPPORTED',
        `<${owner}> \`style.${key}\` is not supported on images; they take width, height and box properties ` +
          '(margin, padding, borderWidth, borderColor, backgroundColor).',
      );
    }
  }
  return raw as ImageStyle;
}

/** Validate the `style` of a table row: text properties only, which its cells inherit. */
export function parseRowStyle(raw: unknown): Style {
  const style = parseStyle(raw, 'TR');
  for (const key of Object.keys(style)) {
    if (style[key as keyof Style] !== undefined && !(TEXT_KEYS as readonly string[]).includes(key)) {
      throw new ValidationError(
        'RTP_STYLE_NOT_SUPPORTED',
        `<TR> \`style.${key}\` is not supported on table rows; set it on the <TH>/<TD> cells or the <Table>. ` +
          `Row styles support ${TEXT_KEYS.join(', ')}.`,
      );
    }
  }
  return style;
}

const MARGIN_KEYS = ['margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft'];

/**
 * Validate the `style` of a table cell: any block style except margins, plus `width` in points,
 * which fixes the width of the cell's column.
 */
export function parseCellStyle(raw: unknown, owner: 'TH' | 'TD'): Style & { width?: number } {
  const { width, ...rest } = (raw ?? {}) as Record<string, unknown>;
  if (raw !== undefined && raw !== null && (typeof raw !== 'object' || Array.isArray(raw))) {
    throw new ValidationError('RTP_INVALID_STYLE', `<${owner}> \`style\` must be an object.`);
  }
  if (width !== undefined && !(isNumber(width) && width > 0)) {
    throw new ValidationError(
      'RTP_INVALID_STYLE',
      `<${owner}> \`style.width\` must be a number of points greater than 0; got ${describeValue(width)}.`,
    );
  }
  const style = parseStyle(rest, owner);
  const margin = MARGIN_KEYS.find((key) => style[key as keyof Style] !== undefined);
  if (margin) {
    throw new ValidationError(
      'RTP_STYLE_NOT_SUPPORTED',
      `<${owner}> \`style.${margin}\` is not supported on table cells; use padding, or a margin on the <Table>.`,
    );
  }
  return width === undefined ? style : { ...style, width };
}

const describeValue = (v: unknown) => (typeof v === 'number' ? String(v) : JSON.stringify(v) ?? String(v));

export function inheritText(parent: InheritedText, own: Style, kind?: StyledKind): InheritedText {
  const merged = { ...(kind ? ELEMENT_DEFAULTS[kind] : undefined), ...own };
  return {
    fontFamily: merged.fontFamily ?? parent.fontFamily,
    fontSize: merged.fontSize ?? parent.fontSize,
    fontWeight: merged.fontWeight === undefined ? parent.fontWeight : weightNumber(merged.fontWeight),
    fontStyle: merged.fontStyle ?? parent.fontStyle,
    color: merged.color ?? parent.color,
    lineHeight: merged.lineHeight ?? parent.lineHeight,
    textDecoration: merged.textDecoration ?? parent.textDecoration,
  };
}

export const resolveText = (t: InheritedText): TextStyle => ({
  font: resolveFont(t.fontFamily, t.fontWeight, t.fontStyle),
  fontSize: t.fontSize,
  color: t.color,
  ...(t.lineHeight === undefined ? {} : { lineHeight: t.lineHeight }),
  textDecoration: t.textDecoration,
});

const sides = (all: number | undefined, top?: number, right?: number, bottom?: number, left?: number): Sides => ({
  top: top ?? all ?? 0,
  right: right ?? all ?? 0,
  bottom: bottom ?? all ?? 0,
  left: left ?? all ?? 0,
});

/** Box properties of one element: its own style over the element defaults, never inherited. */
export function resolveBox(own: Style, kind?: StyledKind): BoxStyle {
  const defaults = kind ? ELEMENT_DEFAULTS[kind] : undefined;
  // A shorthand in the author's style overrides the element's per-side defaults, as in CSS.
  const m = own.margin === undefined ? { ...defaults, ...own } : own;
  const p = own.padding === undefined ? { ...defaults, ...own } : own;
  return {
    margin: sides(m.margin, m.marginTop, m.marginRight, m.marginBottom, m.marginLeft),
    padding: sides(p.padding, p.paddingTop, p.paddingRight, p.paddingBottom, p.paddingLeft),
    borderWidth: own.borderWidth ?? 0,
    borderColor: own.borderColor ?? 'black',
    ...(own.backgroundColor === undefined ? {} : { backgroundColor: own.backgroundColor }),
  };
}

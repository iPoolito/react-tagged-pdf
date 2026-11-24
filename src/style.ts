// The `style` prop. Text properties inherit down the tree like CSS; all lengths are points.
import { DEFAULT_FONT_FAMILY, type FontFace, type FontStyle, type FontWeight, resolveFont, weightNumber } from './fonts.js';
import type { TextKind } from './model.js';

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

export type Sides = { top: number; right: number; bottom: number; left: number };
/** Resolved box properties of one block. Borders and backgrounds are painted as Layout artifacts. */
export type BoxStyle = {
  margin: Sides;
  padding: Sides;
  borderWidth: number;
  borderColor: string;
  backgroundColor?: string;
};

/** Fully resolved text style of one block. */
export type TextStyle = { font: FontFace; fontSize: number; color: string; lineHeight?: number };

/** Inherited text properties before font resolution. */
export type InheritedText = {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: FontStyle;
  color: string;
  lineHeight?: number;
};

export const ROOT_TEXT: InheritedText = {
  fontFamily: DEFAULT_FONT_FAMILY,
  fontSize: 12,
  fontWeight: 400,
  fontStyle: 'normal',
  color: 'black',
};

/** Built-in styles per element, applied under the author's `style` (like a browser's default stylesheet). */
const ELEMENT_DEFAULTS: Partial<Record<TextKind, Style>> = {
  P: { marginBottom: 6 },
  H1: { fontSize: 24, fontWeight: 'bold', marginBottom: 6 },
  H2: { fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  H3: { fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  H4: { fontSize: 14, fontWeight: 'bold', marginBottom: 6 },
  H5: { fontSize: 12, fontWeight: 'bold', marginBottom: 6 },
  H6: { fontSize: 12, fontWeight: 'bold', marginBottom: 6 },
};

/** Validate a raw `style` prop. `owner` names the component in error messages. */
export function parseStyle(raw: unknown, owner: string): Style {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`<${owner}> \`style\` must be an object.`);
  return raw as Style;
}

export function inheritText(parent: InheritedText, own: Style, kind?: TextKind): InheritedText {
  const merged = { ...(kind ? ELEMENT_DEFAULTS[kind] : undefined), ...own };
  return {
    fontFamily: merged.fontFamily ?? parent.fontFamily,
    fontSize: merged.fontSize ?? parent.fontSize,
    fontWeight: merged.fontWeight === undefined ? parent.fontWeight : weightNumber(merged.fontWeight),
    fontStyle: merged.fontStyle ?? parent.fontStyle,
    color: merged.color ?? parent.color,
    lineHeight: merged.lineHeight ?? parent.lineHeight,
  };
}

export const resolveText = (t: InheritedText): TextStyle => ({
  font: resolveFont(t.fontFamily, t.fontWeight, t.fontStyle),
  fontSize: t.fontSize,
  color: t.color,
  ...(t.lineHeight === undefined ? {} : { lineHeight: t.lineHeight }),
});

const sides = (all: number | undefined, top?: number, right?: number, bottom?: number, left?: number): Sides => ({
  top: top ?? all ?? 0,
  right: right ?? all ?? 0,
  bottom: bottom ?? all ?? 0,
  left: left ?? all ?? 0,
});

/** Box properties of one element: its own style over the element defaults, never inherited. */
export function resolveBox(own: Style, kind?: TextKind): BoxStyle {
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

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
};

/** Fully resolved text style of one block. */
export type TextStyle = { font: FontFace; fontSize: number };

/** Inherited text properties before font resolution. */
export type InheritedText = { fontFamily: string; fontSize: number; fontWeight: number; fontStyle: FontStyle };

export const ROOT_TEXT: InheritedText = {
  fontFamily: DEFAULT_FONT_FAMILY,
  fontSize: 12,
  fontWeight: 400,
  fontStyle: 'normal',
};

/** Built-in styles per element, applied under the author's `style` (like a browser's default stylesheet). */
const ELEMENT_DEFAULTS: Partial<Record<TextKind, Style>> = {
  H1: { fontSize: 24, fontWeight: 'bold' },
  H2: { fontSize: 20, fontWeight: 'bold' },
  H3: { fontSize: 16, fontWeight: 'bold' },
  H4: { fontSize: 14, fontWeight: 'bold' },
  H5: { fontSize: 12, fontWeight: 'bold' },
  H6: { fontSize: 12, fontWeight: 'bold' },
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
  };
}

export const resolveText = (t: InheritedText): TextStyle => ({
  font: resolveFont(t.fontFamily, t.fontWeight, t.fontStyle),
  fontSize: t.fontSize,
});

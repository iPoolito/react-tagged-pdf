// Font registry. Every font that reaches the PDF is a TrueType/OpenType file
// embedded (subset) by PDFKit: PDF/UA-1 forbids unembedded fonts, so the
// standard-14 fonts PDFKit would otherwise fall back to are rejected here.
import { fileURLToPath } from 'node:url';

export type FontWeight = 'normal' | 'bold' | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
export type FontStyle = 'normal' | 'italic';

export type FontSource = {
  /** Family name used in `style.fontFamily`. Matched case-insensitively, like CSS. */
  family: string;
  /** Path to a TTF/OTF file, or its bytes. */
  src: string | Uint8Array;
  /** Default `'normal'` (400). */
  weight?: FontWeight;
  /** Default `'normal'`. */
  style?: FontStyle;
};

/** One registered face. `id` is the name it is registered under in PDFKit. */
export type FontFace = { id: string; family: string; weight: number; style: FontStyle; src: string | Uint8Array };

/** Family of the bundled Noto Sans faces, used when no `fontFamily` is set. */
export const DEFAULT_FONT_FAMILY = 'Noto Sans';

const families = new Map<string, FontFace[]>();
let nextId = 0;

export const weightNumber = (w: FontWeight | undefined): number =>
  w === undefined || w === 'normal' ? 400 : w === 'bold' ? 700 : w;

function register({ family, src, weight, style = 'normal' }: FontSource): void {
  if (typeof family !== 'string' || family.trim() === '') {
    throw new Error('Font.register requires a non-empty `family`.');
  }
  if (typeof src !== 'string' && !(src instanceof Uint8Array)) {
    throw new Error(`Font.register({ family: ${JSON.stringify(family)} }) requires \`src\`: a file path or the font bytes.`);
  }
  const key = family.trim().toLowerCase();
  const face: FontFace = { id: `rtp-font-${nextId++}`, family, weight: weightNumber(weight), style, src };
  // Registering the same family/weight/style again replaces the earlier face.
  const faces = (families.get(key) ?? []).filter((f) => f.weight !== face.weight || f.style !== face.style);
  families.set(key, [...faces, face]);
}

/** Register a TrueType/OpenType font for use with `style.fontFamily`. Registered fonts are subset and embedded. */
export const Font = { register };

const STANDARD_14 = /^(courier|helvetica|times|times-roman|symbol|zapfdingbats)(-(bold|oblique|boldoblique|italic|bolditalic))?$/i;

/** The registered face that best matches, following CSS: same style first, then the closest weight. */
export function resolveFont(family: string, weight: number, style: FontStyle): FontFace {
  const faces = families.get(family.trim().toLowerCase());
  if (!faces) {
    if (STANDARD_14.test(family.trim())) {
      throw new Error(
        `"${family}" is a PDF standard-14 font, which is not embedded; PDF/UA requires every font to be embedded. ` +
          `Register a TTF/OTF file with Font.register({ family: "${family}", src }) or use the bundled "${DEFAULT_FONT_FAMILY}".`,
      );
    }
    throw new Error(`Font family "${family}" is not registered. Register it with Font.register({ family: "${family}", src }).`);
  }
  const sameStyle = faces.filter((f) => f.style === style);
  const candidates = sameStyle.length > 0 ? sameStyle : faces;
  return candidates.reduce((best, f) => (Math.abs(f.weight - weight) < Math.abs(best.weight - weight) ? f : best));
}

const bundled = (file: string) => fileURLToPath(new URL(`../fonts/${file}`, import.meta.url));
register({ family: DEFAULT_FONT_FAMILY, src: bundled('NotoSans-Regular.ttf') });
register({ family: DEFAULT_FONT_FAMILY, src: bundled('NotoSans-Bold.ttf'), weight: 'bold' });
register({ family: DEFAULT_FONT_FAMILY, src: bundled('NotoSans-Italic.ttf'), style: 'italic' });
register({ family: DEFAULT_FONT_FAMILY, src: bundled('NotoSans-BoldItalic.ttf'), weight: 'bold', style: 'italic' });

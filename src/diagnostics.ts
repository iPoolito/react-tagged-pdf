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

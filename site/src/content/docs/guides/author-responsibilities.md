---
title: Author responsibilities
description: What react-tagged-pdf and validators handle, and what only you can get right.
---

react-tagged-pdf writes the structure PDF/UA-1 asks for, and veraPDF checks that the result is technically well
formed. Neither knows what your document means. These parts are yours.

## Meaningful alt text

Every `<Image>` needs `alt` or `decorative`, and the library enforces that much. It cannot tell whether the alt
text is any good.

- Say what the image conveys in this document, not what it looks like: "Bar chart: sales rose in each of the
  four quarters" rather than "chart.png" or "A chart".
- For a chart or diagram whose details matter, put the data in the text or a table and keep the alt short.
- Use `decorative` only for images that add no information (rules, flourishes, background textures). A logo
  that identifies the publisher is usually not decorative.
- If the alt text is in another language from its surroundings, set the image's `lang`.

An empty `alt=""` is drawn as decoration and reported as `RTP_IMAGE_EMPTY_ALT`; in strict mode it is an error.

## Reading order intent

The structure tree follows the order of your JSX. That is the order a screen reader reads.

- Write components in the order the content should be read, not the order that is convenient to lay out.
- Use headings for structure, starting at `<H1>` and without skipping levels (`RTP_HEADING_FIRST_NOT_H1`,
  `RTP_HEADING_SKIP`). Don't pick a heading level for its font size: use `style` for that.
- Group related content with `<Section>`.
- Running headers, footers and `<Artifact>` content are skipped by screen readers. Don't put information there
  that isn't also in the body.
- Link text should make sense on its own ("full methodology", not "click here"). When it can't, give the link a
  `description`.

## Table scope correctness

`<TH>` cells get a `Scope` automatically: `Column` when the whole row is header cells, `Row` when the `TH` is the
first cell of a row that has data cells. That guess is right for simple tables, but only you know what each
header describes.

- Use `<TH>` for every header cell and `<TD>` for data. A table without any `<TH>` is reported as
  `RTP_TABLE_NO_TH`.
- Set `scope` explicitly when the guess is wrong, for example a row header that is not the first cell of its
  row (after a row-number `<TD>`), which would otherwise get `Column`.
- Prefer several simple tables over one complex one. Merged cells (`rowSpan`, `colSpan`) are not supported yet.
- Don't use tables for layout.
- Header rows are not repeated when a long table continues on the next page yet.

## Also yours

- The document `title` and `lang`, and `lang` on every passage in another language.
- Colour contrast, text size, and not conveying meaning by colour alone.
- Fonts that cover every character you use: the bundled Noto Sans covers Latin, Greek and Cyrillic; register a
  font for other scripts.

## Test with people

Passing veraPDF's PDF/UA-1 checks is not a claim that a document is accessible or complies with any law or
guideline. Read the document with a screen reader and, where it matters, have people with disabilities review
it. [Validating your PDFs](../validation/) lists what the checkers can and can't see.

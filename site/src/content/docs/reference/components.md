---
title: Components
description: Every react-tagged-pdf v0.1 component, its props and the PDF structure element it produces.
---

Every component is imported from `react-tagged-pdf`. All lengths are in points (1/72 inch).

| Component | Structure element | |
|---|---|---|
| [`Document`](#document) | `Document` | Root of every PDF. |
| [`Page`](#page) | | Page template: size, margins, header, footer. |
| [`PageBreak`](#pagebreak) | | Starts a new page. |
| [`Section`](#section) | `Sect` | Group of related blocks. |
| [`H1`–`H6`](#h1h6) | `H1`–`H6` | Headings. |
| [`P`](#p) | `P` | Paragraph. |
| [`Span`](#span) | `Span` with `lang`, else none | Styled run of text. |
| [`Link`](#link) | `Link` | External hyperlink. |
| [`List`, `ListItem`](#list-and-listitem) | `L` > `LI` > `Lbl` + `LBody` | Bulleted or numbered list. |
| [`Image`](#image) | `Figure`, or none when decorative | JPEG or PNG. |
| [`Table`, `TR`, `TH`, `TD`](#table-tr-th-td) | `Table` > `TR` > `TH`/`TD` | Simple data table. |
| [`Artifact`](#artifact) | none | Decorative content screen readers skip. |

## Common props

- `lang`: natural language of the element's content as a BCP 47 tag (`es-ES`), written as its `Lang`. Accepted
  by every component below `Document`.
- `style`: on block components. Text properties (`fontFamily`, `fontSize`, `fontWeight`, `fontStyle`,
  `color`, `lineHeight`, `textDecoration`) inherit to descendants like CSS. Box properties (`margin*`,
  `padding*`, `borderWidth`, `borderColor`, `backgroundColor`) do not.

## Document

The root of every PDF. Maps to the `Document` structure element.

| Prop | Type | |
|---|---|---|
| `title` | `string` | Required. Written to the metadata and shown in the viewer's title bar. |
| `lang` | `string` | Required. Document language, e.g. `en-US`. |

## Page

A page template. Its content flows onto as many physical pages as it needs; each `<Page>` starts on a new page.

| Prop | Type | |
|---|---|---|
| `size` | `'A3' \| 'A4' \| 'A5' \| 'Letter' \| 'Legal' \| [width, height]` | Default `'A4'`. |
| `margin` | `number \| { top?, right?, bottom?, left? }` | Default 72 on every side. |
| `header` | `({ pageNumber, totalPages }) => ReactNode` | Running header in the top margin, drawn as a pagination artifact. |
| `footer` | `({ pageNumber, totalPages }) => ReactNode` | Running footer in the bottom margin, drawn as a pagination artifact. |

Headers and footers are laid out after the content, so `totalPages` is final. They can't contain `<Link>` and
must fit in their margin. Screen readers skip them.

## PageBreak

`<PageBreak />` starts the following content at the top of a new page. It takes no props, adds nothing to the
structure tree and is ignored when the current page is still empty.

## Section

A group of related blocks, such as a heading and its paragraphs. Maps to `Sect`. Takes `lang` and `style`.

## H1–H6

Headings, mapped to `H1`–`H6`. Start at `H1` and don't skip levels going down: a skipped level fails PDF/UA-1.
Rendering reports `RTP_HEADING_FIRST_NOT_H1` and `RTP_HEADING_SKIP`. Take `lang` and `style`.

## P

A paragraph, mapped to `P`. A paragraph split by a page break is still one `P`. Takes `lang` and `style`.

## Span

A run of text styled differently from its paragraph or heading.

| Prop | Type | |
|---|---|---|
| `lang` | `string` | A language change for this run. Makes it a `Span` structure element with that `Lang`; without it no element is added. |
| `style` | inline style | `fontFamily`, `fontSize`, `fontWeight`, `fontStyle`, `color`, `textDecoration`. |

## Link

An inline hyperlink, underlined by default so it doesn't rely on colour alone. Maps to a `Link` element that
holds its text and one link annotation per line it occupies.

| Prop | Type | |
|---|---|---|
| `href` | `string` | Required. `http:`, `https:`, `mailto:` or `tel:`; any other scheme throws. Internal links are not supported yet. |
| `description` | `string` | What assistive technology announces (the annotation's `/Contents`). Default: the link text. |
| `style` | inline style | `textDecoration: 'none'` removes the underline. |

## List and ListItem

`List` maps to `L`; its only children are `ListItem`s. Each `ListItem` maps to an `LI` holding an `Lbl` (the
generated bullet or number) and an `LBody` (its content: text, `Span`, `Link`, blocks and nested lists).

| Prop | On | Type | |
|---|---|---|---|
| `ordered` | `List` | `boolean` | Numbered `1.`, `2.`, … when true; bulleted by default. |

Items are indented by the list's left padding (default 24). A long list flows onto the next page.

## Image

A JPEG or PNG placed as a block. Give exactly one of `alt` or `decorative`.

| Prop | Type | |
|---|---|---|
| `src` | `string \| Uint8Array` | File path or file contents. |
| `alt` | `string` | Text alternative. The image becomes a `Figure` with this `Alt`. |
| `decorative` | `true` | The image is a layout artifact, absent from the structure tree. |
| `lang` | `string` | Language of the `alt` text when it differs from its surroundings. |
| `style` | image style | `width`, `height` (one alone keeps the aspect ratio) and box properties. |

Without a size, an image is one point per pixel. Without a `width`, an image wider than the content width is
scaled down to fit it, keeping its aspect ratio; an explicit `width` wider than the content width throws
`RTP_IMAGE_TOO_WIDE`. It never splits across
pages. An empty `alt` is drawn as decoration and reported as `RTP_IMAGE_EMPTY_ALT`.

## Table, TR, TH, TD

A simple data table: `Table` > `TR` > `TH`/`TD`, the same number of cells in every row. Cells hold text,
`Span` and `Link`.

| Prop | On | Type | |
|---|---|---|---|
| `scope` | `TH` | `'Column' \| 'Row'` | What the header describes. Default: `Column` when the whole row is header cells, `Row` when it is the first cell of a row with data cells, `Column` otherwise. |
| `style.width` | `TH`, `TD` | `number` | Fixes the width of the cell's column; other columns share the rest equally. |
| `style` | `TR` | text style | Text properties its cells inherit. |
| `rowSpan`, `colSpan` | `TH`, `TD` | `number` | Not supported yet: throws. |

`TH` is bold by default. A table without `TH` cells renders but is reported as `RTP_TABLE_NO_TH`. A long table
breaks between rows across pages and stays one `Table`; header rows are not repeated on the following pages yet.

## Artifact

Decorative blocks that are painted but absent from the structure tree, so screen readers skip them. Headings
inside it are not headings to a screen reader, and it can't contain `<Link>`.

| Prop | Type | |
|---|---|---|
| `type` | `'Layout' \| 'Pagination' \| 'Page'` | Default `'Layout'` (ornaments, rules); `'Pagination'` for page furniture; `'Page'` for production aids such as cut marks. |
| `style` | style | Box and text properties. |

## Font.register

```ts
Font.register({ family: 'Noto Serif', src: 'fonts/NotoSerif-Bold.ttf', weight: 'bold', style: 'normal' });
```

Registers a TrueType/OpenType font (path or bytes) for `style.fontFamily`. Family names match
case-insensitively; a style picks the closest registered face by weight and style. Fonts are always subset and
embedded, as PDF/UA-1 requires. The bundled default is Noto Sans (Latin, Greek, Cyrillic).

## renderToFile and renderToBuffer

```ts
renderToFile(element: ReactNode, path: string, options?: RenderOptions): Promise<void>
renderToBuffer(element: ReactNode, options?: RenderOptions): Promise<Buffer>
```

`options.strict: true` turns accessibility warnings into an `AccessibilityError` whose `diagnostics` list every
problem (and whose `code` is the first one's). Each problem is a `Diagnostic` with a stable `code`, the component `path` (e.g. `Document > Page[1] > Section > H3`)
and a `message`:

| Code | Problem |
|---|---|
| `RTP_HEADING_FIRST_NOT_H1` | The first heading is not an `H1`. |
| `RTP_HEADING_SKIP` | A heading skips a level going down, e.g. `H1` then `H3`. |
| `RTP_TABLE_NO_TH` | A `Table` has no `TH` cells. |
| `RTP_IMAGE_EMPTY_ALT` | An `Image` has an empty `alt`, so it is drawn as decoration. |

### Validation errors

Input that cannot be rendered at all always throws a `ValidationError`, strict mode or not, from
`renderToBuffer`/`renderToFile` and `Font.register`. It has a stable `code`, the component `path` where known
(e.g. `Document > Page[1] > Table > TR > TD`; layout problems point at the `Page`, and `Font.register` has none)
and a `message` that ends with `(at <path>)`. Match on `err.code`, not the message:

```ts
if (err instanceof ValidationError && err.code === 'RTP_IMAGE_NO_ALT') console.error(err.path);
```

| Code | Problem |
|---|---|
| `RTP_ROOT_NOT_DOCUMENT` | The rendered element is not a single `Document`. |
| `RTP_DOCUMENT_NO_TITLE` | `Document` has no `title`. |
| `RTP_DOCUMENT_NO_LANG` | `Document` has no `lang`. |
| `RTP_DOCUMENT_NO_PAGES` | `Document` has no `Page`. |
| `RTP_PAGE_INVALID_SIZE` | `Page` `size` is not a known name or `[width, height]`. |
| `RTP_PAGE_INVALID_MARGIN` | `Page` `margin` is not a non-negative number or `{ top, right, bottom, left }`. |
| `RTP_PAGE_NO_CONTENT_AREA` | `Page` margins leave no room for content. |
| `RTP_INVALID_CHILD` | A component is where it is not allowed: wrong parent or child, or children where none are taken. |
| `RTP_INVALID_PROP` | A prop has the wrong type or a value outside its allowed values. |
| `RTP_INVALID_LANG` | A `lang` prop is not a non-empty language tag. |
| `RTP_LINK_IN_ARTIFACT` | A `Link` in an `Artifact` or a running header/footer, where it could not be reached. |
| `RTP_IMAGE_NO_SRC` | `Image` has no `src`. |
| `RTP_IMAGE_NO_ALT` | `Image` has neither `alt` nor `decorative`. |
| `RTP_IMAGE_ALT_AND_DECORATIVE` | `Image` has both `alt` and `decorative`. |
| `RTP_IMAGE_UNREADABLE` | The image file or bytes are not a readable JPEG or PNG. |
| `RTP_IMAGE_TOO_WIDE` | The image's explicit `style.width` is wider than the content width it is in. |
| `RTP_IMAGE_TOO_TALL` | The image is taller than a page's content area. |
| `RTP_LIST_ITEM_EMPTY` | `ListItem` has no content. |
| `RTP_TABLE_ROW_EMPTY` | `TR` has no cells. |
| `RTP_TABLE_RAGGED_ROWS` | The rows of a `Table` have different numbers of cells. |
| `RTP_TABLE_SPAN_UNSUPPORTED` | A cell has `rowSpan` or `colSpan` other than 1. |
| `RTP_TABLE_COLUMN_WIDTH_CONFLICT` | Cells of one column set different `style.width`s. |
| `RTP_TABLE_TOO_WIDE` | Column widths leave no room in the table's content width. |
| `RTP_TABLE_ROW_TOO_TALL` | A table row is taller than a page's content area. |
| `RTP_LINK_NO_HREF` | `Link` has no `href`. |
| `RTP_LINK_HREF_UNSUPPORTED` | `href` is not an external URL with a scheme (internal links are not supported yet). |
| `RTP_LINK_SCHEME_NOT_ALLOWED` | `href` uses a scheme other than http, https, mailto or tel. |
| `RTP_LINK_NO_TEXT` | `Link` has no visible text. |
| `RTP_INVALID_STYLE` | `style` is not an object, or a style value is invalid. |
| `RTP_UNKNOWN_STYLE_KEY` | `style` has a key the library does not know. |
| `RTP_STYLE_NOT_SUPPORTED` | A known style key this component does not take, e.g. a margin on a table cell. |
| `RTP_NO_CONTENT_WIDTH` | Margin, border and padding leave a box or cell no width for content. |
| `RTP_LINE_TOO_TALL` | One line of text is taller than a page's content area. |
| `RTP_RUNNING_CONTENT_TOO_TALL` | A running header or footer does not fit in half its page margin. |
| `RTP_FONT_NO_FAMILY` | `Font.register` without a `family`. |
| `RTP_FONT_NO_SRC` | `Font.register` without a `src`. |
| `RTP_FONT_UNREADABLE` | The `Font.register` `src` path is not a readable file. |
| `RTP_FONT_NOT_REGISTERED` | `style.fontFamily` names a family that is not registered. |
| `RTP_FONT_NOT_EMBEDDED` | `style.fontFamily` names a PDF standard-14 font, which is not embedded. |
| `RTP_STATE_UPDATE` | A component updated state after the first render; documents render once. |

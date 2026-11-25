---
title: Getting started
description: Install react-tagged-pdf and render a tagged PDF from React in Node.
---

## Install

```bash
npm install react-tagged-pdf react@^19
npm install --save-dev tsx
npm pkg set type=module
echo '{ "compilerOptions": { "jsx": "react-jsx" } }' > tsconfig.json
```

Requirements: Node.js 20.19 or later, React 19 (`^19.0.0`, peer dependency). React 18 is not supported. The package is ESM only.

## Render a PDF

Save as `report.tsx`:

```tsx
import { Document, H1, H2, Link, List, ListItem, P, Page, Table, TD, TH, TR, renderToFile } from 'react-tagged-pdf';

await renderToFile(
  <Document title="Quarterly report" lang="en-US">
    <Page>
      <H1>Quarterly report</H1>
      <P>
        Sales grew this quarter. Read the <Link href="https://example.com/methodology">full methodology</Link> for
        details.
      </P>
      <H2>Highlights</H2>
      <List>
        <ListItem>Sales rose in every quarter.</ListItem>
        <ListItem>Two new regions opened.</ListItem>
      </List>
      <H2>Sales by region</H2>
      <Table>
        <TR>
          <TH>Region</TH>
          <TH>Sales</TH>
        </TR>
        <TR>
          <TD>North</TD>
          <TD>120</TD>
        </TR>
      </Table>
    </Page>
  </Document>,
  'report.pdf',
);
```

```bash
npx tsx report.tsx   # writes report.pdf
```

The example uses top-level `await`, hence `"type": "module"`. `renderToBuffer(element)` returns the PDF as a
`Buffer` instead of writing a file.

## Images

Every image needs either alt text or an explicit `decorative` flag:

```tsx
<Image src="chart.png" alt="Bar chart: sales rose in each of the four quarters." />
<Image src="divider.jpg" decorative />
```

## Warnings and strict mode

Problems the library can detect, such as a skipped heading level, a table without `TH` cells or an image with
an empty `alt`, are printed as warnings with a stable code and the component's path. Pass `{ strict: true }`
to `renderToBuffer`/`renderToFile` to reject with an `AccessibilityError` instead, which is useful in CI:

```tsx
await renderToFile(<Report />, 'report.pdf', { strict: true });
```

## Next

- [Validate the PDF](../guides/validation/) with veraPDF and PAC.
- Read [what you're still responsible for](../guides/author-responsibilities/).
- Browse the [examples](../examples/hello/) and the [component reference](../reference/components/).

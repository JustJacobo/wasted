import { convert } from "html-to-text";

const MAX_HTML_CHARS = 300_000;

/**
 * HTML → texto separando las celdas de las tablas (los correos de bancos y
 * apps son tablas; sin esto "Total" y "COP 7,901" quedan pegados a lo anterior).
 */
export function htmlText(html: string): string {
  // Los correos útiles pesan unos KB; un HTML gigante no vale el costo de convertirlo.
  return convert(html.slice(0, MAX_HTML_CHARS).replace(/<\/(td|th)>/gi, " </$1>"), {
    wordwrap: false,
    selectors: [
      { selector: "a", options: { ignoreHref: true } },
      { selector: "img", format: "skip" },
      { selector: "h1", options: { uppercase: false } },
      { selector: "h2", options: { uppercase: false } },
      { selector: "h3", options: { uppercase: false } },
      { selector: "h4", options: { uppercase: false } },
      { selector: "h5", options: { uppercase: false } },
      { selector: "h6", options: { uppercase: false } },
      { selector: "table", format: "block" },
      { selector: "tr", format: "block" },
    ],
  });
}

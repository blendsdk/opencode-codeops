/**
 * Griffel renderer factory for the Discovery app.
 *
 * The server injects a CSP nonce into the HTML, and every style element that
 * Griffel creates must carry it. The document is a parameter so this factory
 * stays usable from a Node test without a DOM.
 *
 * @module renderer
 */

import { createDOMRenderer } from "@griffel/react"

/**
 * Create the DOM renderer for one document.
 *
 * @param nonce - The per-request CSP nonce from the page's meta tag.
 * @param targetDocument - The document to insert styles into; defaults to the
 *   global document when the renderer is first used in a browser.
 * @returns A Griffel renderer whose style elements carry the nonce.
 */
export function createAppRenderer(nonce: string, targetDocument?: Document) {
  return createDOMRenderer(targetDocument, {
    styleElementAttributes: { nonce },
  })
}

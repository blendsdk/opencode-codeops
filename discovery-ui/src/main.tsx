/**
 * Browser entry point.
 *
 * Reads the CSP nonce, creates the Griffel renderer, and mounts the app inside
 * the renderer and Fluent providers. Everything else lives in pure modules so
 * the server-side render test can reuse it.
 *
 * @module main
 */

import { useMemo } from "react"
import { createRoot } from "react-dom/client"
import { RendererProvider } from "@griffel/react"
import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components"

import { App } from "./app.tsx"
import { createApi } from "./api.ts"
import { useHashRoute, useThemePreference } from "./hooks.ts"
import { createAppRenderer } from "./renderer.ts"
import { parseRoute } from "./route.ts"

/** The mounted application. */
function Root() {
  const { hash } = useHashRoute()
  const theme = useThemePreference()
  const api = useMemo(() => createApi(window.location.origin), [])
  return (
    <FluentProvider theme={theme.resolved === "dark" ? webDarkTheme : webLightTheme}>
      <App route={parseRoute(hash)} api={api} />
    </FluentProvider>
  )
}

const nonce =
  document.querySelector('meta[name="csp-nonce"]')?.getAttribute("content") ?? ""
const renderer = createAppRenderer(nonce, document)
const container = document.getElementById("root")
if (container !== null) {
  createRoot(container).render(
    <RendererProvider renderer={renderer}>
      <Root />
    </RendererProvider>,
  )
}

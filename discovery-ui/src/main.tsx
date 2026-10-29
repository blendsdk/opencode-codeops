/**
 * Browser entry point.
 *
 * Reads the CSP nonce, creates the Griffel renderer, and mounts the app inside
 * the renderer and Fluent providers. The root owns the theme preference, the
 * narrow-screen navigation state, and the header identity so the App itself
 * stays usable without a browser.
 *
 * @module main
 */

import { useCallback, useMemo, useState } from "react"
import { createRoot } from "react-dom/client"
import { RendererProvider } from "@griffel/react"
import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components"

import { App } from "./app.tsx"
import type { AppShell } from "./app.tsx"
import type { HeaderIdentity } from "./views/DiscoveryHeader.tsx"
import { createApi } from "./api.ts"
import { useHashRoute, useThemePreference } from "./hooks.ts"
import { createAppRenderer } from "./renderer.ts"
import { parseRoute } from "./route.ts"

/** The mounted application. */
function Root() {
  const { hash, navigate } = useHashRoute()
  const theme = useThemePreference()
  const api = useMemo(() => createApi(window.location.origin), [])
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [identity, setIdentityState] = useState<HeaderIdentity>({
    projectName: null,
    planTitle: null,
  })
  const setIdentity = useCallback((next: HeaderIdentity) => {
    setIdentityState((current) =>
      current.projectName === next.projectName && current.planTitle === next.planTitle
        ? current
        : next,
    )
  }, [])
  const shell: AppShell = {
    preference: theme.preference,
    setPreference: theme.setPreference,
    navigationOpen,
    setNavigationOpen,
    identity,
    setIdentity,
  }
  return (
    <FluentProvider theme={theme.resolved === "dark" ? webDarkTheme : webLightTheme}>
      <App route={parseRoute(hash)} api={api} shell={shell} navigate={navigate} />
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

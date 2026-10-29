/**
 * The shared Discovery header.
 *
 * It carries the product identity, the real breadcrumb, the three-choice
 * theme control, and the narrow-screen navigation trigger. The header is
 * present on every route; the trigger appears only while a plan is open.
 *
 * @module views/DiscoveryHeader
 */

import {
  Button,
  Radio,
  RadioGroup,
  Text,
} from "@fluentui/react-components"
import { NavigationRegular } from "@fluentui/react-icons"

import { useWorkspaceStyles } from "./workspace-styles.ts"
import type { Route } from "../route.ts"
import type { ThemePreference } from "../theme.ts"

/** The loaded project and plan names shown instead of route slugs. */
export interface HeaderIdentity {
  projectName: string | null
  planTitle: string | null
}

/** Props for {@link DiscoveryHeader}. */
export interface DiscoveryHeaderProps {
  route: Route
  identity: HeaderIdentity
  preference: ThemePreference
  onPreference: (preference: ThemePreference) => void
  navigationOpen: boolean
  onToggleNavigation: () => void
  showNavigationTrigger: boolean
}

/** Render the shared header. */
export function DiscoveryHeader({
  route,
  identity,
  preference,
  onPreference,
  navigationOpen,
  onToggleNavigation,
  showNavigationTrigger,
}: DiscoveryHeaderProps) {
  const styles = useWorkspaceStyles()
  const projectSlug = route.view === "project" || route.view === "plan" ? route.project : null
  const projectName = identity.projectName ?? projectSlug
  const planTitle =
    identity.planTitle ?? (route.view === "plan" ? route.plan : null)

  return (
    <header className={styles.header}>
      <a
        className={styles.skipLink}
        href="#main-content"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById("main-content")?.focus()
        }}
      >
        Skip to content
      </a>
      <div className={styles.headerInner}>
        <a className={styles.brand} href="#/">
          Discovery
        </a>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <a
            className={styles.breadcrumbLink}
            href="#/"
            aria-current={route.view === "projects" ? "page" : undefined}
          >
            Projects
          </a>
          {projectName !== null ? <span aria-hidden="true">›</span> : null}
          {projectName !== null ? (
            <a
              className={styles.breadcrumbLink}
              href={`#/p/${projectSlug}`}
              aria-current={planTitle === null ? "page" : undefined}
            >
              {projectName}
            </a>
          ) : null}
          {planTitle !== null ? <span aria-hidden="true">›</span> : null}
          {planTitle !== null ? (
            <span className={styles.breadcrumbCurrent} aria-current="page">
              {planTitle}
            </span>
          ) : null}
        </nav>
        <div className={styles.headerActions}>
          <RadioGroup
            aria-label="Theme"
            layout="horizontal"
            value={preference}
            onChange={(_, data) => onPreference(data.value as ThemePreference)}
          >
            <Radio value="system" label="System" />
            <Radio value="light" label="Light" />
            <Radio value="dark" label="Dark" />
          </RadioGroup>
          {showNavigationTrigger ? (
            <Button
              id="plan-navigation-trigger"
              className={styles.navTrigger}
              appearance="subtle"
              icon={<NavigationRegular />}
              aria-expanded={navigationOpen}
              onClick={onToggleNavigation}
            >
              <Text size={200}>Groups</Text>
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  )
}

/**
 * Shared Griffel styles for the Discovery workspace.
 *
 * The layout uses design tokens so light and dark themes, focus rings, and
 * contrast come from the Fluent theme rather than hard-coded colours. Media
 * queries keep the desktop rail, the desktop navigation column, and the
 * narrow-screen drawer mutually exclusive.
 *
 * @module views/workspace-styles
 */

import { makeStyles, tokens } from "@fluentui/react-components"

/** The workspace layout classes. */
export const useWorkspaceStyles = makeStyles({
  shell: {
    minHeight: "100vh",
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground1,
  },
  skipLink: {
    position: "absolute",
    left: "-9999px",
    top: 0,
    zIndex: 100,
    padding: tokens.spacingVerticalXS,
    backgroundColor: tokens.colorNeutralBackground1,
    ":focus": { left: tokens.spacingHorizontalS },
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  headerInner: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    flexWrap: "wrap",
    maxWidth: "1440px",
    margin: "0 auto",
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    textDecorationLine: "none",
  },
  breadcrumb: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    flexWrap: "wrap",
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  breadcrumbLink: {
    color: tokens.colorNeutralForeground2,
    textDecorationLine: "none",
    ":hover": { textDecorationLine: "underline" },
  },
  breadcrumbCurrent: {
    color: tokens.colorNeutralForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    marginInlineStart: "auto",
  },
  navTrigger: {
    display: "none",
    "@media (max-width: 850px)": { display: "inline-flex" },
  },
  body: {
    display: "grid",
    gridTemplateColumns: "260px minmax(0, 1fr) 220px",
    gridTemplateAreas: '"nav content rail"',
    gap: tokens.spacingHorizontalL,
    maxWidth: "1440px",
    margin: "0 auto",
    padding: tokens.spacingHorizontalL,
    alignItems: "start",
    "@media (max-width: 1200px)": {
      gridTemplateColumns: "260px minmax(0, 1fr)",
      gridTemplateAreas: '"nav content"',
    },
    "@media (max-width: 850px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
      gridTemplateAreas: '"content"',
      padding: tokens.spacingHorizontalM,
    },
  },
  nav: {
    gridArea: "nav",
    position: "sticky",
    top: "80px",
    alignSelf: "start",
    display: "block",
    "@media (max-width: 850px)": { display: "none" },
  },
  content: {
    gridArea: "content",
    minWidth: 0,
    display: "grid",
    gap: tokens.spacingVerticalL,
  },
  rail: {
    gridArea: "rail",
    position: "sticky",
    top: "80px",
    alignSelf: "start",
    display: "grid",
    gap: tokens.spacingVerticalM,
    "@media (max-width: 1200px)": { display: "none" },
  },
  heading: {
    display: "grid",
    gap: tokens.spacingVerticalXS,
  },
  positionLabel: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  title: {
    margin: 0,
    fontSize: tokens.fontSizeHero700,
    lineHeight: tokens.lineHeightHero700,
  },
  groupTitle: {
    margin: 0,
    fontSize: tokens.fontSizeBase600,
    lineHeight: tokens.lineHeightBase600,
  },
  muted: {
    color: tokens.colorNeutralForeground3,
  },
  card: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground1,
    display: "grid",
    gap: tokens.spacingVerticalS,
  },
  groupHeader: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    flexWrap: "wrap",
  },
  footer: {
    position: "sticky",
    bottom: 0,
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    flexWrap: "wrap",
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    backgroundColor: tokens.colorNeutralBackground1,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: tokens.shadow4,
  },
  footerGrow: { flexGrow: 1, minWidth: "180px" },
  actionRow: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    flexWrap: "wrap",
  },
  summaryGroup: {
    display: "grid",
    gap: tokens.spacingVerticalS,
    paddingBlock: tokens.spacingVerticalM,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  summaryQuestion: {
    display: "grid",
    gap: tokens.spacingVerticalXXS,
    paddingBlock: tokens.spacingVerticalXS,
  },
  summaryAnswer: {
    fontWeight: tokens.fontWeightSemibold,
  },
  details: {
    display: "grid",
    gap: tokens.spacingVerticalS,
    marginTop: tokens.spacingVerticalS,
  },
  navItemLabel: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    width: "100%",
    justifyContent: "space-between",
  },
  progressText: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  drawerHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingHorizontalM,
  },
})

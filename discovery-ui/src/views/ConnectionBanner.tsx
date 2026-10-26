/**
 * Connection banner for a lost or restarted event stream.
 *
 * @module views/ConnectionBanner
 */

import { MessageBar, MessageBarBody } from "@fluentui/react-components"

/** Props for {@link ConnectionBanner}. */
export interface ConnectionBannerProps {
  status: "live" | "reconnecting" | "restarted"
}

/** Render nothing while live; explain the stream state otherwise. */
export function ConnectionBanner({ status }: ConnectionBannerProps) {
  if (status === "live") return null
  return (
    <MessageBar intent="warning">
      <MessageBarBody>
        {status === "restarted" ? "Discovery restarted — reload" : "Reconnecting…"}
      </MessageBarBody>
    </MessageBar>
  )
}

/**
 * Confirmation dialog for submissions, archive, and delete actions.
 *
 * @module views/SubmitDialog
 */

import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  MessageBar,
  MessageBarBody,
  Text,
} from "@fluentui/react-components"

/** Props for {@link SubmitDialog}. */
export interface SubmitDialogProps {
  open: boolean
  title: string
  intro: string
  ready: string[]
  skipped: Array<{ group: string; title: string; label: string }>
  confirmLabel: string
  /** A submission or action failure shown inside the dialog. */
  error?: string | null
  /** Disables both actions while the work is in flight. */
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}

/** Render the confirmation dialog. */
export function SubmitDialog({
  open,
  title,
  intro,
  ready,
  skipped,
  confirmLabel,
  error = null,
  busy = false,
  onConfirm,
  onClose,
}: SubmitDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(_, data) => (data.open ? undefined : onClose())}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent>
            <Text>{intro}</Text>
            {ready.length > 0 ? (
              <Text block>
                Ready: {ready.join(", ")}
              </Text>
            ) : null}
            {skipped.map((entry) => (
              <Text key={entry.group} block size={200}>
                Skipped {entry.title}: {entry.label}
              </Text>
            ))}
            {error ? (
              <MessageBar intent="error">
                <MessageBarBody>{error}</MessageBarBody>
              </MessageBar>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button appearance="primary" disabled={busy} onClick={onConfirm}>
              {busy ? "Working…" : confirmLabel}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}

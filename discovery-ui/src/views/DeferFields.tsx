/**
 * The deferral fields of a question card.
 *
 * A deferral is only valid when decision, owner, and revisit are all filled in.
 * The switch therefore opens a local draft: the parent is told about the
 * deferral only once it is complete, so an in-progress edit is never sent to
 * the server as an invalid patch. The partial draft is reported separately as
 * incomplete work so navigation can reveal the missing fields.
 *
 * @module views/DeferFields
 */

import { useEffect, useRef, useState } from "react"
import { Input, Switch, Text } from "@fluentui/react-components"
import type { Defer } from "../../../bin/lib/discovery-rules.mjs"

/** Props for {@link DeferFields}. */
export interface DeferFieldsProps {
  defer: Defer | null
  disabled: boolean
  /** Changes when local drafts are discarded, resetting this control. */
  resetKey?: string
  onChange: (defer: Defer | null) => void
  onFlush?: () => void
  /** Reports whether the local deferral still needs input. */
  onIncomplete?: (incomplete: boolean, reason?: string) => void
}

/** The empty draft used before a deferral is saved. */
const EMPTY_DEFER: Defer = { decision: "", owner: "", revisit: "" }

/** The reason shown when the deferral cannot be sent yet. */
const INCOMPLETE_REASON = "Complete the deferral decision, owner, and revisit fields."

/** True when all three deferral fields carry text. */
function complete(defer: Defer): boolean {
  return (
    defer.decision.trim().length > 0 &&
    defer.owner.trim().length > 0 &&
    defer.revisit.trim().length > 0
  )
}

/** Render the deferral switch and its three inputs. */
export function DeferFields({
  defer,
  disabled,
  resetKey = "0",
  onChange,
  onFlush = () => {},
  onIncomplete = () => {},
}: DeferFieldsProps) {
  const [active, setActive] = useState(defer !== null)
  const [draft, setDraft] = useState<Defer>(defer ?? EMPTY_DEFER)
  const focused = useRef(false)
  const dirty = useRef(false)
  const incompleteRef = useRef(onIncomplete)
  incompleteRef.current = onIncomplete
  const draftRef = useRef(draft)
  draftRef.current = draft

  useEffect(() => {
    if (defer !== null) setActive(true)
    // A live refresh must not replace a dirty partial deferral. The explicit
    // discard path changes resetKey and clears it instead.
    if (!focused.current && !(dirty.current && !complete(draftRef.current))) {
      setDraft(defer ?? EMPTY_DEFER)
      if (defer !== null) dirty.current = false
    }
  }, [defer])

  useEffect(() => {
    setActive(defer !== null)
    setDraft(defer ?? EMPTY_DEFER)
    dirty.current = false
    focused.current = false
    incompleteRef.current(false)
  }, [resetKey])

  const update = (field: keyof Defer, value: string) => {
    const next = { ...draft, [field]: value }
    dirty.current = true
    setDraft(next)
    if (complete(next)) {
      incompleteRef.current(false)
      onChange(next)
    } else {
      incompleteRef.current(true, INCOMPLETE_REASON)
    }
  }

  const blur = () => {
    focused.current = false
    if (complete(draft)) {
      onChange(draft)
      onFlush()
      incompleteRef.current(false)
    } else if (active) {
      incompleteRef.current(true, INCOMPLETE_REASON)
    }
  }

  return (
    <div>
      <Switch
        checked={active}
        disabled={disabled}
        label="Defer this question"
        onChange={(_, data) => {
          setActive(data.checked)
          if (!data.checked) {
            setDraft(EMPTY_DEFER)
            dirty.current = false
            incompleteRef.current(false)
            onChange(null)
          } else {
            incompleteRef.current(true, INCOMPLETE_REASON)
          }
        }}
      />
      {active ? (
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          <Text size={200}>Decision</Text>
          <Input
            aria-label="Deferral decision"
            disabled={disabled}
            value={draft.decision}
            onChange={(_, data) => update("decision", data.value)}
            onFocus={() => {
              focused.current = true
            }}
            onBlur={blur}
          />
          <Text size={200}>Owner</Text>
          <Input
            aria-label="Deferral owner"
            disabled={disabled}
            value={draft.owner}
            onChange={(_, data) => update("owner", data.value)}
            onFocus={() => {
              focused.current = true
            }}
            onBlur={blur}
          />
          <Text size={200}>Revisit</Text>
          <Input
            aria-label="Deferral revisit"
            disabled={disabled}
            value={draft.revisit}
            onChange={(_, data) => update("revisit", data.value)}
            onFocus={() => {
              focused.current = true
            }}
            onBlur={blur}
          />
        </div>
      ) : null}
    </div>
  )
}

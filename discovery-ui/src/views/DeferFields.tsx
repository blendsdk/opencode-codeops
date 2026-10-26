/**
 * The deferral fields of a question card.
 *
 * A deferral is only valid when decision, owner, and revisit are all filled in.
 * The switch therefore opens a local draft: the parent is told about the
 * deferral only once it is complete, so an in-progress edit is never sent to
 * the server as an invalid patch.
 *
 * @module views/DeferFields
 */

import { useState } from "react"
import { Input, Switch, Text } from "@fluentui/react-components"
import type { Defer } from "../../../bin/lib/discovery-rules.mjs"

/** Props for {@link DeferFields}. */
export interface DeferFieldsProps {
  defer: Defer | null
  disabled: boolean
  onChange: (defer: Defer | null) => void
  onFlush?: () => void
}

/** True when all three deferral fields carry text. */
function complete(defer: Defer): boolean {
  return (
    defer.decision.trim().length > 0 &&
    defer.owner.trim().length > 0 &&
    defer.revisit.trim().length > 0
  )
}

/** Render the deferral switch and its three inputs. */
export function DeferFields({ defer, disabled, onChange, onFlush = () => {} }: DeferFieldsProps) {
  const [active, setActive] = useState(defer !== null)
  const [draft, setDraft] = useState<Defer>(defer ?? { decision: "", owner: "", revisit: "" })
  const current = defer ?? draft

  const update = (field: keyof Defer, value: string) => {
    const next = { ...current, [field]: value }
    setDraft(next)
    if (complete(next)) onChange(next)
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
            setDraft({ decision: "", owner: "", revisit: "" })
            onChange(null)
          }
        }}
      />
      {active ? (
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          <Text size={200}>Decision</Text>
          <Input
            aria-label="Deferral decision"
            disabled={disabled}
            value={current.decision}
            onChange={(_, data) => update("decision", data.value)}
            onBlur={() => {
              if (complete(current)) {
                onChange(current)
                onFlush()
              }
            }}
          />
          <Text size={200}>Owner</Text>
          <Input
            aria-label="Deferral owner"
            disabled={disabled}
            value={current.owner}
            onChange={(_, data) => update("owner", data.value)}
            onBlur={() => {
              if (complete(current)) {
                onChange(current)
                onFlush()
              }
            }}
          />
          <Text size={200}>Revisit</Text>
          <Input
            aria-label="Deferral revisit"
            disabled={disabled}
            value={current.revisit}
            onChange={(_, data) => update("revisit", data.value)}
            onBlur={() => {
              if (complete(current)) {
                onChange(current)
                onFlush()
              }
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

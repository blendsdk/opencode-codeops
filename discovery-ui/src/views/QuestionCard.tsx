/**
 * One question card.
 *
 * The card is presentational: it receives a derived `QuestionView` and reports
 * user actions as answer patches. All text from the plan is rendered as React
 * text, so no HTML or Markdown is ever interpreted. Text-like edits report a
 * blur so the parent can flush its debounced save.
 *
 * @module views/QuestionCard
 */

import { useEffect, useRef, useState } from "react"
import {
  Badge,
  Button,
  Checkbox,
  Input,
  MessageBar,
  MessageBarBody,
  Radio,
  RadioGroup,
  Switch,
  Text,
  Textarea,
  Tooltip,
} from "@fluentui/react-components"

import { DeferFields } from "./DeferFields.tsx"
import type { OptionView, QuestionView } from "../view-models.ts"

/** Props for {@link QuestionCard}. */
export interface QuestionCardProps {
  question: QuestionView
  disabled?: boolean
  onPatch?: (patch: Record<string, unknown>) => void
  onFlush?: () => void
}

/** The label of a choice option, with its recommendation badge. */
function optionLabel(option: OptionView) {
  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <Text>{option.label}</Text>
      {option.recommended ? <Badge appearance="tint">Recommended</Badge> : null}
    </span>
  )
}

/** Props for {@link DraftText}. */
interface DraftTextProps {
  /** Accessible name; the visible question title is rendered by the card. */
  ariaLabel: string
  /** The last value saved by the server. */
  value: string
  /** Disables the field. */
  disabled?: boolean
  /** Renders a multiline textarea instead of a single-line input. */
  multiline?: boolean
  /** Placeholder shown while the draft is empty. */
  placeholder?: string
  /** Receives the complete draft after every edit. */
  onChange: (value: string) => void
  /** Called when focus leaves so a pending debounced save can flush. */
  onFlush?: () => void
}

/**
 * A text-like control that keeps the user's draft locally.
 *
 * Saves are debounced, so the saved value comes back a moment after each
 * keystroke. A purely controlled field therefore shows the old value while the
 * user types, and browsers that restore controlled inputs aggressively can drop
 * every character except the last one (Firefox does this). While the field has
 * focus the local draft is authoritative; when focus leaves, an externally
 * saved value is adopted only if there is no unflushed edit.
 */
function DraftText({
  ariaLabel,
  value,
  disabled = false,
  multiline = false,
  placeholder,
  onChange,
  onFlush = () => {},
}: DraftTextProps) {
  const [draft, setDraft] = useState(value)
  const focused = useRef(false)
  const dirty = useRef(false)
  const draftRef = useRef(draft)
  draftRef.current = draft

  useEffect(() => {
    if (!focused.current) {
      setDraft(value)
      dirty.current = false
    } else if (value === draftRef.current) {
      // The save echo arrived for the text already in the field.
      dirty.current = false
    }
  }, [value])

  const update = (next: string) => {
    dirty.current = true
    setDraft(next)
    onChange(next)
  }

  const blur = () => {
    focused.current = false
    if (!dirty.current) setDraft(value)
    else if (value === draftRef.current) dirty.current = false
    onFlush()
  }

  if (multiline) {
    return (
      <Textarea
        aria-label={ariaLabel}
        disabled={disabled}
        placeholder={placeholder}
        value={draft}
        onChange={(_, data) => update(data.value)}
        onFocus={() => {
          focused.current = true
        }}
        onBlur={blur}
      />
    )
  }

  return (
    <Input
      aria-label={ariaLabel}
      disabled={disabled}
      placeholder={placeholder}
      value={draft}
      onChange={(_, data) => update(data.value)}
      onFocus={() => {
        focused.current = true
      }}
      onBlur={blur}
    />
  )
}

/** Render one question and its controls. */
export function QuestionCard({
  question,
  disabled = false,
  onPatch = () => {},
  onFlush = () => {},
}: QuestionCardProps) {
  const readOnly = disabled || question.readOnly
  const selected = question.options.find((option) => option.selected)?.id

  return (
    <section
      aria-label={question.title}
      style={{ border: "1px solid var(--colorNeutralStroke2)", borderRadius: 8, padding: 12, marginBlock: 8 }}
    >
      <header style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Text weight="semibold">{question.title}</Text>
        <Badge appearance="tint">{question.statusLabel}</Badge>
        {question.implied ? (
          <Badge appearance="outline" color="informative">
            Implied
          </Badge>
        ) : null}
      </header>
      {question.why ? <Text size={200}>{question.why}</Text> : null}
      {question.evidence.length > 0 ? (
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, marginBlock: 8 }}>
          {question.evidence.join("\n")}
        </pre>
      ) : null}

      {question.implied ? (
        <Text italic size={200}>
          {question.implied.label}
        </Text>
      ) : null}
      {question.conflict ? (
        <MessageBar intent="warning">
          <MessageBarBody>{question.conflict.label}</MessageBarBody>
        </MessageBar>
      ) : null}
      {question.changed ? (
        <MessageBar intent="warning">
          <MessageBarBody>
            Question changed — re-confirm.{" "}
            <Button size="small" disabled={readOnly} onClick={() => onPatch({ reconfirm: true })}>
              Re-confirm
            </Button>
          </MessageBarBody>
        </MessageBar>
      ) : null}
      {question.proposal ? (
        <MessageBar>
          <MessageBarBody>
            {question.proposal.label}{" "}
            <Button size="small" disabled={readOnly} onClick={() => onPatch({ confirmProposal: true })}>
              Confirm
            </Button>{" "}
            <Button size="small" disabled={readOnly} onClick={() => onPatch({ dismissProposal: true })}>
              Reopen
            </Button>
          </MessageBarBody>
        </MessageBar>
      ) : null}

      {question.type === "text" ? (
        <DraftText
          ariaLabel={question.title}
          disabled={readOnly}
          multiline
          value={question.text ?? ""}
          onChange={(text) => onPatch({ answer: { text } })}
          onFlush={onFlush}
        />
      ) : question.type === "multiple" ? (
        <div>
          {question.options.map((option) => (
            <Checkbox
              key={option.id}
              disabled={readOnly}
              checked={option.selected}
              label={optionLabel(option)}
              onChange={(_, data) => {
                const current = new Set(
                  question.options.filter((item) => item.selected).map((item) => item.id),
                )
                if (data.checked) current.add(option.id)
                else current.delete(option.id)
                onPatch({ answer: { choices: [...current] } })
              }}
            />
          ))}
        </div>
      ) : (
        <>
          <RadioGroup
            aria-label={question.title}
            disabled={readOnly}
            value={selected ?? ""}
            onChange={(_, data) => onPatch({ answer: { choice: data.value } })}
          >
            {question.options.map((option) => (
              <Radio key={option.id} value={option.id} label={optionLabel(option)} />
            ))}
          </RadioGroup>
          {question.type === "single-other" ? (
            <DraftText
              ariaLabel={`${question.title} other`}
              disabled={readOnly}
              placeholder="Other"
              value={question.other ?? ""}
              onChange={(other) => onPatch({ answer: { other } })}
              onFlush={onFlush}
            />
          ) : null}
        </>
      )}

      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
        <Text size={200}>Notes</Text>
        <DraftText
          ariaLabel={`${question.title} notes`}
          disabled={readOnly}
          multiline
          value={question.notes}
          onChange={(notes) => onPatch({ notes })}
          onFlush={onFlush}
        />
        <DeferFields
          defer={question.defer}
          disabled={readOnly}
          onChange={(defer) => onPatch({ defer })}
          onFlush={onFlush}
        />
        <Switch
          checked={question.needsDiscussion}
          disabled={readOnly}
          label="Needs discussion"
          onChange={(_, data) => onPatch({ needsDiscussion: data.checked })}
        />
      </div>
      {readOnly ? (
        <Tooltip content="Submitted and recorded answers are read-only" relationship="description">
          <Text size={200}>Read-only</Text>
        </Tooltip>
      ) : null}
    </section>
  )
}

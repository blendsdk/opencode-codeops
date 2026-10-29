/**
 * One question card.
 *
 * The card is presentational: it receives a derived `QuestionView` and reports
 * user actions as answer patches. All text from the plan is rendered as React
 * text, so no HTML or Markdown is ever interpreted. Text-like edits report a
 * blur so the parent can flush its debounced save.
 *
 * Supplementary controls live in a disclosure that keeps its children
 * mounted. Collapsing it therefore never destroys a partial deferral or a
 * note draft.
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
import { useWorkspaceStyles } from "./workspace-styles.ts"
import type { OptionView, QuestionView } from "../view-models.ts"

/** Props for {@link QuestionCard}. */
export interface QuestionCardProps {
  question: QuestionView
  disabled?: boolean
  /** Changes when local drafts are discarded, resetting uncontrolled fields. */
  resetKey?: string
  /** A local incomplete-control reason, shown beside the fields. */
  incomplete?: string | null
  onPatch?: (patch: Record<string, unknown>) => void
  onFlush?: () => void
  onDiscard?: (key: string) => void
  onIncomplete?: (key: string, value: boolean, reason?: string) => void
  onRetry?: (key?: string) => void
  /** Hides Retry while a recheck requires explicit review. */
  retryDisabled?: boolean
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
  /** The last value saved by the server or the current display overlay. */
  value: string
  /** Disables the field. */
  disabled?: boolean
  /** Renders a multiline textarea instead of a single-line input. */
  multiline?: boolean
  /** Placeholder shown while the draft is empty. */
  placeholder?: string
  /** Resets the local draft after an explicit discard. */
  resetKey?: string
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
  resetKey = "0",
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

  useEffect(() => {
    setDraft(value)
    draftRef.current = value
    dirty.current = false
    focused.current = false
  }, [resetKey])

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
  resetKey = "0",
  incomplete = null,
  onPatch = () => {},
  onFlush = () => {},
  onDiscard = () => {},
  onIncomplete = () => {},
  onRetry = () => {},
  retryDisabled = false,
}: QuestionCardProps) {
  const styles = useWorkspaceStyles()
  const readOnly = disabled || question.readOnly
  const selected = question.options.find((option) => option.selected)?.id
  const [detailsOpen, setDetailsOpen] = useState(
    question.defer !== null ||
      question.needsDiscussion ||
      question.error !== null ||
      incomplete !== null,
  )

  const hasDefer = question.defer !== null
  const hasDiscussion = question.needsDiscussion
  const hasError = question.error !== null
  const hasIncomplete = incomplete !== null

  useEffect(() => {
    if (hasDefer || hasDiscussion || hasError || hasIncomplete) setDetailsOpen(true)
  }, [hasDefer, hasDiscussion, hasError, hasIncomplete])

  const detailsId = `${question.key}-details`

  return (
    <section className={styles.card} aria-label={question.title}>
      <header className={styles.groupHeader}>
        <Text weight="semibold">{question.title}</Text>
        <Badge appearance="tint">{question.statusLabel}</Badge>
        {question.implied ? (
          <Badge appearance="outline" color="informative">
            Implied
          </Badge>
        ) : null}
        {question.hasDraft ? <Badge color="warning">Unsaved changes</Badge> : null}
      </header>
      {question.why ? <Text size={200}>{question.why}</Text> : null}
      {question.evidence.length > 0 ? (
        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, marginBlock: 8, overflowWrap: "anywhere" }}>
          {question.evidence.join("\n")}
        </pre>
      ) : null}

      {question.implied ? (
        <Text italic size={200}>
          {question.implied.label}
        </Text>
      ) : null}
      {question.overridesImplied ? (
        <Text size={200} className={styles.muted}>
          This answer overrides the implied answer.
        </Text>
      ) : null}
      {question.conflict ? (
        <MessageBar intent="warning">
          <MessageBarBody>{question.conflict.label}</MessageBarBody>
        </MessageBar>
      ) : null}
      {question.error ? (
        <MessageBar intent="error">
          <MessageBarBody>{question.error}</MessageBarBody>
        </MessageBar>
      ) : null}
      {incomplete ? (
        <MessageBar intent="warning">
          <MessageBarBody>{incomplete}</MessageBarBody>
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
          resetKey={resetKey}
          value={question.text ?? ""}
          onChange={(text) => onPatch({ answer: { text } })}
          onFlush={onFlush}
        />
      ) : question.type === "multiple" ? (
        <div role="group" aria-label={question.title}>
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
              resetKey={resetKey}
              value={question.other ?? ""}
              onChange={(other) => onPatch({ answer: { other } })}
              onFlush={onFlush}
            />
          ) : null}
        </>
      )}

      <div className={styles.actionRow}>
        <Button
          appearance="subtle"
          size="small"
          aria-expanded={detailsOpen}
          aria-controls={detailsId}
          onClick={() => setDetailsOpen((open) => !open)}
        >
          Additional details
        </Button>
        {!detailsOpen && question.notes ? (
          <Text size={200} className={styles.muted}>
            Notes added
          </Text>
        ) : null}
        {question.hasDraft && (readOnly || question.error !== null) ? (
          <Button appearance="secondary" size="small" onClick={() => onDiscard(question.key)}>
            Discard unsaved change
          </Button>
        ) : null}
        {question.error !== null && !readOnly && !retryDisabled ? (
          <Button appearance="primary" size="small" onClick={() => onRetry(question.key)}>
            Retry
          </Button>
        ) : null}
      </div>

      <div id={detailsId} hidden={!detailsOpen} className={styles.details}>
        <Text size={200}>Notes</Text>
        <DraftText
          ariaLabel={`${question.title} notes`}
          disabled={readOnly}
          multiline
          resetKey={resetKey}
          value={question.notes}
          onChange={(notes) => onPatch({ notes })}
          onFlush={onFlush}
        />
        <DeferFields
          defer={question.defer}
          disabled={readOnly}
          resetKey={resetKey}
          onChange={(defer) => onPatch({ defer })}
          onFlush={onFlush}
          onIncomplete={(value, reason) => onIncomplete(question.key, value, reason)}
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

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
        <Textarea
          aria-label={question.title}
          disabled={readOnly}
          value={question.text ?? ""}
          onChange={(_, data) => onPatch({ answer: { text: data.value } })}
          onBlur={onFlush}
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
            <Input
              aria-label={`${question.title} other`}
              disabled={readOnly}
              placeholder="Other"
              value={question.other ?? ""}
              onChange={(_, data) => onPatch({ answer: { other: data.value } })}
              onBlur={onFlush}
            />
          ) : null}
        </>
      )}

      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
        <Text size={200}>Notes</Text>
        <Textarea
          aria-label={`${question.title} notes`}
          disabled={readOnly}
          value={question.notes}
          onChange={(_, data) => onPatch({ notes: data.value })}
          onBlur={onFlush}
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

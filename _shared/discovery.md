# Discovery (optional answer surface)

> **CodeOps Artifact Schema**: 1

Discovery moves large question rounds out of the chat scroll and into a local
browser page. New projects created with `setup-codeops` enable it by default;
existing projects toggle it with `setup-codeops --enable-discovery` or
`--disable-discovery`. It never replaces the Ambiguity Register. Use it only
when this file's conditions hold; otherwise ask in chat exactly as before.

## When it applies

All three must hold:

1. `codeops/codeops.json` sets `discovery.enabled: true`.
2. The `codeops_discovery_publish`, `codeops_discovery_answers`, and
   `codeops_discovery_resolve` tools are available.
3. The run does not carry the `--no-discovery` token.

If any condition fails, ask in chat. Never mention a page the user cannot use.

## Round size

A round with at most `discovery.chatMaxQuestions` questions (default 3) stays
in chat. Larger rounds are published. The user can always ask to answer in
chat instead; honor that for the rest of the run.

## What never goes to the page

The **Complexity Escalation Gate** always stays in chat: its visible STOP
packet, the challenger verdict, and the approval decision. The page has no
"accept all" control, so a question that would waive a gate must not be
published.

## Publishing

- One Discovery plan per artifact: the `kind` (`plan`, `requirements`, or
  `preflight`) plus the repository-relative `artifact` path. Republishing the
  same pair creates the next revision.
- Groups follow dependency order; a foundational group is listed in `dependsOn`
  of the groups it unlocks.
- Every question carries `why`, `evidence` (`file:line` where possible),
  options with their trade-offs, and a `recommendation`. The recommendation is
  shown and never pre-selected.
- Use `showIf` and `implies` when one answer settles another question in the
  same plan. No chains: an implied answer never implies a third.
- Keys are stable: `DQ-<n>` for discovery, `PF-NNN` for preflight findings.
  Never reuse a key for a different decision.
- A question whose answer is already recorded may be republished unchanged.
  Omitting an **open** question retires it; recorded, submitted, and
  already-retired questions are kept (with a warning when the content changed).
  Retire a submitted question through `codeops_discovery_resolve`. A follow-up
  publish therefore resends every earlier question plus the new ones.

## After publishing

Send one chat line with the link (and the fallback-port notice when present).
Then **end the turn** and **do not poll**. The user answers in the browser; the
wake message continues the work. Under the no-waker fallback, call
`codeops_discovery_answers` with `wait: true` after publishing.

## Ownership

On an `owned` result, ask the user in chat whether to take over. Publish with
`takeover: true` only after an explicit yes. Never take over silently.

## Reading and recording

On the wake message, or when the user says they answered, call
`codeops_discovery_answers`. Then:

- Record each answer as exact text with its question key and its source.
- Record an implied answer as "**implied by** <key>, shown and submitted".
  Note when the user overrode an implication.
- Record a Defer as a named deferral: decision · owner · revisit.
- Leave "needs discussion" questions open; they are not decisions.
- Call `codeops_discovery_resolve` with the register ids for the recorded
  answers. The **Ambiguity Register stays the authoritative record**; the page
  is only the collection surface.
- Answers the user gives in chat for published questions are recorded and
  resolved exactly the same way.

## Follow-ups

Republish the same artifact with **every earlier question plus the new ones**.
A publish is the plan's full question set: omitting an open question retires
it, while submitted and recorded questions are kept until they are recorded. Use `proposal` for
settlements the agent infers; the user confirms or reopens them on the page.

## Unavailable

On `disabled` or `unavailable`, say so in one line and ask in chat. **Never
skip or weaken a gate** because the page is unavailable.

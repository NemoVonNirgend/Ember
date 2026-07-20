# Ember 4 diagnostics and repair

Ember 4 separates deterministic diagnosis, model-assisted proposals, review, and application. The current checkpoint implements the first three. It deliberately does not change chat messages automatically.

## Deterministic diagnostics

The Inspector checks source before or after execution for:

- parent, top, or opener access;
- direct network APIs blocked by CSP;
- unsupported import/export syntax;
- legacy SillyTavern and slash-command APIs;
- external HTML scripts;
- requested permissions with no matching API call;
- library requests that are not available to artifacts yet;
- JavaScript artifacts that never use `root`;
- missing stable IDs for stateful artifacts.

Diagnostics are advisory except where the runtime or CSP independently enforces the rule.

## Repair proposals

From the Artifact Inspector, **Ask current ST model for repair** sends the source, runtime contract, and deterministic diagnostics through SillyTavern's current raw-generation connection.

The response is placed in a candidate editor. It is not executed, persisted, or inserted into the chat.

## Diff review

**Preview source diff** compares the original and candidate with SillyTavern's diff-match-patch library. Deletions and insertions are displayed separately. The user can continue editing the candidate and regenerate the diff.

## Applying and rolling back

**Apply reviewed repair** requires a separate confirmation. Ember verifies the active chat and the exact message revision captured when the Inspector opened. Stale or ambiguous replacements are refused.

Successful applications preserve the original source, repaired source, before/after revisions, timestamp, artifact key, and original message in `message.extra.ember4Repairs`. The message is then saved and rerendered through SillyTavern events.

**Roll back latest repair** is available while the repaired message still matches the recorded post-repair revision. If the message changed afterward, Ember refuses automatic rollback rather than overwriting newer work.

# AuditService

Odid defines interface called `AuditService` that abstracts running audits against subjects and returning audit result.

Audit service should allow to specify optional model and reasoning used during audit.

## CliCodexAuditService

Initially we provide only single implementation of `AuditService` called `CliCodexAuditService`. It executes command similar to the following one:

```shell
codex exec --ephemeral --ignore-user-config --skip-git-repo-check --sandbox read-only --model $MODEL -c "model_reasoning_effort=$REASONING" --output-schema ~/.odid/shared/audit-result.json
```

Default model is `gpt-5.6-luna` and reasoning is `medium`.

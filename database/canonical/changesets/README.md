# Canonical changesets

Phase 5 canonical publication records deterministic field-level changes for team-owned canonical tables.

Each JSON changeset is generated from a committed base, keyed by stable table/row/field identity, and validated before push. Runtime/private tables are forbidden. Non-overlapping changes may coexist after rebasing; same-record/same-field disagreements are explicit conflicts and must be reviewed instead of using timestamp-wins behavior.

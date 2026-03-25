# saifac run rules

Manage **user feedback rules** stored on a run artifact. Rules are injected into the agent **task prompt** (see [Runs — Run rules](../runs.md#run-rules-user-feedback)).

**Subcommands:** `create`, `list` / `ls`, `get`, `update`, `remove` / `rm`.

## Usage

```bash
saifac run rules create <runId> --content "…" [options]
saifac run rules create <runId> --content-file <path> [options]

saifac run rules list <runId> [options]
# or: saifac run rules ls <runId>

saifac run rules get <runId> <ruleId> [options]

saifac run rules update <runId> <ruleId> [options]

saifac run rules remove <runId> <ruleId> [options]
# or: saifac run rules rm <runId> <ruleId>
```

## Shared options

These apply to **every** subcommand:

| Argument        | Type   | Description                                                                                      |
| --------------- | ------ | ------------------------------------------------------------------------------------------------ |
| `--project-dir` | string | Project directory (default: current working directory)                                           |
| `--saifac-dir`  | string | Saifac config directory relative to project (default: `saifac`)                                |
| `--storage`     | string | Run storage: `local` / `none` / `runs=…` (see [Runs](../runs.md)); default is local under project |

---

## `run rules create`

Append a new rule to a Run.

```bash
saifac run rules create abc12x --content "Prefer functional style in new code."
saifac run rules create abc12x --content-file ./feedback.md --scope always
```

| Argument / flag   | Required | Description                                                                 |
| ----------------- | -------- | --------------------------------------------------------------------------- |
| `runId`           | yes      | Positional run ID                                                           |
| `--content`       | one of   | Rule body (mutually exclusive with `--content-file`)                        |
| `--content-file`  | one of   | Path to a UTF-8 file whose contents become the rule body                    |
| `--scope`         | no       | `once` (default) or `always` — see [scopes](../runs.md#run-rules-user-feedback) |

Exactly **one** of `--content` or `--content-file` is required. File contents are trimmed; empty or whitespace-only files are rejected.

On success, the new rule’s **id** is printed. Use it with `get`, `update`, or `remove`.

---

## `run rules list` / `run rules ls`

Print a **table** of all rules on the Run.

```bash
saifac run rules list abc12x
saifac run rules ls abc12x
```

| Argument | Required | Description        |
| -------- | -------- | ------------------ |
| `runId`  | yes      | Positional run ID  |

The table includes ID, scope, whether `consumedAt`, content preview.

If there are no rules, prints a short message.

Sorted by `createdAt`.

---

## `run rules get`

Print **single** rule as JSON.

```bash
saifac run rules get <runId> <ruleId>
saifac run rules get <runId> <ruleId> --no-pretty | jq .scope
```

| Argument | Required | Description       |
| -------- | -------- | ----------------- |
| `runId`  | yes      | Positional run ID |
| `ruleId` | yes      | Positional rule id |

| Flag       | Type    | Description                                              |
| ---------- | ------- | -------------------------------------------------------- |
| `--pretty` | boolean | Pretty-print JSON (default: true). Use `--no-pretty` for one line. |

---

## `run rules update`

Change a rule’s **content** and/or **scope**.

```bash
saifac run rules update abc12x a1b2c3 --scope always
saifac run rules update abc12x a1b2c3 --content-file ./revised.md
```

| Argument / flag  | Required | Description                                                |
| ---------------- | -------- | ---------------------------------------------------------- |
| `runId`          | yes      | Positional run ID                                          |
| `ruleId`         | yes      | Positional rule id                                         |
| `--content`      | no       | New body |
| `--content-file` | no       | New body from file                                   |
| `--scope`        | no       | `once` or `always`                                         |

At least one of `--content`, `--content-file`, or `--scope` must be provided.

`--content` and `--content-file` are mutually exclusive when both are supplied.

---

## `run rules remove` / `run rules rm`

Delete a rule by ID from the Run.

```bash
saifac run rules remove abc12x a1b2c3
saifac run rules rm abc12x a1b2c3
```

| Argument | Required | Description       |
| -------- | -------- | ----------------- |
| `runId`  | yes      | Positional run ID |
| `ruleId` | yes      | Positional rule ID |

---

## Schema

### RunRule

| Field       | Type   | Description                                                |
| ----------- | ------ | ---------------------------------------------------------- |
| `id`        | string | Stable id: 6 lowercase hex chars (do not rely on array index) |
| `content`   | string | Text shown in the agent task                               |
| `scope`     | string | `once` or `always`                                         |
| `createdAt` | string | ISO-8601 timestamp                                         |
| `updatedAt` | string | ISO-8601 timestamp                                         |
| `consumedAt`| string | Optional; set after a `once` rule has been used in a round |

## Notes

- If you set `--storage none` / `runs=none`, the CLI errors and exits non-zero (`Run storage is disabled (--storage none). Cannot resume.`).

- Concurrency - `saifac` uses revision versions to handle concurrent writes. Mutating commands (`create`, `update`, `remove`) change the revision version. If another writer saved in between, you get a **stale revision** message — reload the run and retry.

---

## See also

- [Guide: Provide user feedback to the agent](../guides/providing-user-feedback.md) — Step-by-step (`run rules` → `run resume`)
- [Runs](../runs.md) — Run storage, artifact shape, rule semantics
- [`run resume`](run-resume.md) — Next step after adding rules
- [`run info`](run-info.md) — Inspect artifact JSON (includes `rules` when present)
- [`run fork`](run-fork.md) — Copy a run including rules
- [`run list`](run-list.md) — Discover `runId` values

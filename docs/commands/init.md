# saif init

Initialize Shotgun.

One-time setup: Configures Shotgun (optionally with Context7 for documentation lookup), and indexes the codebase for spec-driven workflows.

## Usage

```bash
saif init [options]
```

## Arguments

| Argument        | Alias | Type   | Description                                            |
| --------------- | ----- | ------ | ------------------------------------------------------ |
| `--project`     | `-p`  | string | Project name override (default: `package.json` "name") |
| `--saif-dir`    | —     | string | Path to saif directory (default: `saif`)               |
| `--project-dir` | —     | string | Project directory (default: current working directory) |

## Examples

Basic init (uses `package.json` name as project):

```bash
saif init
```

Override project name:

```bash
saif init -p my-project
```

Use a custom saif directory:

```bash
saif init --saif-dir ./my-saif
```

Use a custom project directory (e.g. when running from a parent monorepo):

```bash
saif init --project-dir ./packages/my-app
```

## Environment variables

| Variable           | Required | Description                                                                                                      |
| ------------------ | -------- | ---------------------------------------------------------------------------------------------------------------- |
| `SHOTGUN_PYTHON`   | no       | Path to the Python binary that has `shotgun-sh` installed (default: `python`). Example: `$(uv run which python)` |
| `CONTEXT7_API_KEY` | no       | API key for Context7 documentation lookup inside Shotgun. Configured once via `saif init`.                       |

## What it does

1. Runs `python -m shotgun.main config init`
2. Optionally configures Context7 via `python -m shotgun.main config set-context7 --api-key <key>` (if CONTEXT7_API_KEY is set)
3. Indexes the codebase with `python -m shotgun.main codebase index . --name <project>`

## Notes

- **Custom Python path** - Use `SHOTGUN_PYTHON=$(uv run which python) saif init ...` if Python needs uv.

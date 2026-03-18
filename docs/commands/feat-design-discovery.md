# saifac feat design-discovery

Gather context using MCP servers and/or local tool scripts — optional step before `design-specs`.

Runs an AI discovery agent with your configured tools to produce `discovery.md` in the feature directory (`saifac/features/<name>/discovery.md`).

Once this file exists, any subsequent runs of `saifac feat design-specs` (or `saifac feat design`) will automatically inject the contents of `discovery.md` as additional context alongside your `proposal.md`.

**Requires** `discoveryMcps` or `discoveryTools` (via CLI or config). Without either, the command errors.

## Usage

```bash
saifac feat design-discovery [options]
saifac feature design-discovery [options]
```

## Arguments

| Argument                  | Alias | Type    | Description                                                                                         |
| ------------------------- | ----- | ------- | --------------------------------------------------------------------------------------------------- |
| `--name`                  | `-n`  | string  | Feature name (kebab-case). Prompts with a list if omitted.                                          |
| `--yes`                   | `-y`  | boolean | Non-interactive mode. Requires `--name`.                                                            |
| `--discovery-mcp`         | —     | string  | Named MCP server: `name=http(s)://url`. Multiple or comma-separated.                                |
| `--discovery-tool`        | —     | string  | Path to a single JS/TS file exporting Mastra tools.                                                 |
| `--discovery-prompt`      | —     | string  | Inline heuristic prompt for the discovery agent. Mutually exclusive with `--discovery-prompt-file`. |
| `--discovery-prompt-file` | —     | string  | Path to heuristic prompt file. Mutually exclusive with `--discovery-prompt`.                        |
| `--model`                 | —     | string  | LLM model for the discovery agent (see [models.md](../models.md)).                                  |
| `--base-url`              | —     | string  | LLM base URL.                                                                                       |
| `--saifac-dir`            | —     | string  | Path to saifac directory (default: `saifac`)                                                        |
| `--project-dir`           | —     | string  | Project directory (default: current working directory)                                              |

## Examples

### With a local tool file

When using `--discovery-tool`, your JS/TS file must default export an object mapping tool names to Mastra `Tool` instances.

```ts
// scripts/my-tools.ts
import { Tool } from '@mastra/core/tools';
import { z } from 'zod';

const myTool = new Tool({
  id: 'myTool',
  description: 'Does something cool',
  schema: z.object({ query: z.string() }),
  execute: async ({ context }) => {
    return { result: 'data' };
  },
});

export default { myTool };
```

```bash
saifac feat design-discovery -n add-login --discovery-tool ./scripts/my-tools.ts
```

### With an MCP server

```bash
saifac feat design-discovery --discovery-mcp schema=http://internal-mcp/schema
```

Config-based (in `saifac/config.json`):

```json
{
  "defaults": {
    "discoveryMcps": { "schema": "http://internal-mcp/schema" },
    "discoveryTools": "./scripts/discovery-tools.ts",
    "discoveryPromptFile": "./docs/discovery-rules.md"
  }
}
```

```bash
saifac feat design-discovery -n add-login
```

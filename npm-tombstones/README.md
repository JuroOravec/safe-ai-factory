# npm tombstone packages

Defensive placeholder packages so unscoped names **`safe-ai-factory`** and **`saifctl`** cannot be squatted on npm. Each tombstone has **no useful runtime**; install the real CLI as **`@safe-ai-factory/saifctl`**.

Publish order:

1. **`@safe-ai-factory/saifctl`** — from the repository root (real package).
2. **`safe-ai-factory`** — from `npm-tombstones/safe-ai-factory/`.
3. **`saifctl`** — from `npm-tombstones/saifctl/`.

After each tombstone publish, run **`npm deprecate`** so installers see a warning.

## Commands (copy-paste)

Log in once:

```bash
npm login
```

### 1. Real package (repository root)

From **`safe-ai-factory/`** (this repo root), after tests and build succeed:

```bash
cd /path/to/safe-ai-factory
pnpm install
pnpm run build
npm publish --access public
```

(`prepublishOnly` runs `npm run build` if you use `npm publish`; using `pnpm` for install is fine.)

### 2. Tombstone: `safe-ai-factory`

```bash
cd /path/to/safe-ai-factory/npm-tombstones/safe-ai-factory
npm publish
npm deprecate safe-ai-factory@1.0.0 "This name is not the SaifCTL CLI. Install @safe-ai-factory/saifctl instead."
```

(Use `npm deprecate safe-ai-factory@"*"` if you prefer all versions.)

### 3. Tombstone: `saifctl`

```bash
cd /path/to/safe-ai-factory/npm-tombstones/saifctl
npm publish
npm deprecate saifctl@1.0.0 "Official package is @safe-ai-factory/saifctl. Install that instead."
```

## Version bumps

- Bump **`npm-tombstones/*/package.json`** `version` if you need to re-publish a tombstone (npm rejects duplicate versions).
- The main app version lives in the root **`package.json`**.

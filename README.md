# ts-eager

Fast TypeScript runner and register hook with eager compilation.

Similar to [`ts-node`](https://github.com/TypeStrong/ts-node), except it uses [`esbuild`](https://github.com/evanw/esbuild) – an extremely fast TypeScript transpiler – to eagerly compile all included files from your `tsconfig.json` on startup. This makes a noticeable difference for large TS projects.

It falls back to lazy compilation if a file is require'd that's not in `tsconfig.json`, and will also fallback to `ts-node` (if it's installed) for any type-specific compilation that `esbuild` doesn't support (such as `emitDecoratorMetadata`).

## Installation

```console
npm install -D ts-eager

# Optional, but recommended: for determining files from tsconfig.json
npm install -D typescript

# Optional, if you need emitDecoratorMetadata support
npm install -D ts-node

# Optional, if you need paths support
npm install -D tsconfig-paths
```

## Usage

```console
ts-eager myfile.ts
```

Or as a require hook:

```console
node -r ts-eager/register myfile.ts
```

If you need `paths` support, and have `tsconfig-paths` installed:

```console
ts-eager-paths myfile.ts
```

Or:

```console
node -r ts-eager/register-paths myfile.ts
```

Or:

```console
node -r ts-eager/register -r tsconfig-paths/register myfile.ts
```

## Configuration

`ts-eager` doesn't have any specific command-line options – it invokes `node` and passes all command-line arguments through.

It supports these environment variables:

- `TS_EAGER_LOGLEVEL`: 'error' (default), 'warning', 'info', 'silent'
- `TS_NODE_PROJECT`: tsconfig file (default tsconfig.json)
- `TS_NODE_IGNORE`: comma separated regexes to skip compilation completely

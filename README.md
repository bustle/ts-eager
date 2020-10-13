# ts-eager

Fast TypeScript runner and register hook with eager compilation.

Similar to [`ts-node`](https://github.com/TypeStrong/ts-node), except it uses [`esbuild`](https://github.com/evanw/esbuild) – an extremely fast TypeScript transpiler – to eagerly compile all included files from your `tsconfig.json` on startup. This makes a noticeable difference for tasks where you're likely to load a good portion of your TS files, eg running tests.

It falls back to lazy compilation if a file is require'd that's not in `tsconfig.json`, and will also fallback to `ts-node` (if it's installed) for any type-specific compilation that `esbuild` doesn't support (such as `emitDecoratorMetadata`). It will also optionally require `tsconfig-paths` for `paths` support if your `tsconfig` needs it.

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

## Configuration

`ts-eager` doesn't have any specific command-line options – it invokes `node` and passes all command-line arguments through.

It supports these environment variables:

- `TS_EAGER_LOGLEVEL`: 'error' (default), 'warning', 'info', 'silent'
- `TS_NODE_PROJECT`: tsconfig file (default tsconfig.json)
- `TS_NODE_IGNORE`: comma separated regexes to skip compilation completely

## Examples

If you want to customize which files `ts-eager` compiles up-front, you can specify a different `tsconfig.json` using `TS_NODE_PROJECT`, and then use the standard TypeScript `include`/`exclude` options in your config.

For example, if this was in `tsconfig.test.json`:

```json
{
  "extends": "./tsconfig.json",
  "include": ["test"],
  "exclude": ["**/*.template.ts"]
}
```

Then you could run `mocha` like this:

```console
TS_NODE_PROJECT=tsconfig.test.json mocha -r ts-eager/register
```

And it would only eagerly compile files in `test`, and exclude any matching `*.template.ts`.

`mocha` also supports adding require hooks in `.mocharc.json`:

```json
{
  "recursive": true,
  "require": ["ts-eager/register"],
  "timeout": 5000
}
```

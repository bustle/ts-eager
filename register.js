/* eslint-disable no-console */
const { readFileSync } = require('fs')
const { tmpdir } = require('os')
const { resolve, extname, dirname } = require('path')
const { buildSync } = require('esbuild')
const sourceMapSupport = require('source-map-support')

const logLevel = process.env.TS_EAGER_LOGLEVEL || 'error' // 'warning', 'info', 'silent'

const tsconfigName = process.env.TS_NODE_PROJECT || undefined
const ignoreRegexes = process.env.TS_NODE_IGNORE || '(?:^|/)node_modules/'

const ignores = ignoreRegexes.split(/ *, */g).map((str) => new RegExp(str))

let tsconfig = ''
let basePath = process.cwd()
let files = []
let allowJs = false
let emitDecoratorMetadata = false
let compilerOptions
try {
  const { sys, findConfigFile, readConfigFile, parseJsonConfigFileContent } = require('typescript')

  tsconfig = findConfigFile('.', sys.fileExists, tsconfigName) || 'tsconfig.json'
  const parsedConfig = parseJsonConfigFileContent(readConfigFile(tsconfig, sys.readFile).config, sys, '.')

  basePath = dirname(tsconfig)
  files = parsedConfig.fileNames
  allowJs = !!parsedConfig.options.allowJs
  emitDecoratorMetadata = !!parsedConfig.options.emitDecoratorMetadata

  compilerOptions = parsedConfig.raw.compilerOptions

  const { baseUrl, paths } = parsedConfig.options
  if (Object.keys(paths || {}).length) {
    try {
      require('tsconfig-paths').register({ baseUrl, paths })
    } catch (e) {
      if (['warning', 'info'].includes(logLevel)) {
        console.error('tsconfig has paths, but tsconfig-paths is not installed')
        console.error('Proceeding without paths support...')
      }
    }
  }
} catch (e) {
  if (['warning', 'info'].includes(logLevel)) {
    console.error(`Could not parse ${tsconfigName || 'tsconfig.json'} (is typescript installed?)`)
    console.error(e)
    console.error('Proceeding without eager compilation...')
  }
}

files = files.filter((file) => !file.endsWith('.d.ts')).map((path) => resolve(basePath, path))

if (logLevel == 'info') {
  console.log('Eagerly compiling:', files)
}

const extensions = (allowJs ? ['.js', '.jsx'] : []).concat(['.ts', '.tsx'])

const defaultEsbuildOptions = {
  tsconfig: tsconfig || undefined,
  target: 'node' + process.versions.node.split('.')[0],
  format: 'cjs',
  sourcemap: 'inline',
  write: false,
  logLevel,
  outdir: tmpdir(), // ignored if write is false
}

// The default esbuild buffer size seems to be too small for medium-sized projects
// and node will throw ENOBUFS errors, so we increase it here to 256MB if not already set
// https://github.com/evanw/esbuild/blob/6be0962826a97dd49f6e1f4f93277442783d5257/lib/npm/node.ts#L347
if (process.env.ESBUILD_MAX_BUFFER == null) {
  process.env.ESBUILD_MAX_BUFFER = 256 * 1024 * 1024
}

const { warnings, outputFiles } = buildSync({
  ...defaultEsbuildOptions,
  entryPoints: files,
})
for (const warning of warnings) {
  console.error(warning.location)
  console.error(warning.text)
}

const fileContents = (outputFiles || []).reduce((map, { contents }, ix) => map.set(files[ix], contents), new Map())

const decoder = new TextDecoder('utf-8')

const retrieveFile = (path) => {
  let js = fileContents.get(path)
  if (js != null && typeof js !== 'string') {
    js = decoder.decode(js)
    fileContents.set(path, js)
  }
  return js
}

let tsNodeService

const compile = (code, filename) => {
  if (!fileContents.has(filename)) {
    const { warnings, outputFiles } = buildSync({
      ...defaultEsbuildOptions,
      stdin: {
        loader: extname(filename).slice(1),
        sourcefile: filename,
        contents: code,
      },
    })
    for (const warning of warnings) {
      console.error(warning.location)
      console.error(warning.text)
    }
    const { contents } = (outputFiles || [])[0] || {}
    if (contents != null) {
      fileContents.set(filename, contents)
    }
  }
  if (emitDecoratorMetadata) {
    const js = retrieveFile(filename)
    if (/^var __decorate(Class|Param)? = /m.test(js) && !/^var __metadata = /m.test(js)) {
      if (tsNodeService == null) {
        const { create } = require('ts-node')
        tsNodeService = create({ transpileOnly: true, compilerOptions, skipProject: !!compilerOptions })
      }
      fileContents.set(filename, tsNodeService.compile(code, filename))
    }
  }
  return retrieveFile(filename)
}

let requireExtensions
try {
  requireExtensions = require.extensions
} catch (e) {
  console.error('Could not register extension')
  throw e
}

const shouldIgnore = (relname) => {
  const path = relname.replace(/\\/g, '/')
  return ignores.some((x) => x.test(path))
}

const origJsHandler = requireExtensions['.js']

const registerExtension = (ext, compile) => {
  const origHandler = requireExtensions[ext] || origJsHandler
  requireExtensions[ext] = function (module, filename) {
    if (shouldIgnore(filename)) {
      return origHandler(module, filename)
    }
    const code = readFileSync(filename, 'utf8')
    return module._compile(compile(code, filename), filename)
  }
}

sourceMapSupport.install({ retrieveFile, environment: 'node', handleUncaughtExceptions: false })

extensions.forEach((ext) => registerExtension(ext, compile))

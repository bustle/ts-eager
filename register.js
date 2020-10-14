/* eslint-disable no-console */
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
try {
  const { sys, findConfigFile, readConfigFile, parseJsonConfigFileContent } = require('typescript')

  tsconfig = findConfigFile('.', sys.fileExists, tsconfigName)
  const parsedConfig = parseJsonConfigFileContent(readConfigFile(tsconfig, sys.readFile).config, sys, '.')

  basePath = dirname(tsconfig)
  files = parsedConfig.fileNames
  allowJs = !!parsedConfig.options.allowJs
  emitDecoratorMetadata = !!parsedConfig.options.emitDecoratorMetadata

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

const { warnings, outputFiles } = buildSync({
  ...defaultEsbuildOptions,
  entryPoints: files,
})
for (const warning of warnings) {
  console.error(warning.location)
  console.error(warning.text)
}

const fileContents = outputFiles.reduce((map, { contents }, ix) => map.set(files[ix], contents), new Map())

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
    fileContents.set(filename, outputFiles[0].contents)
  }
  if (emitDecoratorMetadata) {
    const js = retrieveFile(filename)
    if (js.includes('var __decorate = ') && !js.includes('var __metadata = ')) {
      if (tsNodeService == null) {
        tsNodeService = require('ts-node').create({ transpileOnly: true })
      }
      fileContents.set(filename, tsNodeService.compile(code, filename))
    }
  }
  return retrieveFile(filename)
}

let requireExtensions = {}
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
  requireExtensions[ext] = function (mod, filename) {
    if (!shouldIgnore(filename)) {
      const _compile = mod._compile
      mod._compile = function (code, filename) {
        return _compile.call(this, compile(code, filename), filename)
      }
    }
    return origHandler(mod, filename)
  }
}

sourceMapSupport.install({ retrieveFile })

extensions.forEach((ext) => registerExtension(ext, compile))

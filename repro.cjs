// node repro.cjs [control|rule-gained|rule-lost|removed] [--webpack]
const path = require('node:path')
const useWebpack = process.argv.includes('--webpack')
const bundler = useWebpack ? require('webpack') : require('@rspack/core').rspack
const cases = process.argv.slice(2).filter((a) => !a.startsWith('--'))

const state = (globalThis.state = { pre: new Set(), drop: false })

// [state for the first build, state change before the rebuild, modules to rebuild]
const CASES = {
  control: [() => {}, () => {}, ['a.js']],
  // a.js starts / stops matching the second rule
  'rule-gained': [() => {}, () => state.pre.add('a.js'), ['a.js']],
  'rule-lost': [() => state.pre.add('a.js'), () => state.pre.delete('a.js'), ['a.js']],
  // a.js's new output no longer imports h.js (its only importer)
  removed: [() => {}, () => (state.drop = true), ['a.js', 'h.js']],
}

async function run(name) {
  const [initial, change, names] = CASES[name]
  state.pre.clear()
  state.drop = false
  initial()

  const compiler = bundler({
    mode: 'development',
    context: __dirname,
    entry: './src/entry.js',
    devtool: false,
    cache: true,
    output: { path: path.join(__dirname, 'dist') },
    module: {
      rules: [
        { test: /\.js$/, use: [require.resolve('./loader.cjs')] },
        // a rule whose match depends on plugin state
        {
          test: (file) => state.pre.has(path.basename(file)),
          use: [require.resolve('./loader.cjs')],
        },
      ],
    },
  })

  let rebuild = false
  compiler.hooks.finishMake.tapPromise('repro', async (compilation) => {
    if (!rebuild) {
      return
    }
    change()
    const byName = new Map(
      [...compilation.modules].map((m) => [path.basename(m.resource ?? ''), m]),
    )
    const fired = []
    const calls = names.map(
      (n) =>
        new Promise((done) =>
          compilation.rebuildModule(byName.get(n), (err) => {
            fired.push(n + (err ? ` (error: ${err.message})` : ''))
            done()
          }),
        ),
    )
    const timedOut = await Promise.race([
      Promise.all(calls).then(() => false),
      new Promise((r) => setTimeout(() => r(true), 3000)),
    ])
    const missing = names.filter((n) => !fired.some((f) => f.startsWith(n)))
    console.log(
      `${name.padEnd(12)} rebuildModule(${names.join(', ')}) -> callbacks: [${fired}]` +
        (timedOut ? `  NEVER CALLED: [${missing}]` : '  ok'),
    )
  })

  const build = () =>
    new Promise((resolve, reject) => compiler.run((err) => (err ? reject(err) : resolve())))
  await build() // first build
  rebuild = true
  await build() // second build: rebuildModule at finishMake
  await new Promise((r) => compiler.close(r))
}

;(async () => {
  for (const name of cases.length ? cases : Object.keys(CASES)) {
    await run(name)
  }
  process.exit(0)
})()

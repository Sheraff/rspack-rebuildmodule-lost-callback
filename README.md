# rspack: `rebuildModule` callback never called

Issue: (link added once filed)

`compilation.rebuildModule(module, callback)` called from `finishMake` never calls `callback` when the module
starts or stops matching a rule, or when two modules are rebuilt in one tick and one rebuild drops the other.

```sh
npm install
node repro.cjs            # @rspack/core
node repro.cjs --webpack  # same files on webpack
```

`@rspack/core` 2.3.2:

```
control      rebuildModule(a.js) -> callbacks: [a.js]  ok
rule-gained  rebuildModule(a.js) -> callbacks: []  NEVER CALLED: [a.js]
rule-lost    rebuildModule(a.js) -> callbacks: []  NEVER CALLED: [a.js]
removed      rebuildModule(a.js, h.js) -> callbacks: [a.js]  NEVER CALLED: [h.js]
```

webpack 5.112.2: all four `ok`.

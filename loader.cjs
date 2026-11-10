// Drops a.js's import of h.js when the "drop" case is on.
module.exports = function (source) {
  if (globalThis.state.drop && this.resourcePath.endsWith('a.js')) {
    return 'export const a = 2\n'
  }
  return source
}

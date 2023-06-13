// isomorphic webcrypto
// https://stackoverflow.com/a/70981544/13065068
export default globalThis.crypto ||
  (await import("node:crypto")).default.webcrypto;

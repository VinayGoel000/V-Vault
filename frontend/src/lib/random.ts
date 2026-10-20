export function randomUUID(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  const values = new Uint32Array(2);
  globalThis.crypto.getRandomValues(values);
  return `${Date.now()}-${values.join("-")}`;
}

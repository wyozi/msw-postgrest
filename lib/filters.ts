import { parseSelectString } from "./selection";

export function parseFilter(filter: string): (input: string) => boolean {
  if (filter.startsWith("eq.")) {
    return (input) => input === filter.substring(3);
  } else {
    throw new Error("unknown filter " + filter);
  }
}

export function extractKey(object: Record<string, any>, key: string) {
  const sel = parseSelectString(key);
  if (sel.length !== 1) {
    throw new Error("invalid key " + key);
  }

  const selKey = sel[0];
  if (!("column" in selKey)) {
    throw new Error("invalid key " + key);
  }

  if ("json" in selKey) {
    return object[selKey.column][selKey.json!.path];
  } else {
    return object[selKey.column];
  }
}

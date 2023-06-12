type Column =
  | { star: true }
  | {
      column: string;
      alias?: string;
      json?: { path: string; type: "json" | "text" };
    }
  | { relation: string; cols: Column[]; alias?: string };

/**
 * Parses postgrest selection strings.
 *
 * For example:
 * - *
 * - id, name, date_of_birth
 * - id, obj->>supervisor, obj->>employerName
 * - name, industry:industries(name, companies(name))
 */
export function parseSelectString(select: string): Column[] {
  const tokens = tokenize(select);
  const tokenIterator = tokens[Symbol.iterator]();

  function* parse(): any {
    while (true) {
      const { value, done } = tokenIterator.next();
      if (done) {
        break;
      }
      if (value === ")") {
        break;
      }

      if (value === "*") {
        yield { star: true } as const;
        tokenIterator.next(); // TODO check if comma
      } else {
        let colName = value;
        let alias;

        let { value: nextValue, done: nextDone } = tokenIterator.next();
        if (nextValue === ":") {
          ({ value: nextValue, done: nextDone } = tokenIterator.next());

          alias = colName;
          colName = nextValue;

          ({ value: nextValue, done: nextDone } = tokenIterator.next());
        }

        if (nextValue === "!") {
          // skip over !fkey or !inner
          ({ value: nextValue, done: nextDone } = tokenIterator.next());
          ({ value: nextValue, done: nextDone } = tokenIterator.next());
        }
        if (nextValue === "!") {
          // skip over !fkey or !inner
          ({ value: nextValue, done: nextDone } = tokenIterator.next());
          ({ value: nextValue, done: nextDone } = tokenIterator.next());
        }

        if (nextValue === "(") {
          yield {
            relation: colName,
            ...(alias && { alias }),
            cols: Array.from(parse()),
          };
          ({ value: nextValue, done: nextDone } = tokenIterator.next());
        } else if (nextValue === "->" || nextValue === "->>") {
          const returnJson = nextValue === "->";
          ({ value: nextValue, done: nextDone } = tokenIterator.next());
          yield {
            column: colName,
            ...(alias && { alias }),
            json: { path: nextValue, type: returnJson ? "json" : "text" },
          };

          ({ value: nextValue, done: nextDone } = tokenIterator.next());
        } else {
          yield { column: colName, ...(alias && { alias }) };
        }

        if (nextValue === ")") {
          break;
        }
      }
    }
  }

  return Array.from(parse());
}

function tokenize(select: string) {
  const REGEX = /(\*|,|:|!|\w+|\(|\)|->>|->|"[^"]*")/g;

  const tokens = [];

  let match;
  while ((match = REGEX.exec(select))) {
    tokens.push(match[1]);
  }

  return tokens;
}

// in-source test suites
if (import.meta.vitest) {
  const { it, expect } = import.meta.vitest;
  it("parseSelectString", () => {
    expect(parseSelectString("*")).toEqual([{ star: true }]);
    expect(parseSelectString("a,b")).toEqual([
      { column: "a" },
      { column: "b" },
    ]);
    expect(parseSelectString("*, rel(name)")).toEqual([
      { star: true },
      { relation: "rel", cols: [{ column: "name" }] },
    ]);
    expect(parseSelectString("obj->>data")).toEqual([
      { column: "obj", json: { path: "data", type: "text" } },
    ]);
    expect(parseSelectString("renamed:col")).toEqual([
      { column: "col", alias: "renamed" },
    ]);
    expect(parseSelectString("renamed:rel(newname:name)")).toEqual([
      {
        relation: "rel",
        alias: "renamed",
        cols: [{ column: "name", alias: "newname" }],
      },
    ]);
    expect(
      parseSelectString(
        "project_end, companies!sites_company_key_fkey(id, credentials!inner(client_id,client_secret)), worksites!inner(worksite_id), alt_companies!inner(company_id)"
      )
    ).toEqual([
      { column: "project_end" },
      {
        relation: "companies",
        cols: [
          { column: "id" },
          {
            relation: "credentials",
            cols: [{ column: "client_id" }, { column: "client_secret" }],
          },
        ],
      },
      {
        relation: "worksites",
        cols: [{ column: "worksite_id" }],
      },
      {
        relation: "alt_companies",
        cols: [{ column: "company_id" }],
      },
    ]);
  });
  it("tokenize", () => {
    expect(tokenize("a,b,c")).toEqual(["a", ",", "b", ",", "c"]);
    expect(tokenize("*,name")).toEqual(["*", ",", "name"]);
    expect(tokenize("*, rel(name)")).toEqual([
      "*",
      ",",
      "rel",
      "(",
      "name",
      ")",
    ]);
    expect(tokenize("col,json->>aJsonField")).toEqual([
      "col",
      ",",
      "json",
      "->>",
      "aJsonField",
    ]);
  });
}

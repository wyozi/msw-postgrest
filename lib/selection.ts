export type Column =
  /**
   * Star ('*')
   */
  | { star: true }
  /**
   * A column (or a jsonb path) reference
   *
   * For example: "name" or "jsonCol->>jsonObject"
   */
  | {
      column: string;
      alias?: string;
      json?: { path: string; type: "json" | "text" };
    }
  /**
   * A table reference.
   *
   * For example: "users(id, name)"
   */
  | { relation: string; cols: Column[]; alias?: string };

/**
 * Parses postgrest selection strings.
 *
 * For example:
 * - *
 * - id, name, date_of_birth
 * - id, obj->>supervisor, obj->>employerName
 * - name, industry:industries(name, companies(name))
 *
 * @param select select string to parse
 * @returns array of columns
 */
export function parseSelectString(select: string): Column[] {
  const tokens = tokenize(select);
  const tokenIterator = createTokenIterator(tokens);

  /**
   * Parse a singular tokenstream (i.e. contents inside parens).
   * New left parenthesis will start a new stream
   */
  function* parse(level = 0): Iterable<Column> {
    while (true) {
      let value = tokenIterator.next();
      if (tokenIterator.done) {
        break;
      }

      // break out of parse context
      if (value === ")") {
        if (level === 0) {
          throw new ParseError("too many right parenthesis found");
        }
        return;
      }

      if (value === "*") {
        yield { star: true };
        tokenIterator.expect(",", { acceptEOF: true });
      } else {
        // this looks like a named column

        let colName = value;
        let alias = null;

        let columnDecorator = tokenIterator.next();

        // aliased column; set alias and read the actual column name
        if (columnDecorator === ":") {
          alias = colName;
          colName = tokenIterator.next();

          columnDecorator = tokenIterator.next();
        }

        // skip over hints; not processed at the moment
        while (columnDecorator === "!") {
          tokenIterator.next(); // hint name

          columnDecorator = tokenIterator.next();
        }

        // new parsing context (= parenthesis)
        if (columnDecorator === "(") {
          yield {
            relation: colName,
            ...(alias && { alias }),
            cols: Array.from(parse(level + 1)),
          };

          columnDecorator = tokenIterator.next();
        } else if (columnDecorator === "->" || columnDecorator === "->>") {
          const returnJson = columnDecorator === "->";
          columnDecorator = tokenIterator.next();
          yield {
            column: colName,
            ...(alias && { alias }),
            json: { path: columnDecorator, type: returnJson ? "json" : "text" },
          };

          columnDecorator = tokenIterator.next();
        } else {
          yield { column: colName, ...(alias && { alias }) };
        }

        // break out of parse context
        if (columnDecorator === ")") {
          if (level === 0) {
            throw new ParseError("too many right parenthesis found");
          }
          return;
        }
      }
    }
  }

  return Array.from(parse());
}

/**
 * Something went wrong with parsing select string
 */
export class ParseError extends Error {
  constructor(message: string) {
    super(message);
  }
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

function createTokenIterator(tokens: string[]) {
  const it = tokens[Symbol.iterator]();

  let iteratorDone = false;
  return {
    /**
     * Whether iterator is done
     */
    get done() {
      return iteratorDone;
    },
    /**
     * @returns next token in token stream
     */
    next(): string {
      const { value, done } = it.next();
      iteratorDone = done || false;
      return value;
    },
    /**
     * Returns current context/parser state for
     * nice error display purposes
     */
    context() {},
    /**
     * get next token and expect it to match given token
     */
    expect(expected: string, opts?: { acceptEOF?: boolean }) {
      const v = this.next();
      if (this.done && opts?.acceptEOF) {
        return;
      }
      if (v !== expected) {
        throw new ParseError(`expected ${expected}, got ${v}`);
      }
    },
  };
}

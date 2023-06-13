import crypto from "./crypto";

export type Row = Record<string, any>;
type Table = Array<Row>;

export type Schema = Record<
  string,
  Record<string, { type: "uuid" | "text" | "number"; autoGenerate?: boolean }>
>;

export class MSWPostgrestDatabase {
  private data: Record<string, Table> = {};
  private resolvers: Array<{
    from: string;
    to: string;
    resolver: (fromRow: Row, target: Table) => Row | Row[] | null;
  }> = [];

  constructor(private schema?: Schema) {}

  /**
   * Completely empty the database and relationship resolvers
   */
  clear() {
    this.data = {};
    this.resolvers = [];
  }

  select(table: string): Table {
    return this.data[table] || [];
  }

  insert(table: string, row: Row): Row {
    this.data[table] = this.data[table] || [];

    const tableSchema = this.schema?.[table];
    if (tableSchema) {
      for (const [col, colSchema] of Object.entries(tableSchema)) {
        if (colSchema.autoGenerate && row[col] === undefined) {
          if (colSchema.type === "number") {
            row[col] = this.data[table].length + 1;
          } else {
            row[col] = crypto.randomUUID();
          }
        }
      }
    }

    this.data[table].push(row);
    return row;
  }

  addRelationshipResolver(
    fromTable: string,
    toTable: string,
    resolver: (fromRow: Row, target: Table) => Row | Row[] | null
  ) {
    this.resolvers.push({ from: fromTable, to: toTable, resolver });
  }

  resolveRelationship(fromTable: string, toTable: string, fromRow: Row) {
    const resolver = this.resolvers.find(
      (r) => r.from === fromTable && r.to === toTable
    )?.resolver;
    return resolver?.(fromRow, this.data[toTable] || []);
  }
}

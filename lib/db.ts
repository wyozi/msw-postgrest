export type Row = Record<string, any>;
type Table = Array<Row>;

export class MSWPostgrestDatabase {
  private data: Record<string, Table> = {};
  private resolvers: Array<{
    from: string;
    to: string;
    resolver: (fromRow: Row, target: Table) => Row | Row[] | null;
  }> = [];

  /**
   * Completely empty the database and relationship resolvers
   */
  clear() {
    this.data = {};
    this.resolvers = [];
  }

  select(table: string): Table {
    return this.data[table];
  }

  insert(table: string, row: Row) {
    this.data[table] = this.data[table] || [];
    this.data[table].push(row);
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

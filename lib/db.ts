type Row = Record<string, any>;
type Table = Array<Row>;

export class MSWPostgrestDatabase {
  private data: Record<string, Table> = {};

  /**
   * Completely empty the database and relationship resolvers
   */
  clear() {
    this.data = {};
    // this.relResolvers = {};
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
    resolver: (fromRow: Row, target: Table) => Row[]
  ) {}
}

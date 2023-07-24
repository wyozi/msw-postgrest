import type { GetResult } from "@supabase/postgrest-js/dist/module/select-query-parser";
import type {
  GenericSchema,
  GenericTable,
  GenericView,
} from "@supabase/postgrest-js/dist/module/types";

export class PostgrestMock<
  Schema extends GenericSchema,
  Relation extends GenericTable | GenericView,
  Relationships = Relation extends { Relationships: infer R } ? R : unknown,
  ResultOne = unknown
> {
  constructor(public relation: string) {}
  operation: "insert" | "delete" | "update" | "upsert" | "select" = "select";

  replyFun: any;
  body?: any;

  select<
    Query extends string = "*",
    ResultOne = GetResult<Schema, Relation["Row"], Relationships, Query>
  >(
    columns?: Query
  ): PostgrestMock<Schema, Relation, Relationships, ResultOne> {
    return this as any;
  }

  insert(): PostgrestMock<Schema, Relation, Relationships, unknown> {
    this.operation = "insert";
    return this;
  }

  update(): PostgrestMock<Schema, Relation, Relationships, unknown> {
    this.operation = "update";
    return this;
  }

  upsert(): PostgrestMock<Schema, Relation, Relationships, unknown> {
    this.operation = "upsert";
    return this;
  }

  delete(): PostgrestMock<Schema, Relation, Relationships, unknown> {
    this.operation = "delete";
    return this;
  }

  reply(
    fun: () => ResultOne | ResultOne[]
  ): PostgrestMock<Schema, Relation, Relationships, ResultOne> {
    this.replyFun = fun;
    return this as any;
  }
}

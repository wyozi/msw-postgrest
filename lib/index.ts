import type { GenericSchema } from "@supabase/postgrest-js/dist/module/types";
import { DefaultBodyType, MockedRequest, RestHandler, rest } from "msw";
import { PostgrestMock } from "./mock";

class MswPostgrestClient<Schema extends GenericSchema = any> {
  private mockQueue: PostgrestMock<any, any>[] = [];

  from<
    TableName extends string & keyof Schema["Tables"],
    Table extends Schema["Tables"][TableName]
  >(relation: TableName): PostgrestMock<Schema, Table>;
  from<
    ViewName extends string & keyof Schema["Views"],
    View extends Schema["Views"][ViewName]
  >(relation: ViewName): PostgrestMock<Schema, View>;
  from(relation: string): PostgrestMock<Schema, any>;
  /**
   * Perform a query on a table or a view.
   *
   * @param relation - The table or view name to query
   */
  from(relation: string): PostgrestMock<Schema, any> {
    const mock = new PostgrestMock<Schema, any>(relation);
    this.mockQueue.push(mock);
    return mock;
  }

  popFirstMatching(
    matcher: (mock: PostgrestMock<Schema, any>) => boolean
  ): PostgrestMock<Schema, any> | null {
    const i = this.mockQueue.findIndex(matcher);
    if (i !== -1) {
      return this.mockQueue.splice(i, 1)[0];
    } else {
      return null;
    }
  }
}

export function mswPostgrest<
  Database = any,
  SchemaName extends string & keyof Database = "public" extends keyof Database
    ? "public"
    : string & keyof Database,
  Schema extends GenericSchema = Database[SchemaName] extends GenericSchema
    ? Database[SchemaName]
    : any
>(
  { postgrestUrl, schema } = {
    postgrestUrl: "http://localhost:54321",
  } as { postgrestUrl: string; schema?: SchemaName }
): {
  mock: MswPostgrestClient<Schema>;
  workers: Array<RestHandler<MockedRequest<DefaultBodyType>>>;
} {
  // remove final slashes if provided
  postgrestUrl = postgrestUrl.replace(/\/+$/, "");

  const mock = new MswPostgrestClient<Schema>();

  const workers = [
    rest.get(`${postgrestUrl}/:table`, async (req, res, ctx) => {
      const table = req.params.table;

      const match = mock.popFirstMatching(
        (m) => m.relation === table && m.operation === "select"
      );
      if (match) {
        return res(ctx.json(match.replyFun()));
      } else {
        return res(
          ctx.json({ message: "no msw-postgrest match found" }),
          ctx.status(400)
        );
      }
    }),
    rest.patch(`${postgrestUrl}/:table`, async (req, res, ctx) => {
      const table = req.params.table;

      const match = mock.popFirstMatching(
        (m) => m.relation === table && m.operation === "update"
      );
      if (match) {
        match.body = await req.json();
        return res(ctx.json(match.replyFun()));
      } else {
        return res(
          ctx.json({ message: "no msw-postgrest match found" }),
          ctx.status(400)
        );
      }
    }),
    rest.post(`${postgrestUrl}/:table`, async (req, res, ctx) => {
      const table = req.params.table;

      const match = mock.popFirstMatching(
        (m) => m.relation === table && m.operation === "insert"
      );
      if (match) {
        match.body = await req.json();
        return res(ctx.json(match.replyFun()));
      } else {
        return res(
          ctx.json({ message: "no msw-postgrest match found" }),
          ctx.status(400)
        );
      }
    }),
  ];

  return { mock, workers };
}

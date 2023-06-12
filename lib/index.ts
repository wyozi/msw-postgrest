import { DefaultBodyType, MockedRequest, RestHandler, rest } from "msw";
import { MSWPostgrestDatabase } from "./db";

export function mswPostgrest(
  { postgrestUrl } = {
    postgrestUrl: "http://localhost:54321",
  }
): {
  database: MSWPostgrestDatabase;
  workers: Array<RestHandler<MockedRequest<DefaultBodyType>>>;
} {
  const database = new MSWPostgrestDatabase();
  const workers = [
    rest.get(`${postgrestUrl}/:table`, async (req, res, ctx) => {
      const table = req.params.table;
      return res(ctx.json(database.select(table as string)));
    }),
    rest.post(`${postgrestUrl}/:table`, async (req, res, ctx) => {
      const table = req.params.table;

      let rows = await req.json();
      rows = Array.isArray(rows) ? rows : [rows];

      for (const row of rows) {
        database.insert(table as string, row);
      }

      const searchParams = req.url.searchParams;
      if (searchParams.has("select")) {
        const select = searchParams.get("select");
        return res(ctx.json(rows));
      }

      return res(ctx.json(null));
    }),
  ];
  return { database, workers };
}

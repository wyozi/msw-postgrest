import { DefaultBodyType, MockedRequest, RestHandler, rest } from "msw";
import { MSWPostgrestDatabase } from "./db";
import { extractKey, parseFilter } from "./filters";
import { parseSelectString } from "./selection";

export function mswPostgrest(
  { postgrestUrl } = {
    postgrestUrl: "http://localhost:54321",
  }
): {
  database: MSWPostgrestDatabase;
  workers: Array<RestHandler<MockedRequest<DefaultBodyType>>>;
} {
  if (postgrestUrl.endsWith("/")) {
    throw new Error(
      "postgrestUrl should not end in a slash (we add it manually)"
    );
  }

  const database = new MSWPostgrestDatabase();
  const workers = [
    rest.get(`${postgrestUrl}/:table`, async (req, res, ctx) => {
      const table = req.params.table;

      const colsAndFilters = Array.from(req.url.searchParams.entries())
        .filter(([col]) => col !== "select")
        .map(([col, fstr]) => [col, parseFilter(fstr)] as const);

      const select = req.url.searchParams.has("select")
        ? parseSelectString(req.url.searchParams.get("select") as string)
        : [{ star: true } as const];

      let rows = database.select(table as string);

      rows = rows.filter((r) => {
        return colsAndFilters.every(([col, filter]) =>
          filter(extractKey(r, col))
        );
      });

      rows = rows.map((r) => {
        const row = {};
        for (const sel of select) {
          if ("star" in sel) {
            Object.assign(row, r);
          } else if ("column" in sel) {
            (row as any)[sel.column] = r[sel.column];
          }
        }
        return row;
      });

      return res(ctx.json(rows));
    }),
    rest.patch(`${postgrestUrl}/:table`, async (req, res, ctx) => {
      const table = req.params.table;

      const updateData = await req.json();

      const colsAndFilters = Array.from(req.url.searchParams.entries()).map(
        ([col, fstr]) => [col, parseFilter(fstr)] as const
      );

      for (const row of database.select(table as string)) {
        if (
          colsAndFilters.every(([col, filter]) => {
            return filter(extractKey(row, col));
          })
        ) {
          for (const [k, v] of Object.entries(updateData)) {
            row[k] = v; // todo do this immutably
          }
        }
      }

      return res(ctx.json(null));
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

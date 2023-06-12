import { DefaultBodyType, MockedRequest, RestHandler, rest } from "msw";
import { MSWPostgrestDatabase, Row } from "./db";
import { extractKey, parseFilter } from "./filters";
import { Column, parseSelectString } from "./selection";

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

      let rows = database.select(table as string);

      const colsAndFilters = Array.from(req.url.searchParams.entries())
        .filter(([col]) => col !== "select")
        .map(([col, fstr]) => [col, parseFilter(fstr)] as const);
      rows = rows.filter((r) => {
        return colsAndFilters.every(([col, filter]) =>
          filter(extractKey(r, col))
        );
      });

      const select = req.url.searchParams.has("select")
        ? parseSelectString(req.url.searchParams.get("select") as string)
        : [{ star: true } as const];
      rows = rows.map((r) => {
        return selectColumns(database, select, table as string, r);
      });

      return res(ctx.json(rows));
    }),
    rest.patch(`${postgrestUrl}/:table`, async (req, res, ctx) => {
      const table = req.params.table;

      const updateData = await req.json();

      let rows = database.select(table as string);

      const colsAndFilters = Array.from(req.url.searchParams.entries())
        .filter(([col]) => col !== "select")
        .map(([col, fstr]) => [col, parseFilter(fstr)] as const);
      rows = rows.filter((r) => {
        return colsAndFilters.every(([col, filter]) =>
          filter(extractKey(r, col))
        );
      });

      const select = req.url.searchParams.has("select")
        ? parseSelectString(req.url.searchParams.get("select") as string)
        : [{ star: true } as const];
      rows = rows.map((r) => {
        for (const [k, v] of Object.entries(updateData)) {
          r[k] = v; // todo do this immutably
        }

        return selectColumns(database, select, table as string, r);
      });

      return res(ctx.json(rows));
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

export function selectColumns(
  db: MSWPostgrestDatabase,
  cols: Column[],
  table: string,
  orig: Row
): Row {
  const row = {};
  for (const col of cols) {
    if ("star" in col) {
      Object.assign(row, orig);
    } else if ("column" in col) {
      (row as any)[col.alias || col.column] = orig[col.column];
    } else if ("relation" in col) {
      const resolved = db.resolveRelationship(table, col.relation, orig);

      let data = null;
      if (Array.isArray(resolved)) {
        data = resolved.map((r) =>
          selectColumns(db, col.cols, col.relation, r)
        );
      } else if (resolved) {
        data = selectColumns(db, col.cols, col.relation, resolved);
      }
      (row as any)[col.alias || col.relation] = data;
    }
  }
  return row;
}

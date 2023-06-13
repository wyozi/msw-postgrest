import { DefaultBodyType, MockedRequest, RestHandler, rest } from "msw";
import { MSWPostgrestDatabase, Row } from "./db";
import { extractKey, parseFilter } from "./filters";
import { Column, parseSelectString } from "./selection";

function parseSearchParams(usp: URLSearchParams) {
  const colsAndFilters = Array.from(usp.entries())
    .filter(([col]) => col !== "select" && col !== "order" && col !== "limit")
    .map(([col, fstr]) => [col, parseFilter(fstr)] as const);

  return {
    filters: colsAndFilters,
    select: usp.has("select")
      ? parseSelectString(usp.get("select") as string)
      : null,
    limit: usp.has("limit") ? parseInt(usp.get("limit") as string, 10) : null,
  };
}

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
      const params = parseSearchParams(req.url.searchParams);

      let rows = database.select(table as string);
      rows = rows.filter((r) => {
        return params.filters.every(([col, filter]) =>
          filter(extractKey(r, col))
        );
      });

      if (params.limit !== null) {
        rows = rows.slice(0, params.limit);
      }

      if (params.select) {
        const sel = params.select;
        rows = rows.map((r) => {
          return selectColumns(database, sel, table as string, r);
        });
      } else {
        rows = [];
      }

      if (req.headers.get("accept") === "application/vnd.pgrst.object+json") {
        if (rows.length !== 1) {
          return res(
            ctx.json({ message: "returned rows is not one" }), // TODO proper postgest error message
            ctx.status(400)
          );
        }
        return res(ctx.json(rows[0]));
      }

      return res(ctx.json(rows));
    }),
    rest.patch(`${postgrestUrl}/:table`, async (req, res, ctx) => {
      const table = req.params.table;
      const params = parseSearchParams(req.url.searchParams);

      const updateData = await req.json();

      let rows = database.select(table as string);
      rows = rows.filter((r) => {
        return params.filters.every(([col, filter]) =>
          filter(extractKey(r, col))
        );
      });

      if (params.limit !== null) {
        rows = rows.slice(0, params.limit);
      }

      for (const row of rows) {
        for (const [k, v] of Object.entries(updateData)) {
          row[k] = v; // todo do this immutably
        }
      }

      if (params.select) {
        const sel = params.select;
        rows = rows.map((r) => {
          return selectColumns(database, sel, table as string, r);
        });
      } else {
        rows = [];
      }

      if (req.headers.get("accept") === "application/vnd.pgrst.object+json") {
        if (rows.length !== 1) {
          return res(
            ctx.json({ message: "returned rows is not one" }), // TODO proper postgest error message
            ctx.status(400)
          );
        }
        return res(ctx.json(rows[0]));
      }

      return res(ctx.json(rows));
    }),
    rest.post(`${postgrestUrl}/:table`, async (req, res, ctx) => {
      const table = req.params.table;

      let rows: any[] = await req.json();
      rows = Array.isArray(rows) ? rows : [rows];

      for (const row of rows) {
        database.insert(table as string, row);
      }

      const params = parseSearchParams(req.url.searchParams);

      if (params.limit !== null) {
        rows = rows.slice(0, params.limit);
      }

      if (params.select) {
        const sel = params.select;
        rows = rows.map((r) => {
          return selectColumns(database, sel, table as string, r);
        });
      } else {
        rows = [];
      }

      if (req.headers.get("accept") === "application/vnd.pgrst.object+json") {
        if (rows.length !== 1) {
          return res(
            ctx.json({ message: "returned rows is not one" }), // TODO proper postgest error message
            ctx.status(400)
          );
        }
        return res(ctx.json(rows[0]));
      }

      return res(ctx.json(rows));
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
      if ("json" in col) {
        (row as any)[col.alias || col.json!.path] =
          orig[col.column][col.json!.path];
      } else {
        (row as any)[col.alias || col.column] = orig[col.column];
      }
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

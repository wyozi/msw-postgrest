import { PostgrestClient } from "@supabase/postgrest-js";
import { setupServer } from "msw/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { mswPostgrest } from ".";

const POSTGREST_URL = "http://localhost";

const { database, workers } = mswPostgrest({ postgrestUrl: POSTGREST_URL });
const server = setupServer(...workers);

// Ideally you'd move this to a setupTests file
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("msw-postgrest", () => {
  const postgrest = new PostgrestClient(POSTGREST_URL);
  beforeEach(() => {
    database.clear();
  });

  describe("insertions", () => {
    it("insert single items", async () => {
      await postgrest.from("tasks").insert({ item: "do chores" });
      expect(database.select("tasks")).toEqual([{ item: "do chores" }]);
    });
    it("insert multi items", async () => {
      await postgrest
        .from("tasks")
        .insert([{ item: "do chores" }, { item: "buy apples" }]);
      expect(database.select("tasks")).toEqual([
        { item: "do chores" },
        { item: "buy apples" },
      ]);
    });
    it("insert item and return values", async () => {
      const res = await postgrest
        .from("tasks")
        .insert({ item: "do chores" })
        .select("*");
      expect(res.data).toEqual([{ item: "do chores" }]);
    });
  });
});

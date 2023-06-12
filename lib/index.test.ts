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

  describe("returns", () => {
    describe("single", () => {
      it("returns if single result", async () => {
        database.insert("tasks", { item: "empty fridge" });

        expect(
          (await postgrest.from("tasks").select("*").single()).data
        ).toEqual({ item: "empty fridge" });
      });
      it("errors if non-single result", async () => {
        database.insert("tasks", { item: "empty fridge" });
        database.insert("tasks", { item: "fill fridge" });

        expect(
          (await postgrest.from("tasks").select("*").single()).error
        ).toEqual({ message: "returned rows is not one" });
      });
    });
    describe("maybeSingle", () => {
      it("returns if no results", async () => {
        expect(
          (await postgrest.from("tasks").select("*").maybeSingle()).data
        ).toEqual(null);
      });
      it("returns if single result", async () => {
        database.insert("tasks", { item: "empty fridge" });

        expect(
          (await postgrest.from("tasks").select("*").maybeSingle()).data
        ).toEqual({ item: "empty fridge" });
      });
      it("errors if non-single result", async () => {
        database.insert("tasks", { item: "empty fridge" });
        database.insert("tasks", { item: "fill fridge" });

        expect(
          (await postgrest.from("tasks").select("*").maybeSingle()).error
        ).toEqual(
          expect.objectContaining({
            message: expect.stringContaining("multiple (or no) rows returned"),
          })
        );
      });
    });
  });

  describe("selections", () => {
    it("simple select", async () => {
      database.insert("tasks", { item: "empty fridge" });
      database.insert("tasks", { item: "go shopping" });

      expect((await postgrest.from("tasks").select("*")).data).toEqual([
        { item: "empty fridge" },
        { item: "go shopping" },
      ]);
    });
    it("selective select", async () => {
      database.insert("tasks", {
        item: "empty fridge",
        created_at: "2023-02-23",
      });
      database.insert("tasks", {
        item: "go shopping",
        created_at: "2023-05-23",
      });

      expect((await postgrest.from("tasks").select("created_at")).data).toEqual(
        [{ created_at: "2023-02-23" }, { created_at: "2023-05-23" }]
      );
    });
    it("complex filtered select", async () => {
      database.insert("tasks", {
        item: "sell curtains",
        group_id: "grp",
        meta: { tagColor: "red" },
      });
      database.insert("tasks", {
        item: "grab lemons",
        group_id: "grp",
        meta: { tagColor: "green" },
      });

      expect(
        (
          await postgrest
            .from("tasks")
            .select("item, meta->>tagColor")
            .eq("group_id", "grp")
            .eq("meta->>tagColor", "red")
        ).data
      ).toEqual([{ item: "sell curtains", meta: { tagColor: "red" } }]);
    });
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

  describe("updates", () => {
    it("update item by id", async () => {
      database.insert("tasks", { item: "mop floors", id: "1234" });
      await postgrest
        .from("tasks")
        .update({ item: "mop and wax floors" })
        .eq("id", "1234");
      expect(database.select("tasks")).toEqual([
        { item: "mop and wax floors", id: "1234" },
      ]);
    });
  });

  describe("relationships", () => {
    it("allow simple joins", async () => {
      database.insert("tasks", { item: "mop floors", assigned_to: "person-2" });
      database.insert("people", { id: "person-1", name: "Mike" });
      database.insert("people", { id: "person-2", name: "John" });
      database.addRelationshipResolver("tasks", "people", (row, target) => {
        return target.find((r) => r.id === row.assigned_to)!;
      });

      const d = (
        await postgrest.from("tasks").select("item, assignee:people(name)")
      ).data;
      expect(d).toEqual([{ item: "mop floors", assignee: { name: "John" } }]);
    });

    it("allow nested joins", async () => {
      database.insert("tasks", { item: "mop floors", assigned_to: "person-1" });
      database.insert("people", {
        id: "person-1",
        name: "Mike",
        group_id: "grp-1",
      });
      database.insert("people", { id: "person-2", name: "John" });
      database.insert("groups", { id: "grp-1", name: "Cleaning Crew" });

      database.addRelationshipResolver("tasks", "people", (row, target) => {
        return target.find((r) => r.id === row.assigned_to)!;
      });
      database.addRelationshipResolver("people", "groups", (row, target) => {
        return target.find((r) => r.id === row.group_id)!;
      });

      const d = (
        await postgrest
          .from("tasks")
          .select("item, assignee:people(name, group:groups(name))")
      ).data;
      expect(d).toEqual([
        {
          item: "mop floors",
          assignee: { name: "Mike", group: { name: "Cleaning Crew" } },
        },
      ]);
    });
  });
});

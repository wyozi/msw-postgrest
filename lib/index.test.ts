import { PostgrestClient } from "@supabase/postgrest-js";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { mswPostgrest } from ".";
import { Database } from "./database.types";

const POSTGREST_URL = "http://localhost";

const { mock, workers } = mswPostgrest<Database>({
  postgrestUrl: POSTGREST_URL,
});
const server = setupServer(...workers);

// Ideally you'd move this to a setupTests file
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("msw-postgrest", () => {
  const postgrest = new PostgrestClient(POSTGREST_URL);

  it("select works", async () => {
    mock
      .from("shops")
      .select("id, address")
      .reply(() => [{ id: 1, address: "foo" }]);

    const res = await postgrest.from("shops").select("id, address");

    expect(res.data).toEqual([{ id: 1, address: "foo" }]);
  });

  it("insert works", async () => {
    const shopsMock = mock
      .from("shops")
      .insert()
      .select("id, address")
      .reply(() => [{ id: 2, address: "foo" }]);

    const res = await postgrest
      .from("shops")
      .insert({ address: "foo" })
      .select("id, address");

    expect(shopsMock.body).toEqual({ address: "foo" });
    expect(res.data).toEqual([{ id: 2, address: "foo" }]);
  });
});

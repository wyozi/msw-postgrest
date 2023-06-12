# msw-postgrest

Easy mocking of Postgrest/Supabase servers for Mock Service Worker (MSW)

**Usage:**

```ts
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
import { mswPostgrest } from "msw-postgrest";

const POSTGREST_URL = "http://localhost";

const { database, workers } = mswPostgrest({ postgrestUrl: POSTGREST_URL });
const server = setupServer(...workers);

// Ideally you'd move this to a setupTests file
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("msw-postgrest", () => {
  const postgrest = new PostgrestClient(POSTGREST_URL);

  describe("insertions", () => {
    it("insert single items", async () => {
      await postgrest.from("tasks").insert({ item: "do chores" });
      expect(database.select("tasks")).toEqual([{ item: "do chores" }]);
    });
  });
});
```

**Usage (supabase):**

```ts
import { createClient } from "@supabase/supabase-js";
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
import { mswPostgrest } from "msw-postgrest";

const SUPABASE_URL = "http://localhost";

const { database, workers } = mswPostgrest({
  postgrestUrl: `${SUPABASE_URL}/rest/v1`,
});
const server = setupServer(...workers);

// Ideally you'd move this to a setupTests file
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("msw-postgrest", () => {
  const supa = createClient(SUPABASE_URL, "foobar");

  describe("insertions", () => {
    it("insert single items", async () => {
      await supa.from("tasks").insert({ item: "do chores" });
      expect(database.select("tasks")).toEqual([{ item: "do chores" }]);
    });
  });
});
```
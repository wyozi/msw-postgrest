# msw-postgrest

Mock Postgrest/Supabase database server with Mock Service Worker (MSW)

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

const { mock, workers } = mswPostgrest({ postgrestUrl: POSTGREST_URL });
const server = setupServer(...workers);

// Ideally you'd move this to a setupTests file
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("msw-postgrest", () => {
  const postgrest = new PostgrestClient(POSTGREST_URL);

  describe("insertions", () => {
    it("insert single items", async () => {
      mock
        .from("shops")
        .insert()
        .select("id, address")
        .reply(() => [{ id: 2, address: "foo" }]);

      const res = await postgrest
        .from("shops")
        .insert({ address: "foo" })
        .select("id, address");

      expect(res.data).toEqual([{ id: 2, address: "foo" }]);
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

const { mock, workers } = mswPostgrest({
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
      mock
        .from("shops")
        .insert()
        .select("id, address")
        .reply(() => [{ id: 2, address: "foo" }]);

      const res = await supa
        .from("shops")
        .insert({ address: "foo" })
        .select("id, address");

      expect(res.data).toEqual([{ id: 2, address: "foo" }]);
    });
  });
});
```
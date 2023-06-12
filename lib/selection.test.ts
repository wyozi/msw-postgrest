import { expect, it } from "vitest";
import { parseSelectString } from "./selection";

it("parseSelectString", () => {
  expect(parseSelectString("*")).toEqual([{ star: true }]);
  expect(parseSelectString("a,b")).toEqual([{ column: "a" }, { column: "b" }]);
  expect(parseSelectString("*, rel(name)")).toEqual([
    { star: true },
    { relation: "rel", cols: [{ column: "name" }] },
  ]);
  expect(parseSelectString("obj->>data")).toEqual([
    { column: "obj", json: { path: "data", type: "text" } },
  ]);
  expect(parseSelectString("renamed:col")).toEqual([
    { column: "col", alias: "renamed" },
  ]);
  expect(parseSelectString("renamed:rel(newname:name)")).toEqual([
    {
      relation: "rel",
      alias: "renamed",
      cols: [{ column: "name", alias: "newname" }],
    },
  ]);
  expect(
    parseSelectString(
      "project_end, companies!sites_company_key_fkey(id, credentials!inner(client_id,client_secret)), worksites!inner(worksite_id), alt_companies!inner(company_id)"
    )
  ).toEqual([
    { column: "project_end" },
    {
      relation: "companies",
      cols: [
        { column: "id" },
        {
          relation: "credentials",
          cols: [{ column: "client_id" }, { column: "client_secret" }],
        },
      ],
    },
    {
      relation: "worksites",
      cols: [{ column: "worksite_id" }],
    },
    {
      relation: "alt_companies",
      cols: [{ column: "company_id" }],
    },
  ]);
});

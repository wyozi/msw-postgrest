import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    includeSource: ["lib/**/*.{js,ts}"],
  },
});

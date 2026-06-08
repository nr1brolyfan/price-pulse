import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

const defaultDatabaseUrl = "postgresql://postgres:password@localhost:5432/price-monitor";

dotenv.config({
  path: "../../apps/server/.env",
});

export default defineConfig({
  schema: "./src/schema",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || defaultDatabaseUrl,
  },
});

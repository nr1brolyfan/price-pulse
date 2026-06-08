import "dotenv/config";

import { Config, Effect } from "effect";

const defaultDatabaseUrl = "postgresql://postgres:password@localhost:5432/price-monitor";

export const ServerConfig = Config.unwrap({
  corsOrigin: Config.string("CORS_ORIGIN").pipe(Config.withDefault("http://localhost:3001")),
  databaseUrl: Config.string("DATABASE_URL").pipe(Config.withDefault(defaultDatabaseUrl)),
  port: Config.port("PORT").pipe(Config.withDefault(3000)),
});

export const serverConfig = Effect.runSync(ServerConfig);

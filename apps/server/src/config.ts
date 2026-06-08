import "dotenv/config";

import { Config, Effect } from "effect";

export const ServerConfig = Config.unwrap({
  corsOrigin: Config.string("CORS_ORIGIN").pipe(Config.withDefault("http://localhost:3001")),
  port: Config.port("PORT").pipe(Config.withDefault(3000)),
});

export const serverConfig = Effect.runSync(ServerConfig);

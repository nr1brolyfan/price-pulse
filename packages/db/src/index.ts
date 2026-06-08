import { PgClient } from "@effect/sql-pg";
import { makeWithDefaults, type EffectPgDatabase } from "drizzle-orm/effect-postgres";
import { Context, Effect, Layer, Redacted } from "effect";

import { relations, schema } from "./schema";

export type PriceMonitorDb = EffectPgDatabase<typeof relations>;

export class Database extends Context.Service<
  Database,
  {
    readonly db: PriceMonitorDb;
  }
>()("price-monitor/Database") {}

export function DatabaseLive(options: {
  readonly databaseUrl: string;
  readonly maxConnections?: number;
}) {
  return Layer.effect(
    Database,
    Effect.map(makeWithDefaults({ relations }), (db) => ({ db })),
  ).pipe(
    Layer.provide(
      PgClient.layer({
        url: Redacted.make(options.databaseUrl),
        maxConnections: options.maxConnections ?? 10,
      }),
    ),
  );
}

export { relations, schema };

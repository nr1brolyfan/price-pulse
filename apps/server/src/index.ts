import { PriceMonitorApi } from "@price-monitor/api";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpMiddleware, HttpRouter } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { createServer } from "node:http";

import { serverConfig } from "./config";
import { PriceMonitor, ServicesLive } from "./services";

const ApiHandlersLive = HttpApiBuilder.group(PriceMonitorApi, "monitor", (handlers) =>
  handlers
    .handle("health", () =>
      Effect.gen(function* () {
        const monitor = yield* PriceMonitor;
        return yield* monitor.health;
      }),
    )
    .handle("dashboard", () =>
      Effect.gen(function* () {
        const monitor = yield* PriceMonitor;
        return yield* monitor.dashboard;
      }),
    )
    .handle("products", () =>
      Effect.gen(function* () {
        const monitor = yield* PriceMonitor;
        return yield* monitor.listProducts;
      }),
    )
    .handle("product", ({ params }) =>
      Effect.gen(function* () {
        const monitor = yield* PriceMonitor;
        return yield* monitor.getProduct(params.productId);
      }),
    )
    .handle("checkPrice", ({ params }) =>
      Effect.gen(function* () {
        const monitor = yield* PriceMonitor;
        return yield* monitor.checkPrice(params.productId);
      }),
    )
    .handle("alerts", () =>
      Effect.gen(function* () {
        const monitor = yield* PriceMonitor;
        return yield* monitor.listAlerts;
      }),
    )
    .handle("createAlert", ({ payload }) =>
      Effect.gen(function* () {
        const monitor = yield* PriceMonitor;
        return yield* monitor.createAlert(payload);
      }),
    )
    .handle("events", () =>
      Effect.gen(function* () {
        const monitor = yield* PriceMonitor;
        return yield* monitor.listEvents;
      }),
    ),
);

const ApiLive = HttpApiBuilder.layer(PriceMonitorApi, {
  openapiPath: "/openapi.json",
}).pipe(Layer.provide(ApiHandlersLive), HttpRouter.provideRequest(ServicesLive));

const allowedOrigins = Array.from(
  new Set([serverConfig.corsOrigin, "http://localhost:3001", "http://127.0.0.1:3001"]),
);

const RouterLive = Layer.mergeAll(
  HttpRouter.cors({
    allowedHeaders: ["content-type"],
    allowedMethods: ["GET", "POST", "OPTIONS"],
    allowedOrigins,
  }),
  ApiLive,
);

const ServerLive = HttpRouter.serve(RouterLive, {
  middleware: HttpMiddleware.logger,
}).pipe(Layer.provide(NodeHttpServer.layer(() => createServer(), { port: serverConfig.port })));

NodeRuntime.runMain(Layer.launch(ServerLive));

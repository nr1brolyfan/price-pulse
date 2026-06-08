import { PriceMonitorApi } from "@price-monitor/api";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { HttpApiClient } from "effect/unstable/httpapi";

import { env } from "./env";

type ApiClient = HttpApiClient.ForApi<typeof PriceMonitorApi>;

let clientPromise: Promise<ApiClient> | undefined;

const getBaseUrl = () => {
  if (typeof window !== "undefined" && import.meta.env.DEV) {
    return window.location.origin;
  }

  return env.VITE_SERVER_URL;
};

const getClient = () => {
  clientPromise ??= Effect.runPromise(
    HttpApiClient.make(PriceMonitorApi, {
      baseUrl: getBaseUrl(),
    }).pipe(Effect.provide(FetchHttpClient.layer)),
  );

  return clientPromise;
};

const runApi = async <A, E>(effect: (client: ApiClient) => Effect.Effect<A, E>) => {
  const client = await getClient();
  return Effect.runPromise(effect(client));
};

export const apiClient = {
  checkPrice: (productId: string) =>
    runApi((client) => client.monitor.checkPrice({ params: { productId } })),
  createAlert: (payload: { readonly amount: number; readonly productId: string }) =>
    runApi((client) => client.monitor.createAlert({ payload })),
  dashboard: () => runApi((client) => client.monitor.dashboard()),
  deleteAlert: (alertId: string) =>
    runApi((client) => client.monitor.deleteAlert({ params: { alertId } })),
  product: (productId: string) =>
    runApi((client) => client.monitor.product({ params: { productId } })),
};

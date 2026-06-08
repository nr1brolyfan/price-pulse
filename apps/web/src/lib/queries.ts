import { queryOptions } from "@tanstack/react-query";

import { apiClient } from "./api-client";

export const queryKeys = {
  dashboard: ["dashboard"] as const,
  product: (productId: string) => ["product", productId] as const,
};

export const dashboardQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.dashboard,
    queryFn: apiClient.dashboard,
    staleTime: 10_000,
  });

export const productQueryOptions = (productId: string) =>
  queryOptions({
    queryKey: queryKeys.product(productId),
    queryFn: () => apiClient.product(productId),
    staleTime: 10_000,
  });

export const invalidateDashboard = {
  queryKey: queryKeys.dashboard,
};

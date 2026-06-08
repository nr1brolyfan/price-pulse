import { Button } from "@price-monitor/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@price-monitor/ui/components/card";
import { Input } from "@price-monitor/ui/components/input";
import type { Alert, Dashboard, DomainEvent, Product } from "@price-monitor/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, Bell, RefreshCw, TrendingDown, Zap } from "lucide-react";
import type { FormEvent } from "react";

import { apiClient } from "../lib/api-client";
import { dashboardQueryOptions, invalidateDashboard } from "../lib/queries";

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    try {
      return await context.queryClient.ensureQueryData(dashboardQueryOptions());
    } catch {
      return undefined;
    }
  },
  component: HomeComponent,
});

const moneyFormatter = new Intl.NumberFormat("pl-PL", {
  currency: "PLN",
  maximumFractionDigits: 2,
  style: "currency",
});

const formatMoney = (amount: number) => moneyFormatter.format(amount);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(new Date(value));

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const getDashboardErrorMessage = (error: unknown) => {
  const message = getErrorMessage(error);

  if (message.includes("Transport error")) {
    return `${message}. Sprawdź, czy backend działa: pnpm dev:server albo pnpm dev.`;
  }

  return message;
};

function HomeComponent() {
  const initialDashboard = Route.useLoaderData();
  const queryClient = useQueryClient();
  const dashboardQuery = useQuery({
    ...dashboardQueryOptions(),
    initialData: initialDashboard,
  });

  const checkPriceMutation = useMutation({
    mutationFn: apiClient.checkPrice,
    onSuccess: () => queryClient.invalidateQueries(invalidateDashboard),
  });

  const createAlertMutation = useMutation({
    mutationFn: apiClient.createAlert,
    onSuccess: () => queryClient.invalidateQueries(invalidateDashboard),
  });

  const createAlert = (event: FormEvent<HTMLFormElement>, productId: string) => {
    event.preventDefault();

    const form = event.currentTarget;
    const amount = Number(new FormData(form).get("amount"));

    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    createAlertMutation.mutate(
      { amount, productId },
      {
        onSuccess: () => form.reset(),
      },
    );
  };

  if (dashboardQuery.isPending) {
    return <DashboardShell />;
  }

  if (dashboardQuery.isError) {
    return (
      <DashboardShell
        error={getDashboardErrorMessage(dashboardQuery.error)}
        onRetry={() => dashboardQuery.refetch()}
      />
    );
  }

  const dashboard = dashboardQuery.data;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 lg:py-8">
      <Hero dashboard={dashboard} />

      {(checkPriceMutation.isError || createAlertMutation.isError) && (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent>
            {checkPriceMutation.error
              ? getErrorMessage(checkPriceMutation.error)
              : getErrorMessage(createAlertMutation.error)}
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-4">
          {dashboard.products.map((product) => (
            <ProductCard
              key={product.id}
              alerts={dashboard.alerts.filter((alert) => alert.productId === product.id)}
              isChecking={
                checkPriceMutation.isPending && checkPriceMutation.variables === product.id
              }
              isCreatingAlert={
                createAlertMutation.isPending &&
                createAlertMutation.variables?.productId === product.id
              }
              product={product}
              onCheckPrice={() => checkPriceMutation.mutate(product.id)}
              onCreateAlert={(event) => createAlert(event, product.id)}
            />
          ))}
        </div>

        <aside className="grid content-start gap-4">
          <EventsCard events={dashboard.events} />
          <AlertsCard alerts={dashboard.alerts} products={dashboard.products} />
        </aside>
      </section>
    </main>
  );
}

function DashboardShell({
  error,
  onRetry,
}: {
  readonly error?: string;
  readonly onRetry?: () => void;
}) {
  return (
    <main className="mx-auto grid min-h-[70svh] w-full max-w-7xl place-items-center px-4 py-10">
      <Card className="w-full max-w-lg border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle>PricePulse</CardTitle>
          <CardDescription>{error ?? "Ładowanie danych z Effect HTTP API..."}</CardDescription>
        </CardHeader>
        {onRetry && (
          <CardContent>
            <Button type="button" onClick={onRetry}>
              Spróbuj ponownie
            </Button>
          </CardContent>
        )}
      </Card>
    </main>
  );
}

function Hero({ dashboard }: { readonly dashboard: Dashboard }) {
  const activeAlerts = dashboard.alerts.filter(
    (alert) => alert.enabled && !alert.triggeredAt,
  ).length;
  const triggeredAlerts = dashboard.alerts.length - activeAlerts;
  const priceChecks = dashboard.products.reduce((sum, product) => sum + product.history.length, 0);
  const bestDrop = Math.max(
    ...dashboard.products.map((product) =>
      product.history[0]?.amount ? product.history[0].amount - product.currentPrice.amount : 0,
    ),
  );

  return (
    <section className="overflow-hidden border bg-[radial-gradient(circle_at_top_left,_hsl(var(--primary)/0.22),_transparent_34%),linear-gradient(135deg,_hsl(var(--muted))_0%,_hsl(var(--background))_48%,_hsl(var(--card))_100%)] p-5 lg:p-7">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 border bg-background/60 px-3 py-1 font-mono text-xs uppercase tracking-[0.28em] text-muted-foreground">
            <Zap className="size-3" /> Effect v4 HTTP API
          </div>
          <div>
            <h2 className="max-w-3xl text-3xl font-semibold tracking-tight lg:text-5xl">
              Monitoring cen z typed contract i alertami
            </h2>
            <p className="mt-3 max-w-2xl text-sm/relaxed text-muted-foreground">
              Dashboard korzysta z klienta wygenerowanego z `@price-monitor/api`, a stan zapytań
              obsługuje TanStack Query.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Metric
            icon={<Activity className="size-4" />}
            label="Produkty"
            value={dashboard.products.length.toString()}
          />
          <Metric
            icon={<Bell className="size-4" />}
            label="Aktywne alerty"
            value={activeAlerts.toString()}
          />
          <Metric
            icon={<RefreshCw className="size-4" />}
            label="Pomiary"
            value={priceChecks.toString()}
          />
          <Metric
            icon={<TrendingDown className="size-4" />}
            label="Największy spadek"
            value={formatMoney(Math.max(0, bestDrop))}
          />
          <Metric
            className="col-span-2"
            icon={<Bell className="size-4" />}
            label="Uruchomione alerty"
            value={triggeredAlerts.toString()}
          />
        </div>
      </div>
    </section>
  );
}

function Metric({
  className = "",
  icon,
  label,
  value,
}: {
  readonly className?: string;
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className={`border bg-background/70 p-3 ${className}`}>
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function ProductCard({
  alerts,
  isChecking,
  isCreatingAlert,
  onCheckPrice,
  onCreateAlert,
  product,
}: {
  readonly alerts: ReadonlyArray<Alert>;
  readonly isChecking: boolean;
  readonly isCreatingAlert: boolean;
  readonly onCheckPrice: () => void;
  readonly onCreateAlert: (event: FormEvent<HTMLFormElement>) => void;
  readonly product: Product;
}) {
  const firstPrice = product.history[0]?.amount ?? product.currentPrice.amount;
  const drop = firstPrice - product.currentPrice.amount;
  const defaultAlertAmount = Math.max(1, Math.floor(product.currentPrice.amount * 0.94));

  return (
    <Card className="grid gap-0 p-0 lg:grid-cols-[240px_1fr]">
      <img
        className="h-52 w-full object-cover lg:h-full"
        src={product.imageUrl}
        alt=""
        loading="lazy"
      />
      <div className="grid gap-4 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted-foreground">
              {product.category}
            </p>
            <h3 className="mt-1 text-2xl font-semibold">{product.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Ostatnia aktualizacja: {formatDate(product.updatedAt)}
            </p>
          </div>
          <div className="text-left md:text-right">
            <p className="text-3xl font-semibold">{formatMoney(product.currentPrice.amount)}</p>
            <p className="text-xs text-muted-foreground">
              Najniższa: {formatMoney(product.lowestPrice.amount)}
            </p>
            {drop > 0 && (
              <p className="mt-1 text-xs text-emerald-500">Spadek od startu: {formatMoney(drop)}</p>
            )}
          </div>
        </div>

        <PriceChart product={product} />

        <div className="grid gap-3 md:grid-cols-[1fr_280px]">
          <div className="grid gap-2">
            {product.offers.map((offer) => (
              <div
                key={offer.id}
                className="flex items-center justify-between border bg-muted/30 px-3 py-2 text-sm"
              >
                <span>{offer.storeName}</span>
                <span className="font-medium">{formatMoney(offer.lastPrice.amount)}</span>
              </div>
            ))}
          </div>

          <div className="grid gap-2">
            <Button type="button" disabled={isChecking} onClick={onCheckPrice}>
              <RefreshCw className={isChecking ? "animate-spin" : ""} />
              {isChecking ? "Sprawdzanie..." : "Sprawdź cenę"}
            </Button>
            <form className="grid grid-cols-[1fr_auto] gap-2" onSubmit={onCreateAlert}>
              <Input
                name="amount"
                inputMode="decimal"
                min="1"
                placeholder={defaultAlertAmount.toString()}
                step="0.01"
                type="number"
              />
              <Button type="submit" variant="outline" disabled={isCreatingAlert}>
                Alert
              </Button>
            </form>
          </div>
        </div>

        {alerts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {alerts.map((alert) => (
              <span
                key={alert.id}
                className="border bg-background px-2 py-1 text-xs text-muted-foreground"
              >
                Alert {formatMoney(alert.targetPrice.amount)}{" "}
                {alert.triggeredAt ? `uruchomiony ${formatDate(alert.triggeredAt)}` : "aktywny"}
              </span>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function PriceChart({ product }: { readonly product: Product }) {
  const max = Math.max(...product.history.map((point) => point.amount));

  return (
    <div className="grid gap-2">
      <div className="flex h-28 items-end gap-2 border bg-muted/20 p-3">
        {product.history.map((point) => (
          <div key={point.checkedAt} className="flex min-w-8 flex-1 flex-col items-center gap-2">
            <div
              className="w-full bg-primary/70 transition-all"
              style={{ height: `${Math.max(8, (point.amount / max) * 100)}%` }}
              title={`${formatMoney(point.amount)} - ${formatDate(point.checkedAt)}`}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{formatDate(product.history[0]?.checkedAt ?? product.updatedAt)}</span>
        <span>{formatDate(product.updatedAt)}</span>
      </div>
    </div>
  );
}

function EventsCard({ events }: { readonly events: ReadonlyArray<DomainEvent> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Zdarzenia systemowe</CardTitle>
        <CardDescription>EventBus pokazany w UI</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {events.map((event) => (
          <div key={event.id} className="border-l-2 border-primary/50 pl-3 text-sm">
            <p className="font-medium">{event.message}</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {event.type} · {formatDate(event.createdAt)}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AlertsCard({
  alerts,
  products,
}: {
  readonly alerts: ReadonlyArray<Alert>;
  readonly products: ReadonlyArray<Product>;
}) {
  const productName = (productId: string) =>
    products.find((product) => product.id === productId)?.name ?? productId;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alerty cenowe</CardTitle>
        <CardDescription>{alerts.length} reguły monitorowania</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {alerts.map((alert) => (
          <div key={alert.id} className="border bg-muted/20 p-3 text-sm">
            <p className="font-medium">{productName(alert.productId)}</p>
            <p className="text-muted-foreground">Próg: {formatMoney(alert.targetPrice.amount)}</p>
            <p className={alert.triggeredAt ? "text-emerald-500" : "text-muted-foreground"}>
              {alert.triggeredAt ? `Uruchomiony ${formatDate(alert.triggeredAt)}` : "Aktywny"}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

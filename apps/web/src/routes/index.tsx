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
import { useRef, useState, type FormEvent, type ReactNode } from "react";

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

const axisMoneyFormatter = new Intl.NumberFormat("pl-PL", {
  maximumFractionDigits: 0,
});

const formatAxisMoney = (amount: number) => `${axisMoneyFormatter.format(amount)} zł`;

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
  const checkingProductIdsRef = useRef(new Set<string>());
  const [checkingProductIds, setCheckingProductIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
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

  const checkPrice = (productId: string) => {
    if (checkingProductIdsRef.current.has(productId)) {
      return;
    }

    checkingProductIdsRef.current.add(productId);
    setCheckingProductIds(new Set(checkingProductIdsRef.current));

    checkPriceMutation.mutate(productId, {
      onSettled: () => {
        checkingProductIdsRef.current.delete(productId);
        setCheckingProductIds(new Set(checkingProductIdsRef.current));
      },
    });
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

      <section className="grid min-w-0 gap-5">
        {dashboard.products.map((product) => (
          <ProductCard
            key={product.id}
            alerts={dashboard.alerts.filter((alert) => alert.productId === product.id)}
            isChecking={checkingProductIds.has(product.id)}
            isCreatingAlert={
              createAlertMutation.isPending &&
              createAlertMutation.variables?.productId === product.id
            }
            product={product}
            onCheckPrice={() => checkPrice(product.id)}
            onCreateAlert={(event) => createAlert(event, product.id)}
          />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <EventsCard events={dashboard.events} />
        <AlertsCard alerts={dashboard.alerts} products={dashboard.products} />
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
  readonly icon: ReactNode;
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
  const activeAlerts = alerts.filter((alert) => !alert.triggeredAt);
  const triggeredAlerts = alerts.filter((alert) => alert.triggeredAt);

  return (
    <Card className="min-w-0 overflow-hidden border-primary/10 bg-card/80 p-0">
      <div className="grid min-w-0 gap-5 p-4 lg:p-6">
        <header className="grid min-w-0 gap-4 md:grid-cols-[128px_minmax(0,1fr)_auto] md:items-start">
          <div className="h-32 w-32 overflow-hidden border bg-muted/30">
            <img
              className="h-full w-full object-cover"
              src={product.imageUrl}
              alt=""
              loading="lazy"
            />
          </div>

          <div className="min-w-0 pt-1">
            <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted-foreground">
              {product.category}
            </p>
            <h3 className="mt-1 truncate text-2xl font-semibold tracking-tight lg:text-3xl">
              {product.name}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Ostatnia aktualizacja: {formatDate(product.updatedAt)}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="border bg-muted/30 px-2 py-1">
                {product.offers.length} {product.offers.length === 1 ? "oferta" : "oferty"}
              </span>
              <span className="border bg-muted/30 px-2 py-1">
                {product.history.length} pomiarów
              </span>
              <span className="border bg-muted/30 px-2 py-1">
                {activeAlerts.length} aktywnych alertów
              </span>
            </div>
          </div>

          <div className="grid shrink-0 gap-3 text-left md:min-w-52 md:text-right">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Aktualna cena
              </p>
              <p className="mt-1 text-3xl font-semibold">
                {formatMoney(product.currentPrice.amount)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Najniższa: {formatMoney(product.lowestPrice.amount)}
            </p>
            {drop > 0 && (
              <p className="mt-1 text-xs text-emerald-500">Spadek od startu: {formatMoney(drop)}</p>
            )}
            <Button type="button" disabled={isChecking} onClick={onCheckPrice}>
              <RefreshCw className={isChecking ? "animate-spin" : ""} />
              {isChecking ? "Sprawdzanie..." : "Sprawdź cenę"}
            </Button>
          </div>
        </header>

        <PriceChart product={product} />

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <OffersPanel product={product} />
          <MonitoringPanel
            activeAlerts={activeAlerts}
            defaultAlertAmount={defaultAlertAmount}
            isCreatingAlert={isCreatingAlert}
            onCreateAlert={onCreateAlert}
            triggeredAlerts={triggeredAlerts}
          />
        </div>
      </div>
    </Card>
  );
}

function OffersPanel({ product }: { readonly product: Product }) {
  const bestOffer = product.offers.reduce((best, offer) =>
    offer.lastPrice.amount < best.lastPrice.amount ? offer : best,
  );

  return (
    <section className="min-w-0 border bg-muted/10">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h4 className="font-medium">Oferty sklepów</h4>
          <p className="text-xs text-muted-foreground">Porównanie ostatnio sprawdzonych cen</p>
        </div>
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {product.offers.length} pozycji
        </span>
      </div>

      <div className="divide-y">
        {product.offers.map((offer) => (
          <div key={offer.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate font-medium">{offer.storeName}</p>
                {offer.id === bestOffer.id && (
                  <span className="shrink-0 border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-emerald-500">
                    najlepsza
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Sprawdzone {formatDate(offer.lastCheckedAt)}
              </p>
            </div>
            <p className="shrink-0 text-right text-lg font-semibold">
              {formatMoney(offer.lastPrice.amount)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

const visibleHistoryLimit = 12;

function PriceChart({ product }: { readonly product: Product }) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const visibleHistory = product.history.slice(-visibleHistoryLimit);

  if (visibleHistory.length === 0) {
    return (
      <section className="min-w-0 border bg-muted/10 p-4">
        <h4 className="font-medium">Historia ceny</h4>
        <p className="mt-2 text-sm text-muted-foreground">Brak pomiarów dla tego produktu.</p>
      </section>
    );
  }

  const values = visibleHistory.map((point) => point.amount);
  const minRaw = Math.min(...values);
  const maxRaw = Math.max(...values);
  const spread = Math.max(1, maxRaw - minRaw);
  const min = Math.max(0, minRaw - spread * 0.12);
  const max = maxRaw + spread * 0.12;
  const width = 1200;
  const height = 300;
  const padding = { top: 20, right: 34, bottom: 54, left: 78 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const points = visibleHistory.map((point, index) => {
    const x =
      padding.left +
      (visibleHistory.length === 1
        ? plotWidth / 2
        : (index / (visibleHistory.length - 1)) * plotWidth);
    const y = padding.top + (1 - (point.amount - min) / (max - min)) * plotHeight;

    return { point, x, y };
  });

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${path} L ${points.at(-1)?.x ?? padding.left} ${padding.top + plotHeight} L ${padding.left} ${padding.top + plotHeight} Z`;
  const yTicks = Array.from({ length: 4 }, (_, index) => {
    const fraction = index / 3;
    return {
      value: max - (max - min) * fraction,
      y: padding.top + plotHeight * fraction,
    };
  });
  const xTicks = points.filter((_, index) => {
    if (points.length <= 3) return true;
    return (
      index === 0 || index === Math.floor((points.length - 1) / 2) || index === points.length - 1
    );
  });
  const activePoint = activeIndex === undefined ? undefined : points[activeIndex];

  return (
    <section className="min-w-0 border bg-[linear-gradient(180deg,_hsl(var(--muted)/0.22),_transparent)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h4 className="font-medium">Historia ceny</h4>
          <p className="text-xs text-muted-foreground">Ostatnie {visibleHistory.length} pomiarów</p>
        </div>
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">PLN</p>
      </div>

      <div className="relative min-w-0 overflow-hidden">
        {activePoint && (
          <div
            className="pointer-events-none absolute z-10 min-w-36 -translate-x-1/2 -translate-y-full border bg-background px-2.5 py-2 text-xs shadow-lg"
            style={{
              left: `${(activePoint.x / width) * 100}%`,
              top: `${(activePoint.y / height) * 100}%`,
            }}
          >
            <p className="font-semibold">{formatMoney(activePoint.point.amount)}</p>
            <p className="text-muted-foreground">{formatDate(activePoint.point.checkedAt)}</p>
          </div>
        )}

        <svg
          className="block h-auto w-full overflow-visible"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
        >
          <title>Wykres historii ceny dla {product.name}</title>
          <defs>
            <linearGradient id={`price-area-${product.id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>

          {yTicks.map((tick) => (
            <g key={tick.y}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={tick.y}
                y2={tick.y}
                className="stroke-border"
                strokeDasharray="4 6"
              />
              <text
                x={padding.left - 12}
                y={tick.y + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[11px]"
              >
                {formatAxisMoney(tick.value)}
              </text>
            </g>
          ))}

          <line
            x1={padding.left}
            x2={padding.left}
            y1={padding.top}
            y2={padding.top + plotHeight}
            className="stroke-border"
          />
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + plotHeight}
            y2={padding.top + plotHeight}
            className="stroke-border"
          />

          <path d={areaPath} fill={`url(#price-area-${product.id})`} className="text-chart-1" />
          <path
            d={path}
            fill="none"
            className="stroke-chart-1"
            strokeWidth="3"
            strokeLinecap="round"
          />

          <text
            x={18}
            y={padding.top + plotHeight / 2}
            textAnchor="middle"
            transform={`rotate(-90 18 ${padding.top + plotHeight / 2})`}
            className="fill-muted-foreground text-[11px] uppercase tracking-wider"
          >
            Cena (PLN)
          </text>
          <text
            x={padding.left + plotWidth / 2}
            y={height - 2}
            textAnchor="middle"
            className="fill-muted-foreground text-[11px] uppercase tracking-wider"
          >
            Data pomiaru
          </text>

          {xTicks.map(({ point, x }) => (
            <text
              key={point.checkedAt}
              x={x}
              y={height - 18}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {formatDate(point.checkedAt)}
            </text>
          ))}

          {points.map((entry, index) => (
            <g key={entry.point.checkedAt}>
              {activeIndex === index && (
                <line
                  x1={entry.x}
                  x2={entry.x}
                  y1={padding.top}
                  y2={padding.top + plotHeight}
                  className="stroke-primary/40"
                  strokeDasharray="4 4"
                />
              )}
              <circle
                cx={entry.x}
                cy={entry.y}
                r={activeIndex === index ? 5 : 4}
                className="fill-background stroke-chart-1"
                strokeWidth="2.5"
              />
              <circle
                cx={entry.x}
                cy={entry.y}
                r="13"
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(undefined)}
              />
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

function MonitoringPanel({
  activeAlerts,
  defaultAlertAmount,
  isCreatingAlert,
  onCreateAlert,
  triggeredAlerts,
}: {
  readonly activeAlerts: ReadonlyArray<Alert>;
  readonly defaultAlertAmount: number;
  readonly isCreatingAlert: boolean;
  readonly onCreateAlert: (event: FormEvent<HTMLFormElement>) => void;
  readonly triggeredAlerts: ReadonlyArray<Alert>;
}) {
  return (
    <section className="min-w-0 border bg-muted/10">
      <div className="border-b px-4 py-3">
        <h4 className="font-medium">Monitoring</h4>
        <p className="text-xs text-muted-foreground">Alerty cenowe dla tego produktu</p>
      </div>

      <div className="grid gap-4 p-4">
        <form className="grid grid-cols-[minmax(0,1fr)_auto] gap-2" onSubmit={onCreateAlert}>
          <Input
            name="amount"
            inputMode="decimal"
            min="1"
            placeholder={`${defaultAlertAmount}`}
            step="0.01"
            type="number"
          />
          <Button type="submit" variant="outline" disabled={isCreatingAlert}>
            Dodaj alert
          </Button>
        </form>

        <div className="grid gap-2">
          {activeAlerts.length === 0 && triggeredAlerts.length === 0 ? (
            <p className="border border-dashed bg-background/40 px-3 py-3 text-sm text-muted-foreground">
              Brak alertów. Ustaw próg ceny, a system zapisze regułę monitorowania.
            </p>
          ) : null}

          {activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between gap-3 border bg-background/50 px-3 py-2 text-sm"
            >
              <span className="text-muted-foreground">Aktywny próg</span>
              <span className="font-semibold">{formatMoney(alert.targetPrice.amount)}</span>
            </div>
          ))}

          {triggeredAlerts.slice(0, 3).map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between gap-3 border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm"
            >
              <span className="text-emerald-500">
                Uruchomiony {alert.triggeredAt ? formatDate(alert.triggeredAt) : ""}
              </span>
              <span className="font-semibold">{formatMoney(alert.targetPrice.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
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

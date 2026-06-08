import { Button, buttonVariants } from "@price-monitor/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@price-monitor/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@price-monitor/ui/components/dialog";
import { Input } from "@price-monitor/ui/components/input";
import type { Alert, Dashboard, Product } from "@price-monitor/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, Bell, RefreshCw, TrendingDown, Zap } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

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

const productCardId = (productId: string) => `product-card-${productId}`;

type AlertNotification = {
  readonly alertId: string;
  readonly productId: string;
  readonly productName: string;
  readonly targetAmount: number;
  readonly triggeredAt: string;
};

function HomeComponent() {
  const initialDashboard = Route.useLoaderData();
  const alertSoundReadyRef = useRef(false);
  const knownTriggeredAlertIdsRef = useRef<Set<string> | undefined>(undefined);
  const [alertSoundReady, setAlertSoundReady] = useState(false);
  const [highlightedProductIds, setHighlightedProductIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [latestAlert, setLatestAlert] = useState<AlertNotification | undefined>(undefined);
  const queryClient = useQueryClient();
  const dashboardQuery = useQuery({
    ...dashboardQueryOptions(),
    initialData: initialDashboard,
  });

  const createAlertMutation = useMutation({
    mutationFn: apiClient.createAlert,
    onSuccess: () => queryClient.invalidateQueries(invalidateDashboard),
  });

  const deleteAlertMutation = useMutation({
    mutationFn: apiClient.deleteAlert,
    onError: (error) => {
      toast.error("Nie udało się usunąć alertu", {
        description: getErrorMessage(error),
      });
    },
    onSuccess: (alert) => {
      queryClient.invalidateQueries(invalidateDashboard);
      setHighlightedProductIds((current) => {
        const next = new Set(current);
        next.delete(alert.productId);
        return next;
      });
      setLatestAlert((current) => (current?.alertId === alert.id ? undefined : current));
      toast.success("Alert usunięty", {
        description: `Usunięto próg ${formatMoney(alert.targetPrice.amount)}.`,
      });
    },
  });

  const showProduct = (productId: string) => {
    document.getElementById(productCardId(productId))?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setHighlightedProductIds((current) => new Set([...current, productId]));

    window.setTimeout(() => {
      setHighlightedProductIds((current) => {
        const next = new Set(current);
        next.delete(productId);
        return next;
      });
    }, 8000);
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const enableSound = () => {
      alertSoundReadyRef.current = true;
      setAlertSoundReady(true);
    };

    window.addEventListener("pointerdown", enableSound, { once: true });
    window.addEventListener("keydown", enableSound, { once: true });

    return () => {
      window.removeEventListener("pointerdown", enableSound);
      window.removeEventListener("keydown", enableSound);
    };
  }, []);

  useEffect(() => {
    const dashboard = dashboardQuery.data;

    if (!dashboard) {
      return;
    }

    const triggeredAlerts = dashboard.alerts.filter((alert) => alert.triggeredAt);
    const currentTriggeredIds = new Set(triggeredAlerts.map((alert) => alert.id));
    const knownTriggeredIds = knownTriggeredAlertIdsRef.current;

    if (!knownTriggeredIds) {
      knownTriggeredAlertIdsRef.current = currentTriggeredIds;
      return;
    }

    const newAlerts = triggeredAlerts.filter((alert) => !knownTriggeredIds.has(alert.id));
    knownTriggeredAlertIdsRef.current = currentTriggeredIds;

    if (newAlerts.length === 0) {
      return;
    }

    const latest = newAlerts.reduce((latestAlert, alert) =>
      (alert.triggeredAt ?? alert.createdAt) > (latestAlert.triggeredAt ?? latestAlert.createdAt)
        ? alert
        : latestAlert,
    );
    const product = dashboard.products.find((item) => item.id === latest.productId);
    const productName = product?.name ?? latest.productId;
    const notification = {
      alertId: latest.id,
      productId: latest.productId,
      productName,
      targetAmount: latest.targetPrice.amount,
      triggeredAt: latest.triggeredAt ?? latest.createdAt,
    };
    const productIds = new Set(newAlerts.map((alert) => alert.productId));

    setLatestAlert(notification);
    setHighlightedProductIds((current) => new Set([...current, ...productIds]));

    toast.warning("Alert cenowy uruchomiony", {
      action: {
        label: "Pokaż",
        onClick: () => showProduct(latest.productId),
      },
      description:
        newAlerts.length === 1
          ? `${productName} osiągnął próg ${formatMoney(latest.targetPrice.amount)}.`
          : `${productName} osiągnął próg ${formatMoney(latest.targetPrice.amount)} i są ${
              newAlerts.length - 1
            } kolejne alerty.`,
      duration: 7000,
    });

    if (alertSoundReadyRef.current && typeof window !== "undefined" && window.AudioContext) {
      try {
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, context.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(660, context.currentTime + 0.18);
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.14, context.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.onended = () => {
          void context.close();
        };
        oscillator.start();
        oscillator.stop(context.currentTime + 0.24);
      } catch {
        // Browsers can still block audio in some autoplay/privacy modes.
      }
    }

    window.setTimeout(() => {
      setHighlightedProductIds((current) => {
        const next = new Set(current);

        for (const productId of productIds) {
          next.delete(productId);
        }

        return next;
      });
    }, 8000);
  }, [dashboardQuery.data]);

  useEffect(() => {
    const dashboard = dashboardQuery.data;

    if (!dashboard || !latestAlert) {
      return;
    }

    if (!dashboard.alerts.some((alert) => alert.id === latestAlert.alertId)) {
      setLatestAlert(undefined);
    }
  }, [dashboardQuery.data, latestAlert]);

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

      {latestAlert && (
        <AlertBanner
          notification={latestAlert}
          soundReady={alertSoundReady}
          onShowProduct={() => showProduct(latestAlert.productId)}
        />
      )}

      {(createAlertMutation.isError || deleteAlertMutation.isError) && (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent>
            {createAlertMutation.error
              ? getErrorMessage(createAlertMutation.error)
              : getErrorMessage(deleteAlertMutation.error)}
          </CardContent>
        </Card>
      )}

      <section className="grid min-w-0 gap-5">
        {dashboard.products.map((product) => (
          <ProductCard
            key={product.id}
            alerts={dashboard.alerts.filter((alert) => alert.productId === product.id)}
            deletingAlertId={deleteAlertMutation.variables}
            isAlerting={highlightedProductIds.has(product.id)}
            isCreatingAlert={
              createAlertMutation.isPending &&
              createAlertMutation.variables?.productId === product.id
            }
            isDeletingAlert={deleteAlertMutation.isPending}
            product={product}
            onCreateAlert={(event) => createAlert(event, product.id)}
            onDeleteAlert={(alertId) => deleteAlertMutation.mutate(alertId)}
          />
        ))}
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
              Backend sam symuluje mały dryft cen, a dashboard co sekundę pobiera typed snapshot z
              `@price-monitor/api`, żeby aktualizować ceny, alerty i wykresy bez ręcznego
              sprawdzania.
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

function AlertBanner({
  notification,
  onShowProduct,
  soundReady,
}: {
  readonly notification: AlertNotification;
  readonly onShowProduct: () => void;
  readonly soundReady: boolean;
}) {
  return (
    <Card className="border-emerald-400/60 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.26),_transparent_42%),linear-gradient(135deg,_rgba(16,185,129,0.14),_rgba(20,184,166,0.05))] py-0 shadow-[0_0_46px_rgba(16,185,129,0.18)] ring-1 ring-emerald-400/30">
      <CardContent className="grid gap-4 p-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
        <div className="grid size-12 place-items-center border border-emerald-400/60 bg-emerald-400/15 text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.28)]">
          <Bell className="size-5 animate-pulse" />
        </div>
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-emerald-300">
            Alert cenowy uruchomiony
          </p>
          <h3 className="mt-1 truncate text-xl font-semibold tracking-tight">
            {notification.productName}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Cena osiągnęła próg {formatMoney(notification.targetAmount)} o{" "}
            {formatDate(notification.triggeredAt)}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-fit border border-emerald-400/30 bg-background/50 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
            {soundReady ? "Dźwięk aktywny" : "Dźwięk po interakcji"}
          </span>
          <Button type="button" size="sm" variant="outline" onClick={onShowProduct}>
            Pokaż produkt
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProductCard({
  alerts,
  deletingAlertId,
  isAlerting,
  isCreatingAlert,
  isDeletingAlert,
  onCreateAlert,
  onDeleteAlert,
  product,
}: {
  readonly alerts: ReadonlyArray<Alert>;
  readonly deletingAlertId?: string;
  readonly isAlerting: boolean;
  readonly isCreatingAlert: boolean;
  readonly isDeletingAlert: boolean;
  readonly onCreateAlert: (event: FormEvent<HTMLFormElement>) => void;
  readonly onDeleteAlert: (alertId: string) => void;
  readonly product: Product;
}) {
  const firstPrice = product.history[0]?.amount ?? product.currentPrice.amount;
  const drop = firstPrice - product.currentPrice.amount;
  const defaultAlertAmount = Math.max(1, Math.floor(product.currentPrice.amount * 0.94));
  const activeAlerts = alerts.filter((alert) => !alert.triggeredAt);
  const triggeredAlerts = alerts.filter((alert) => alert.triggeredAt);

  return (
    <Card
      id={productCardId(product.id)}
      className={`min-w-0 overflow-hidden p-0 transition-all duration-500 ${
        isAlerting
          ? "border-emerald-400/70 bg-emerald-500/10 shadow-[0_0_42px_rgba(16,185,129,0.22)] ring-1 ring-emerald-400/50"
          : "border-primary/10 bg-card/80"
      } scroll-mt-28`}
    >
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
              {isAlerting && (
                <span className="border border-emerald-400/40 bg-emerald-400/15 px-2 py-1 text-emerald-300">
                  nowy alert
                </span>
              )}
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
          </div>
        </header>

        {isAlerting && (
          <div className="flex flex-wrap items-center justify-between gap-3 border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            <span className="inline-flex items-center gap-2 font-medium">
              <Bell className="size-4 animate-pulse" /> Alert dla tego produktu właśnie odpalił
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-300">
              live update
            </span>
          </div>
        )}

        <PriceChart product={product} />

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <OffersPanel product={product} />
          <MonitoringPanel
            activeAlerts={activeAlerts}
            deletingAlertId={deletingAlertId}
            defaultAlertAmount={defaultAlertAmount}
            isCreatingAlert={isCreatingAlert}
            isDeletingAlert={isDeletingAlert}
            onCreateAlert={onCreateAlert}
            onDeleteAlert={onDeleteAlert}
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
  deletingAlertId,
  defaultAlertAmount,
  isCreatingAlert,
  isDeletingAlert,
  onCreateAlert,
  onDeleteAlert,
  triggeredAlerts,
}: {
  readonly activeAlerts: ReadonlyArray<Alert>;
  readonly deletingAlertId?: string;
  readonly defaultAlertAmount: number;
  readonly isCreatingAlert: boolean;
  readonly isDeletingAlert: boolean;
  readonly onCreateAlert: (event: FormEvent<HTMLFormElement>) => void;
  readonly onDeleteAlert: (alertId: string) => void;
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
              <div className="min-w-0">
                <p className="text-muted-foreground">Aktywny próg</p>
                <p className="font-semibold">{formatMoney(alert.targetPrice.amount)}</p>
              </div>
              <Button
                type="button"
                size="xs"
                variant="destructive"
                disabled={isDeletingAlert && deletingAlertId === alert.id}
                onClick={() => onDeleteAlert(alert.id)}
              >
                {isDeletingAlert && deletingAlertId === alert.id ? "Usuwanie..." : "Usuń"}
              </Button>
            </div>
          ))}

          <TriggeredAlertsSummary
            deletingAlertId={deletingAlertId}
            isDeletingAlert={isDeletingAlert}
            triggeredAlerts={triggeredAlerts}
            onDeleteAlert={onDeleteAlert}
          />
        </div>
      </div>
    </section>
  );
}

function TriggeredAlertsSummary({
  deletingAlertId,
  isDeletingAlert,
  onDeleteAlert,
  triggeredAlerts,
}: {
  readonly deletingAlertId?: string;
  readonly isDeletingAlert: boolean;
  readonly onDeleteAlert: (alertId: string) => void;
  readonly triggeredAlerts: ReadonlyArray<Alert>;
}) {
  if (triggeredAlerts.length === 0) {
    return null;
  }

  const latestAlert = triggeredAlerts.reduce((latest, alert) =>
    (alert.triggeredAt ?? alert.createdAt) > (latest.triggeredAt ?? latest.createdAt)
      ? alert
      : latest,
  );

  return (
    <Dialog>
      <div className="flex flex-wrap items-center justify-between gap-3 border border-emerald-400/35 bg-emerald-400/10 px-3 py-2 text-sm shadow-[0_0_18px_rgba(16,185,129,0.1)]">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 font-medium text-emerald-300">
            <Bell className="size-4" /> {triggeredAlerts.length} uruchomione alerty
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            Ostatni próg {formatMoney(latestAlert.targetPrice.amount)} ·{" "}
            {latestAlert.triggeredAt ? formatDate(latestAlert.triggeredAt) : "teraz"}
          </p>
        </div>

        <DialogTrigger className={buttonVariants({ variant: "outline", size: "xs" })}>
          Podgląd
        </DialogTrigger>
      </div>

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Uruchomione alerty</DialogTitle>
          <DialogDescription>
            Pełna lista progów, które zostały wykryte dla tego produktu.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[min(460px,calc(100svh-13rem))] gap-2 overflow-y-auto pr-1">
          {triggeredAlerts.map((alert) => (
            <div
              key={alert.id}
              className="grid gap-2 border border-emerald-400/40 bg-emerald-400/10 px-3 py-3 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 font-medium text-emerald-300">
                  <Bell className="size-4" /> Alert uruchomiony
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatMoney(alert.targetPrice.amount)}</span>
                  <Button
                    type="button"
                    size="xs"
                    variant="destructive"
                    disabled={isDeletingAlert && deletingAlertId === alert.id}
                    onClick={() => onDeleteAlert(alert.id)}
                  >
                    {isDeletingAlert && deletingAlertId === alert.id ? "Usuwanie..." : "Usuń"}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Wykryto {alert.triggeredAt ? formatDate(alert.triggeredAt) : "teraz"}. Produkt
                wymaga uwagi.
              </p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

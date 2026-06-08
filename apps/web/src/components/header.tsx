import { Button, buttonVariants } from "@price-monitor/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@price-monitor/ui/components/dialog";
import { cn } from "@price-monitor/ui/lib/utils";
import type { Alert, DomainEvent, Product } from "@price-monitor/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Activity, Bell } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { apiClient } from "../lib/api-client";
import { dashboardQueryOptions, invalidateDashboard } from "../lib/queries";

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

export default function Header() {
  const links = [{ to: "/", label: "Dashboard" }] as const;
  const queryClient = useQueryClient();
  const dashboardQuery = useQuery(dashboardQueryOptions());
  const dashboard = dashboardQuery.data;
  const alerts = dashboard?.alerts ?? [];
  const events = dashboard?.events ?? [];
  const products = dashboard?.products ?? [];
  const triggeredAlerts = alerts.filter((alert) => alert.triggeredAt).length;
  const deleteAlertMutation = useMutation({
    mutationFn: apiClient.deleteAlert,
    onError: (error) => {
      toast.error("Nie udało się usunąć alertu", {
        description: getErrorMessage(error),
      });
    },
    onSuccess: (alert) => {
      queryClient.invalidateQueries(invalidateDashboard);
      toast.success("Alert usunięty", {
        description: `Usunięto próg ${formatMoney(alert.targetPrice.amount)}.`,
      });
    },
  });

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-muted-foreground">
            PricePulse
          </p>
          <h1 className="text-lg font-semibold">Monitoring cen i alerty</h1>
        </div>

        <nav className="flex flex-wrap items-center gap-2 text-sm">
          {links.map(({ to, label }) => {
            return (
              <Link
                key={to}
                to={to}
                activeProps={{ className: "text-primary" }}
                className="px-2 py-1"
              >
                {label}
              </Link>
            );
          })}

          <DashboardDialog
            count={alerts.length}
            description="Reguły monitorowania, progi i ostatnie uruchomienia."
            icon={<Bell className="size-4" />}
            label="Alerty"
            title="Alerty cenowe"
          >
            <AlertsPreview
              alerts={alerts}
              deletingAlertId={deleteAlertMutation.variables}
              isDeleting={deleteAlertMutation.isPending}
              products={products}
              onDeleteAlert={(alertId) => deleteAlertMutation.mutate(alertId)}
            />
          </DashboardDialog>

          <DashboardDialog
            count={events.length}
            description="Ostatnie automatyczne zmiany cen, uruchomione alerty i działania systemu."
            icon={<Activity className="size-4" />}
            label="Zdarzenia"
            title="Zdarzenia systemowe"
          >
            <EventsPreview events={events} />
          </DashboardDialog>

          {triggeredAlerts > 0 && (
            <span className="border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
              {triggeredAlerts} alertów uruchomionych
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}

function DashboardDialog({
  children,
  count,
  description,
  icon,
  label,
  title,
}: {
  readonly children: ReactNode;
  readonly count: number;
  readonly description: string;
  readonly icon: ReactNode;
  readonly label: string;
  readonly title: string;
}) {
  return (
    <Dialog>
      <DialogTrigger
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2 bg-background/70")}
      >
        {icon}
        {label}
        <span className="border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">
          {count}
        </span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function AlertsPreview({
  alerts,
  deletingAlertId,
  isDeleting,
  onDeleteAlert,
  products,
}: {
  readonly alerts: ReadonlyArray<Alert>;
  readonly deletingAlertId?: string;
  readonly isDeleting: boolean;
  readonly onDeleteAlert: (alertId: string) => void;
  readonly products: ReadonlyArray<Product>;
}) {
  const productName = (productId: string) =>
    products.find((product) => product.id === productId)?.name ?? productId;

  if (alerts.length === 0) {
    return <EmptyPreview>Nie ma jeszcze żadnych reguł alertów.</EmptyPreview>;
  }

  return (
    <div className="grid max-h-[min(560px,calc(100svh-13rem))] gap-2 overflow-y-auto pr-1">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`border p-3 text-sm ${
            alert.triggeredAt
              ? "border-emerald-400/40 bg-emerald-400/10 shadow-[0_0_18px_rgba(16,185,129,0.12)]"
              : "bg-muted/20"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{productName(alert.productId)}</p>
              <p className="text-muted-foreground">Próg: {formatMoney(alert.targetPrice.amount)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${
                  alert.triggeredAt
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                    : "bg-background/60 text-muted-foreground"
                }`}
              >
                {alert.triggeredAt ? "ALERT" : "Aktywny"}
              </span>
              <Button
                type="button"
                size="xs"
                variant="destructive"
                disabled={isDeleting && deletingAlertId === alert.id}
                onClick={() => onDeleteAlert(alert.id)}
              >
                {isDeleting && deletingAlertId === alert.id ? "Usuwanie..." : "Usuń"}
              </Button>
            </div>
          </div>
          <p className={alert.triggeredAt ? "mt-2 text-emerald-300" : "mt-2 text-muted-foreground"}>
            {alert.triggeredAt ? `Uruchomiony ${formatDate(alert.triggeredAt)}` : "Czeka na próg"}
          </p>
        </div>
      ))}
    </div>
  );
}

function EventsPreview({ events }: { readonly events: ReadonlyArray<DomainEvent> }) {
  if (events.length === 0) {
    return <EmptyPreview>Nie ma jeszcze zdarzeń systemowych.</EmptyPreview>;
  }

  return (
    <div className="grid max-h-[min(560px,calc(100svh-13rem))] gap-2 overflow-y-auto pr-1">
      {events.map((event) => (
        <div key={event.id} className="border-l-2 border-primary/50 bg-muted/10 px-3 py-2 text-sm">
          <p className="font-medium">{event.message}</p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {event.type} · {formatDate(event.createdAt)}
          </p>
        </div>
      ))}
    </div>
  );
}

function EmptyPreview({ children }: { readonly children: ReactNode }) {
  return (
    <div className="border border-dashed bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

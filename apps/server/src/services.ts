import {
  ProductNotFound,
  type Alert,
  type Dashboard,
  type DomainEvent,
  type Health,
  type Product,
} from "@price-monitor/api";
import { Context, Effect, Layer, Ref } from "effect";
import { randomUUID } from "node:crypto";

import { seedAlerts, seedEvents, seedProducts } from "./seed";

const toMoney = (amount: number) => ({
  amount: Number(amount.toFixed(2)),
  currency: "PLN" as const,
});

const maxHistoryPoints = 80;
const priceDriftInterval = "3 seconds";

const nowIso = () => new Date().toISOString();

const makeId = (prefix: string) => `${prefix}-${randomUUID()}`;

const randomDriftMultiplier = () => 1 + (Math.random() - 0.52) * 0.03;

class PriceState extends Context.Service<
  PriceState,
  {
    readonly alerts: Ref.Ref<ReadonlyArray<Alert>>;
    readonly products: Ref.Ref<ReadonlyArray<Product>>;
  }
>()("price-monitor/PriceState") {}

export class EventBus extends Context.Service<
  EventBus,
  {
    readonly list: Effect.Effect<ReadonlyArray<DomainEvent>>;
    readonly publish: (event: Omit<DomainEvent, "createdAt" | "id">) => Effect.Effect<DomainEvent>;
  }
>()("price-monitor/EventBus") {}

export class PriceProvider extends Context.Service<
  PriceProvider,
  {
    readonly nextOffersFor: (
      product: Product,
      checkedAt: string,
    ) => Effect.Effect<Product["offers"]>;
  }
>()("price-monitor/PriceProvider") {}

export class PriceMonitor extends Context.Service<
  PriceMonitor,
  {
    readonly checkPrice: (productId: string) => Effect.Effect<Product, ProductNotFound>;
    readonly createAlert: (payload: {
      readonly amount: number;
      readonly productId: string;
    }) => Effect.Effect<Alert, ProductNotFound>;
    readonly dashboard: Effect.Effect<Dashboard>;
    readonly getProduct: (productId: string) => Effect.Effect<Product, ProductNotFound>;
    readonly health: Effect.Effect<Health>;
    readonly listAlerts: Effect.Effect<ReadonlyArray<Alert>>;
    readonly listEvents: Effect.Effect<ReadonlyArray<DomainEvent>>;
    readonly listProducts: Effect.Effect<ReadonlyArray<Product>>;
    readonly updateMarketPrices: Effect.Effect<ReadonlyArray<Product>>;
  }
>()("price-monitor/PriceMonitor") {}

const PriceStateLive = Layer.effect(
  PriceState,
  Effect.gen(function* () {
    const alerts = yield* Ref.make(seedAlerts);
    const products = yield* Ref.make(seedProducts);

    return { alerts, products };
  }),
);

const EventBusLive = Layer.effect(
  EventBus,
  Effect.gen(function* () {
    const events = yield* Ref.make(seedEvents);

    return {
      list: Ref.get(events),
      publish: (event) =>
        Ref.modify(events, (current) => {
          const domainEvent: DomainEvent = {
            ...event,
            id: makeId("event"),
            createdAt: nowIso(),
          };

          return [domainEvent, [domainEvent, ...current].slice(0, 40)] as const;
        }),
    };
  }),
);

const PriceProviderLive = Layer.succeed(PriceProvider, {
  nextOffersFor: (product, checkedAt) =>
    Effect.sync(() =>
      product.offers.map((offer) => ({
        ...offer,
        lastCheckedAt: checkedAt,
        lastPrice: toMoney(Math.max(1, offer.lastPrice.amount * randomDriftMultiplier())),
      })),
    ),
});

const PriceMonitorLive = Layer.effect(
  PriceMonitor,
  Effect.gen(function* () {
    const eventBus = yield* EventBus;
    const priceProvider = yield* PriceProvider;
    const state = yield* PriceState;

    const listProducts = Ref.get(state.products);
    const listAlerts = Ref.get(state.alerts);
    const listEvents = eventBus.list;

    const getProduct = (productId: string) =>
      Effect.gen(function* () {
        const products = yield* Ref.get(state.products);
        const product = products.find((item) => item.id === productId);

        if (!product) {
          return yield* new ProductNotFound({
            productId,
            message: `Product ${productId} was not found`,
          });
        }

        return product;
      });

    const bestPriceFromOffers = (product: Product, offers: Product["offers"]) =>
      offers.reduce<Product["currentPrice"]>(
        (best, offer) => (offer.lastPrice.amount < best.amount ? offer.lastPrice : best),
        offers[0]?.lastPrice ?? product.currentPrice,
      );

    const triggerAlertsFor = (product: Product, triggeredAt: string) =>
      Effect.gen(function* () {
        const triggeredAlerts = yield* Ref.modify(state.alerts, (alerts) => {
          const triggered: Array<Alert> = [];
          const nextAlerts = alerts.map((alert) => {
            if (
              alert.productId !== product.id ||
              !alert.enabled ||
              alert.triggeredAt ||
              product.currentPrice.amount > alert.targetPrice.amount
            ) {
              return alert;
            }

            const nextAlert = { ...alert, triggeredAt };
            triggered.push(nextAlert);
            return nextAlert;
          });

          return [triggered, nextAlerts] as const;
        });

        yield* Effect.forEach(triggeredAlerts, (alert) =>
          eventBus.publish({
            type: "AlertTriggered",
            productId: product.id,
            message: `Alert ${alert.targetPrice.amount} PLN dla ${product.name} został uruchomiony.`,
          }),
        );

        return triggeredAlerts;
      });

    const updateMarketPrices = Effect.gen(function* () {
      const products = yield* Ref.get(state.products);
      const checkedAt = nowIso();

      const changes = yield* Effect.forEach(products, (product) =>
        Effect.gen(function* () {
          const nextOffers = yield* priceProvider.nextOffersFor(product, checkedAt);
          const nextPrice = bestPriceFromOffers(product, nextOffers);
          const priceChanged = nextPrice.amount !== product.currentPrice.amount;
          const priceDropped = nextPrice.amount < product.currentPrice.amount;

          const updatedProduct: Product = {
            ...product,
            currentPrice: nextPrice,
            lowestPrice:
              nextPrice.amount < product.lowestPrice.amount ? nextPrice : product.lowestPrice,
            history: priceChanged
              ? [...product.history, { ...nextPrice, checkedAt }].slice(-maxHistoryPoints)
              : product.history,
            offers: nextOffers,
            updatedAt: checkedAt,
          };

          return { priceChanged, priceDropped, product: updatedProduct };
        }),
      );

      const updatedProducts = changes.map((change) => change.product);

      yield* Ref.set(state.products, updatedProducts);

      yield* Effect.forEach(
        changes.filter((change) => change.priceChanged),
        (change) =>
          eventBus.publish({
            type: change.priceDropped ? "PriceDropped" : "PriceUpdated",
            productId: change.product.id,
            message: change.priceDropped
              ? `Cena ${change.product.name} spadła do ${change.product.currentPrice.amount} PLN.`
              : `Cena ${change.product.name} zmieniła się do ${change.product.currentPrice.amount} PLN.`,
          }),
      );

      yield* Effect.forEach(
        changes.filter((change) => change.priceChanged),
        (change) => triggerAlertsFor(change.product, checkedAt),
      );

      return updatedProducts;
    });

    const checkPrice = (productId: string) =>
      Effect.gen(function* () {
        const product = yield* getProduct(productId);

        yield* eventBus.publish({
          type: "PriceChecked",
          productId,
          message: `Pobrano aktualną cenę ${product.name}: ${product.currentPrice.amount} PLN.`,
        });

        return product;
      });

    const monitor = {
      checkPrice,
      createAlert: (payload: { readonly amount: number; readonly productId: string }) =>
        Effect.gen(function* () {
          const product = yield* getProduct(payload.productId);
          const createdAt = nowIso();
          const shouldTrigger = product.currentPrice.amount <= payload.amount;

          const alert: Alert = {
            id: makeId("alert"),
            productId: payload.productId,
            targetPrice: toMoney(payload.amount),
            enabled: true,
            createdAt,
            ...(shouldTrigger ? { triggeredAt: createdAt } : {}),
          };

          yield* Ref.update(state.alerts, (alerts) => [alert, ...alerts]);

          if (shouldTrigger) {
            yield* eventBus.publish({
              type: "AlertTriggered",
              productId: product.id,
              message: `Alert ${alert.targetPrice.amount} PLN dla ${product.name} został uruchomiony.`,
            });
          }

          return alert;
        }),
      dashboard: Effect.gen(function* () {
        const products = yield* listProducts;
        const alerts = yield* listAlerts;
        const events = yield* listEvents;

        return { alerts, events, products };
      }),
      getProduct,
      health: Effect.sync(() => ({
        status: "ok" as const,
        service: "price-monitor-api" as const,
        checkedAt: nowIso(),
      })),
      listAlerts,
      listEvents,
      listProducts,
      updateMarketPrices,
    };

    yield* Effect.gen(function* () {
      while (true) {
        yield* Effect.sleep(priceDriftInterval);
        yield* monitor.updateMarketPrices;
      }
    }).pipe(Effect.forkScoped({ startImmediately: true }));

    return monitor;
  }),
).pipe(Layer.provide(Layer.mergeAll(PriceStateLive, EventBusLive, PriceProviderLive)));

export const ServicesLive = PriceMonitorLive;

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

const nowIso = () => new Date().toISOString();

const makeId = (prefix: string) => `${prefix}-${randomUUID()}`;

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
    readonly currentPriceFor: (product: Product) => Effect.Effect<Product["currentPrice"]>;
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
  currentPriceFor: (product) => {
    const signal = product.id.length + product.history.length + product.offers.length;
    const direction = signal % 4 === 0 ? 1.03 : 0.96 - (signal % 3) / 100;

    return Effect.succeed(toMoney(Math.max(1, product.currentPrice.amount * direction)));
  },
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

    const checkPrice = (productId: string) =>
      Effect.gen(function* () {
        const product = yield* getProduct(productId);
        const nextPrice = yield* priceProvider.currentPriceFor(product);
        const checkedAt = nowIso();
        const priceDropped = nextPrice.amount < product.currentPrice.amount;

        const updatedProduct: Product = {
          ...product,
          currentPrice: nextPrice,
          lowestPrice:
            nextPrice.amount < product.lowestPrice.amount ? nextPrice : product.lowestPrice,
          history: [...product.history, { ...nextPrice, checkedAt }],
          offers: product.offers.map((offer, index) =>
            index === 0
              ? {
                  ...offer,
                  lastCheckedAt: checkedAt,
                  lastPrice: nextPrice,
                }
              : offer,
          ),
          updatedAt: checkedAt,
        };

        yield* Ref.update(state.products, (products) =>
          products.map((item) => (item.id === productId ? updatedProduct : item)),
        );

        yield* eventBus.publish({
          type: priceDropped ? "PriceDropped" : "PriceChecked",
          productId,
          message: priceDropped
            ? `Cena ${product.name} spadła do ${nextPrice.amount} PLN.`
            : `Sprawdzono cenę ${product.name}: ${nextPrice.amount} PLN.`,
        });

        const triggeredAlerts = yield* Ref.modify(state.alerts, (alerts) => {
          const triggered: Array<Alert> = [];
          const nextAlerts = alerts.map((alert) => {
            if (
              alert.productId !== productId ||
              !alert.enabled ||
              alert.triggeredAt ||
              nextPrice.amount > alert.targetPrice.amount
            ) {
              return alert;
            }

            const nextAlert = { ...alert, triggeredAt: checkedAt };
            triggered.push(nextAlert);
            return nextAlert;
          });

          return [triggered, nextAlerts] as const;
        });

        yield* Effect.forEach(triggeredAlerts, (alert) =>
          eventBus.publish({
            type: "AlertTriggered",
            productId,
            message: `Alert ${alert.targetPrice.amount} PLN dla ${product.name} został uruchomiony.`,
          }),
        );

        return updatedProduct;
      });

    return {
      checkPrice,
      createAlert: (payload) =>
        Effect.gen(function* () {
          yield* getProduct(payload.productId);

          const alert: Alert = {
            id: makeId("alert"),
            productId: payload.productId,
            targetPrice: toMoney(payload.amount),
            enabled: true,
            createdAt: nowIso(),
          };

          yield* Ref.update(state.alerts, (alerts) => [alert, ...alerts]);
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
    };
  }),
).pipe(Layer.provide(Layer.mergeAll(PriceStateLive, EventBusLive, PriceProviderLive)));

export const ServicesLive = PriceMonitorLive;

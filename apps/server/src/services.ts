import {
  AlertNotFound,
  type Alert,
  type Dashboard,
  type DomainEvent,
  type Health,
  ProductNotFound,
  type Product,
} from "@price-monitor/api";
import { Database, DatabaseLive, schema } from "@price-monitor/db";
import { and, eq, gte, isNull } from "drizzle-orm";
import { Context, Effect, Layer } from "effect";
import { randomUUID } from "node:crypto";

import { serverConfig } from "./config";
import { seedAlerts, seedEvents, seedProducts } from "./seed";

const maxHistoryPoints = 80;
const priceDriftInterval = "3 seconds";

const nowIso = () => new Date().toISOString();

const makeId = (prefix: string) => `${prefix}-${randomUUID()}`;

const randomDriftMultiplier = () => 1 + (Math.random() - 0.52) * 0.03;

const toCurrency = (_currency: string): "PLN" => "PLN";

const toMoney = (amount: number, currency = "PLN"): Product["currentPrice"] => ({
  amount: Number(Number(amount).toFixed(2)),
  currency: toCurrency(currency),
});

const toDate = (value: string) => new Date(value);

const toIso = (value: Date | string) => new Date(value).toISOString();

type AlertRow = typeof schema.alerts.$inferSelect;
type DomainEventRow = typeof schema.domainEvents.$inferSelect;
type PriceHistoryRow = typeof schema.priceHistory.$inferSelect;
type ProductRow = typeof schema.products.$inferSelect;
type StoreOfferRow = typeof schema.storeOffers.$inferSelect;

type ProductWithRelations = ProductRow & {
  readonly history: ReadonlyArray<PriceHistoryRow>;
  readonly offers: ReadonlyArray<StoreOfferRow>;
};

const rowToAlert = (row: AlertRow): Alert => ({
  id: row.id,
  productId: row.productId,
  targetPrice: toMoney(row.targetPrice, row.currency),
  enabled: row.enabled,
  createdAt: toIso(row.createdAt),
  ...(row.triggeredAt ? { triggeredAt: toIso(row.triggeredAt) } : {}),
});

const rowToEvent = (row: DomainEventRow): DomainEvent => ({
  id: row.id,
  type: row.type as DomainEvent["type"],
  productId: row.productId,
  message: row.message,
  createdAt: toIso(row.createdAt),
});

const rowToOffer = (row: StoreOfferRow): Product["offers"][number] => ({
  id: row.id,
  storeName: row.storeName,
  url: row.url,
  lastPrice: toMoney(row.lastPrice, row.currency),
  lastCheckedAt: toIso(row.lastCheckedAt),
});

const rowToHistory = (row: PriceHistoryRow): Product["history"][number] => ({
  amount: row.amount,
  currency: toCurrency(row.currency),
  checkedAt: toIso(row.checkedAt),
});

const rowToProduct = (row: ProductWithRelations): Product => ({
  id: row.id,
  name: row.name,
  category: row.category,
  imageUrl: row.imageUrl,
  currentPrice: toMoney(row.currentPrice, row.currency),
  lowestPrice: toMoney(row.lowestPrice, row.currency),
  offers: [...row.offers].sort((left, right) => left.lastPrice - right.lastPrice).map(rowToOffer),
  history: [...row.history]
    .sort((left, right) => left.checkedAt.getTime() - right.checkedAt.getTime())
    .slice(-maxHistoryPoints)
    .map(rowToHistory),
  updatedAt: toIso(row.updatedAt),
});

const productToRow = (product: Product): typeof schema.products.$inferInsert => ({
  id: product.id,
  name: product.name,
  category: product.category,
  imageUrl: product.imageUrl,
  currentPrice: product.currentPrice.amount,
  lowestPrice: product.lowestPrice.amount,
  currency: product.currentPrice.currency,
  updatedAt: toDate(product.updatedAt),
});

const offerToRow = (
  offer: Product["offers"][number],
  productId: string,
): typeof schema.storeOffers.$inferInsert => ({
  id: offer.id,
  productId,
  storeName: offer.storeName,
  url: offer.url,
  lastPrice: offer.lastPrice.amount,
  currency: offer.lastPrice.currency,
  lastCheckedAt: toDate(offer.lastCheckedAt),
});

const historyToRow = (
  point: Product["history"][number],
  productId: string,
  index: number,
): typeof schema.priceHistory.$inferInsert => ({
  id: `history-${productId}-${index}`,
  productId,
  amount: point.amount,
  currency: point.currency,
  checkedAt: toDate(point.checkedAt),
});

const alertToRow = (alert: Alert): typeof schema.alerts.$inferInsert => ({
  id: alert.id,
  productId: alert.productId,
  targetPrice: alert.targetPrice.amount,
  currency: alert.targetPrice.currency,
  enabled: alert.enabled,
  triggeredAt: alert.triggeredAt ? toDate(alert.triggeredAt) : null,
  createdAt: toDate(alert.createdAt),
});

const eventToRow = (event: DomainEvent): typeof schema.domainEvents.$inferInsert => ({
  id: event.id,
  productId: event.productId,
  type: event.type,
  message: event.message,
  payload: {},
  createdAt: toDate(event.createdAt),
});

const makeEvent = (event: Omit<DomainEvent, "createdAt" | "id">): DomainEvent => ({
  ...event,
  id: makeId("event"),
  createdAt: nowIso(),
});

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
    readonly deleteAlert: (alertId: string) => Effect.Effect<Alert, AlertNotFound>;
    readonly getProduct: (productId: string) => Effect.Effect<Product, ProductNotFound>;
    readonly health: Effect.Effect<Health>;
    readonly listAlerts: Effect.Effect<ReadonlyArray<Alert>>;
    readonly listEvents: Effect.Effect<ReadonlyArray<DomainEvent>>;
    readonly listProducts: Effect.Effect<ReadonlyArray<Product>>;
    readonly updateMarketPrices: Effect.Effect<ReadonlyArray<Product>>;
  }
>()("price-monitor/PriceMonitor") {}

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

const EventBusLive = Layer.effect(
  EventBus,
  Effect.gen(function* () {
    const { db } = yield* Database;

    const list = Effect.gen(function* () {
      const rows = yield* db.query.domainEvents
        .findMany({
          limit: 40,
          orderBy: { createdAt: "desc" },
        })
        .pipe(Effect.orDie);

      return rows.map(rowToEvent);
    });

    return {
      list,
      publish: (event) =>
        Effect.gen(function* () {
          const domainEvent = makeEvent(event);

          yield* db.insert(schema.domainEvents).values(eventToRow(domainEvent)).pipe(Effect.orDie);

          return domainEvent;
        }),
    };
  }),
);

const PriceMonitorLive = Layer.effect(
  PriceMonitor,
  Effect.gen(function* () {
    const { db } = yield* Database;
    const eventBus = yield* EventBus;
    const priceProvider = yield* PriceProvider;

    const seedDatabase = Effect.gen(function* () {
      const existingProducts = yield* db
        .select({ id: schema.products.id })
        .from(schema.products)
        .limit(1)
        .pipe(Effect.orDie);

      if (existingProducts.length > 0) {
        return;
      }

      const productRows = seedProducts.map(productToRow);
      const offerRows = seedProducts.flatMap((product) =>
        product.offers.map((offer) => offerToRow(offer, product.id)),
      );
      const historyRows = seedProducts.flatMap((product) =>
        product.history.map((point, index) => historyToRow(point, product.id, index)),
      );
      const alertRows = seedAlerts.map(alertToRow);
      const eventRows = seedEvents.map(eventToRow);

      yield* db
        .transaction((tx) =>
          Effect.gen(function* () {
            yield* tx.insert(schema.products).values(productRows);

            if (offerRows.length > 0) {
              yield* tx.insert(schema.storeOffers).values(offerRows);
            }

            if (historyRows.length > 0) {
              yield* tx.insert(schema.priceHistory).values(historyRows);
            }

            if (alertRows.length > 0) {
              yield* tx.insert(schema.alerts).values(alertRows);
            }

            if (eventRows.length > 0) {
              yield* tx.insert(schema.domainEvents).values(eventRows);
            }
          }),
        )
        .pipe(Effect.orDie);
    });

    const listProducts = Effect.gen(function* () {
      const rows = yield* db.query.products
        .findMany({
          orderBy: { name: "asc" },
          with: {
            history: {
              limit: maxHistoryPoints,
              orderBy: { checkedAt: "desc" },
            },
            offers: {
              orderBy: { lastPrice: "asc" },
            },
          },
        })
        .pipe(Effect.orDie);

      return rows.map((row) => rowToProduct(row));
    });

    const getProduct = (productId: string) =>
      Effect.gen(function* () {
        const product = yield* db.query.products
          .findFirst({
            where: { id: productId },
            with: {
              history: {
                limit: maxHistoryPoints,
                orderBy: { checkedAt: "desc" },
              },
              offers: {
                orderBy: { lastPrice: "asc" },
              },
            },
          })
          .pipe(Effect.orDie);

        if (!product) {
          return yield* new ProductNotFound({
            productId,
            message: `Product ${productId} was not found`,
          });
        }

        return rowToProduct(product);
      });

    const listAlerts = Effect.gen(function* () {
      const rows = yield* db.query.alerts
        .findMany({
          orderBy: { createdAt: "desc" },
        })
        .pipe(Effect.orDie);

      return rows.map(rowToAlert);
    });

    const listEvents = eventBus.list;

    const bestPriceFromOffers = (product: Product, offers: Product["offers"]) =>
      offers.reduce<Product["currentPrice"]>(
        (best, offer) => (offer.lastPrice.amount < best.amount ? offer.lastPrice : best),
        offers[0]?.lastPrice ?? product.currentPrice,
      );

    const persistMarketSnapshot = (change: {
      readonly checkedAt: string;
      readonly priceChanged: boolean;
      readonly priceDropped: boolean;
      readonly product: Product;
    }) =>
      db
        .transaction((tx) =>
          Effect.gen(function* () {
            yield* tx
              .update(schema.products)
              .set({
                currentPrice: change.product.currentPrice.amount,
                lowestPrice: change.product.lowestPrice.amount,
                updatedAt: toDate(change.checkedAt),
              })
              .where(eq(schema.products.id, change.product.id));

            yield* Effect.forEach(change.product.offers, (offer) =>
              tx
                .update(schema.storeOffers)
                .set({
                  lastPrice: offer.lastPrice.amount,
                  lastCheckedAt: toDate(offer.lastCheckedAt),
                })
                .where(eq(schema.storeOffers.id, offer.id)),
            );

            if (!change.priceChanged) {
              return;
            }

            yield* tx.insert(schema.priceHistory).values({
              id: makeId("history"),
              productId: change.product.id,
              amount: change.product.currentPrice.amount,
              currency: change.product.currentPrice.currency,
              checkedAt: toDate(change.checkedAt),
            });

            const priceEvent = makeEvent({
              type: change.priceDropped ? "PriceDropped" : "PriceUpdated",
              productId: change.product.id,
              message: change.priceDropped
                ? `Cena ${change.product.name} spadła do ${change.product.currentPrice.amount} PLN.`
                : `Cena ${change.product.name} zmieniła się do ${change.product.currentPrice.amount} PLN.`,
            });

            yield* tx.insert(schema.domainEvents).values(eventToRow(priceEvent));

            const triggeredAlerts = yield* tx
              .update(schema.alerts)
              .set({ triggeredAt: toDate(change.checkedAt) })
              .where(
                and(
                  eq(schema.alerts.productId, change.product.id),
                  eq(schema.alerts.enabled, true),
                  isNull(schema.alerts.triggeredAt),
                  gte(schema.alerts.targetPrice, change.product.currentPrice.amount),
                ),
              )
              .returning();

            yield* Effect.forEach(triggeredAlerts, (alert) =>
              tx.insert(schema.domainEvents).values(
                eventToRow(
                  makeEvent({
                    type: "AlertTriggered",
                    productId: change.product.id,
                    message: `Alert ${alert.targetPrice} PLN dla ${change.product.name} został uruchomiony.`,
                  }),
                ),
              ),
            );
          }),
        )
        .pipe(Effect.orDie);

    const updateMarketPrices = Effect.gen(function* () {
      const products = yield* listProducts;
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

          return { checkedAt, priceChanged, priceDropped, product: updatedProduct };
        }),
      );

      yield* Effect.forEach(changes, persistMarketSnapshot);

      return yield* listProducts;
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

          yield* db.insert(schema.alerts).values(alertToRow(alert)).pipe(Effect.orDie);

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
      deleteAlert: (alertId: string) =>
        Effect.gen(function* () {
          const deletedRows = yield* db
            .delete(schema.alerts)
            .where(eq(schema.alerts.id, alertId))
            .returning()
            .pipe(Effect.orDie);
          const deletedAlert = deletedRows[0];

          if (!deletedAlert) {
            return yield* new AlertNotFound({
              alertId,
              message: `Alert ${alertId} was not found`,
            });
          }

          return rowToAlert(deletedAlert);
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

    yield* seedDatabase;

    yield* Effect.gen(function* () {
      while (true) {
        yield* Effect.sleep(priceDriftInterval);
        yield* monitor.updateMarketPrices;
      }
    }).pipe(Effect.forkScoped({ startImmediately: true }));

    return monitor;
  }),
);

const DatabaseLayer = DatabaseLive({ databaseUrl: serverConfig.databaseUrl });

const InfrastructureLive = EventBusLive.pipe(
  Layer.provideMerge(DatabaseLayer),
  Layer.merge(PriceProviderLive),
);

export const ServicesLive = PriceMonitorLive.pipe(Layer.provide(InfrastructureLive));

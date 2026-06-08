import { defineRelations } from "drizzle-orm/relations";
import { boolean, integer, jsonb, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const money = (name: string) => numeric(name, { precision: 12, scale: 2, mode: "number" });

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  imageUrl: text("image_url").notNull(),
  currentPrice: money("current_price").notNull(),
  lowestPrice: money("lowest_price").notNull(),
  currency: text("currency").notNull().default("PLN"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const storeOffers = pgTable("store_offers", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  storeName: text("store_name").notNull(),
  url: text("url").notNull(),
  lastPrice: money("last_price").notNull(),
  currency: text("currency").notNull().default("PLN"),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).notNull().defaultNow(),
});

export const priceHistory = pgTable("price_history", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  amount: money("amount").notNull(),
  currency: text("currency").notNull().default("PLN"),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
});

export const alerts = pgTable("alerts", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  targetPrice: money("target_price").notNull(),
  currency: text("currency").notNull().default("PLN"),
  enabled: boolean("enabled").notNull().default(true),
  triggeredAt: timestamp("triggered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const domainEvents = pgTable("domain_events", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  message: text("message").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const priceCheckJobs = pgTable("price_check_jobs", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("queued"),
  attempts: integer("attempts").notNull().default(0),
  runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schema = {
  alerts,
  domainEvents,
  priceCheckJobs,
  priceHistory,
  products,
  storeOffers,
};

export const relations = defineRelations(
  schema,
  ({ alerts, domainEvents, many, one, priceCheckJobs, priceHistory, products, storeOffers }) => ({
    alerts: {
      product: one.products({
        from: alerts.productId,
        to: products.id,
        optional: false,
      }),
    },
    domainEvents: {
      product: one.products({
        from: domainEvents.productId,
        to: products.id,
        optional: false,
      }),
    },
    priceCheckJobs: {
      product: one.products({
        from: priceCheckJobs.productId,
        to: products.id,
        optional: false,
      }),
    },
    priceHistory: {
      product: one.products({
        from: priceHistory.productId,
        to: products.id,
        optional: false,
      }),
    },
    products: {
      alerts: many.alerts({
        from: products.id,
        to: alerts.productId,
      }),
      events: many.domainEvents({
        from: products.id,
        to: domainEvents.productId,
      }),
      history: many.priceHistory({
        from: products.id,
        to: priceHistory.productId,
      }),
      offers: many.storeOffers({
        from: products.id,
        to: storeOffers.productId,
      }),
      priceCheckJobs: many.priceCheckJobs({
        from: products.id,
        to: priceCheckJobs.productId,
      }),
    },
    storeOffers: {
      product: one.products({
        from: storeOffers.productId,
        to: products.id,
        optional: false,
      }),
    },
  }),
);

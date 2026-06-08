import { relations } from "drizzle-orm";
import { boolean, integer, jsonb, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  imageUrl: text("image_url").notNull(),
  currentPrice: numeric("current_price", { precision: 12, scale: 2 }).notNull(),
  lowestPrice: numeric("lowest_price", { precision: 12, scale: 2 }).notNull(),
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
  lastPrice: numeric("last_price", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("PLN"),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).notNull().defaultNow(),
});

export const priceHistory = pgTable("price_history", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("PLN"),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
});

export const alerts = pgTable("alerts", {
  id: text("id").primaryKey(),
  productId: text("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  targetPrice: numeric("target_price", { precision: 12, scale: 2 }).notNull(),
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

export const productsRelations = relations(products, ({ many }) => ({
  alerts: many(alerts),
  events: many(domainEvents),
  history: many(priceHistory),
  offers: many(storeOffers),
  priceCheckJobs: many(priceCheckJobs),
}));

export const storeOffersRelations = relations(storeOffers, ({ one }) => ({
  product: one(products, {
    fields: [storeOffers.productId],
    references: [products.id],
  }),
}));

export const priceHistoryRelations = relations(priceHistory, ({ one }) => ({
  product: one(products, {
    fields: [priceHistory.productId],
    references: [products.id],
  }),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  product: one(products, {
    fields: [alerts.productId],
    references: [products.id],
  }),
}));

export const domainEventsRelations = relations(domainEvents, ({ one }) => ({
  product: one(products, {
    fields: [domainEvents.productId],
    references: [products.id],
  }),
}));

export const priceCheckJobsRelations = relations(priceCheckJobs, ({ one }) => ({
  product: one(products, {
    fields: [priceCheckJobs.productId],
    references: [products.id],
  }),
}));

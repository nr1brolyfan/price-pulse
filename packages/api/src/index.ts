import { Schema } from "effect";
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

export const Currency = Schema.Literal("PLN");
export type Currency = typeof Currency.Type;

export const ProductId = Schema.String.check(Schema.isMinLength(1));
export const AlertId = Schema.String.check(Schema.isMinLength(1));
export const EventId = Schema.String.check(Schema.isMinLength(1));

export const Money = Schema.Struct({
  amount: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
  currency: Currency,
});
export type Money = typeof Money.Type;

export const PricePoint = Schema.Struct({
  amount: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
  currency: Currency,
  checkedAt: Schema.String,
});
export type PricePoint = typeof PricePoint.Type;

export const StoreOffer = Schema.Struct({
  id: Schema.String,
  storeName: Schema.String,
  url: Schema.String,
  lastPrice: Money,
  lastCheckedAt: Schema.String,
});
export type StoreOffer = typeof StoreOffer.Type;

export const Product = Schema.Struct({
  id: ProductId,
  name: Schema.String.check(Schema.isMinLength(1)),
  category: Schema.String,
  imageUrl: Schema.String,
  currentPrice: Money,
  lowestPrice: Money,
  offers: Schema.Array(StoreOffer),
  history: Schema.Array(PricePoint),
  updatedAt: Schema.String,
});
export type Product = typeof Product.Type;

export const Alert = Schema.Struct({
  id: AlertId,
  productId: ProductId,
  targetPrice: Money,
  enabled: Schema.Boolean,
  triggeredAt: Schema.optionalKey(Schema.String),
  createdAt: Schema.String,
});
export type Alert = typeof Alert.Type;

export const DomainEvent = Schema.Struct({
  id: EventId,
  type: Schema.Literals(["PriceChecked", "PriceDropped", "PriceUpdated", "AlertTriggered"]),
  productId: ProductId,
  message: Schema.String,
  createdAt: Schema.String,
});
export type DomainEvent = typeof DomainEvent.Type;

export const Health = Schema.Struct({
  status: Schema.Literal("ok"),
  service: Schema.Literal("price-monitor-api"),
  checkedAt: Schema.String,
});
export type Health = typeof Health.Type;

export const Dashboard = Schema.Struct({
  products: Schema.Array(Product),
  alerts: Schema.Array(Alert),
  events: Schema.Array(DomainEvent),
});
export type Dashboard = typeof Dashboard.Type;

export const CreateAlertPayload = Schema.Struct({
  productId: ProductId,
  amount: Schema.Number.check(Schema.isGreaterThan(0)),
});
export type CreateAlertPayload = typeof CreateAlertPayload.Type;

export class ProductNotFound extends Schema.TaggedErrorClass<ProductNotFound>()("ProductNotFound", {
  productId: ProductId,
  message: Schema.String,
}) {}

export const ProductNotFoundResponse = ProductNotFound.pipe(HttpApiSchema.status("NotFound"));

export const MonitorGroup = HttpApiGroup.make("monitor")
  .add(
    HttpApiEndpoint.get("health", "/health", {
      success: Health,
    }),
  )
  .add(
    HttpApiEndpoint.get("dashboard", "/dashboard", {
      success: Dashboard,
    }),
  )
  .add(
    HttpApiEndpoint.get("products", "/products", {
      success: Schema.Array(Product),
    }),
  )
  .add(
    HttpApiEndpoint.get("product", "/products/:productId", {
      params: { productId: ProductId },
      success: Product,
      error: ProductNotFoundResponse,
    }),
  )
  .add(
    HttpApiEndpoint.post("checkPrice", "/products/:productId/check-price", {
      params: { productId: ProductId },
      success: Product,
      error: ProductNotFoundResponse,
    }),
  )
  .add(
    HttpApiEndpoint.get("alerts", "/alerts", {
      success: Schema.Array(Alert),
    }),
  )
  .add(
    HttpApiEndpoint.post("createAlert", "/alerts", {
      payload: CreateAlertPayload,
      success: Alert.pipe(HttpApiSchema.status("Created")),
      error: ProductNotFoundResponse,
    }),
  )
  .add(
    HttpApiEndpoint.get("events", "/events", {
      success: Schema.Array(DomainEvent),
    }),
  )
  .prefix("/api");

export const PriceMonitorApi = HttpApi.make("PriceMonitorApi").add(MonitorGroup);
export type PriceMonitorApi = typeof PriceMonitorApi;

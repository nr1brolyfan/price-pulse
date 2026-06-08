import type { Alert, DomainEvent, Product } from "@price-monitor/api";

const checkedAt = "2026-06-08T09:00:00.000Z";

export const seedProducts: ReadonlyArray<Product> = [
  {
    id: "macbook-air-m3",
    name: "MacBook Air 13 M3",
    category: "Laptops",
    imageUrl:
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=900&auto=format&fit=crop",
    currentPrice: { amount: 4999, currency: "PLN" },
    lowestPrice: { amount: 4899, currency: "PLN" },
    offers: [
      {
        id: "offer-macbook-xkom",
        storeName: "x-kom",
        url: "https://example.com/macbook-air-m3-xkom",
        lastPrice: { amount: 4999, currency: "PLN" },
        lastCheckedAt: checkedAt,
      },
      {
        id: "offer-macbook-media",
        storeName: "Media Expert",
        url: "https://example.com/macbook-air-m3-media",
        lastPrice: { amount: 5099, currency: "PLN" },
        lastCheckedAt: checkedAt,
      },
    ],
    history: [
      { amount: 5299, currency: "PLN", checkedAt: "2026-06-01T09:00:00.000Z" },
      { amount: 5099, currency: "PLN", checkedAt: "2026-06-04T09:00:00.000Z" },
      { amount: 4999, currency: "PLN", checkedAt },
    ],
    updatedAt: checkedAt,
  },
  {
    id: "sony-wh-1000xm5",
    name: "Sony WH-1000XM5",
    category: "Audio",
    imageUrl:
      "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=900&auto=format&fit=crop",
    currentPrice: { amount: 1299, currency: "PLN" },
    lowestPrice: { amount: 1199, currency: "PLN" },
    offers: [
      {
        id: "offer-sony-euro",
        storeName: "RTV Euro AGD",
        url: "https://example.com/sony-wh-1000xm5-euro",
        lastPrice: { amount: 1299, currency: "PLN" },
        lastCheckedAt: checkedAt,
      },
      {
        id: "offer-sony-allegro",
        storeName: "Allegro",
        url: "https://example.com/sony-wh-1000xm5-allegro",
        lastPrice: { amount: 1349, currency: "PLN" },
        lastCheckedAt: checkedAt,
      },
    ],
    history: [
      { amount: 1499, currency: "PLN", checkedAt: "2026-06-01T09:00:00.000Z" },
      { amount: 1399, currency: "PLN", checkedAt: "2026-06-04T09:00:00.000Z" },
      { amount: 1299, currency: "PLN", checkedAt },
    ],
    updatedAt: checkedAt,
  },
  {
    id: "steam-deck-oled",
    name: "Steam Deck OLED 512 GB",
    category: "Gaming",
    imageUrl:
      "https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=900&auto=format&fit=crop",
    currentPrice: { amount: 2699, currency: "PLN" },
    lowestPrice: { amount: 2599, currency: "PLN" },
    offers: [
      {
        id: "offer-steamdeck-komputronik",
        storeName: "Komputronik",
        url: "https://example.com/steam-deck-oled-komputronik",
        lastPrice: { amount: 2699, currency: "PLN" },
        lastCheckedAt: checkedAt,
      },
    ],
    history: [
      { amount: 2899, currency: "PLN", checkedAt: "2026-06-01T09:00:00.000Z" },
      { amount: 2799, currency: "PLN", checkedAt: "2026-06-04T09:00:00.000Z" },
      { amount: 2699, currency: "PLN", checkedAt },
    ],
    updatedAt: checkedAt,
  },
  {
    id: "iphone-15-pro",
    name: "iPhone 15 Pro 128 GB",
    category: "Smartphones",
    imageUrl:
      "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=900&auto=format&fit=crop",
    currentPrice: { amount: 4599, currency: "PLN" },
    lowestPrice: { amount: 4499, currency: "PLN" },
    offers: [
      {
        id: "offer-iphone-ispot",
        storeName: "iSpot",
        url: "https://example.com/iphone-15-pro-ispot",
        lastPrice: { amount: 4699, currency: "PLN" },
        lastCheckedAt: checkedAt,
      },
      {
        id: "offer-iphone-mediaexpert",
        storeName: "Media Expert",
        url: "https://example.com/iphone-15-pro-mediaexpert",
        lastPrice: { amount: 4599, currency: "PLN" },
        lastCheckedAt: checkedAt,
      },
      {
        id: "offer-iphone-allegro",
        storeName: "Allegro",
        url: "https://example.com/iphone-15-pro-allegro",
        lastPrice: { amount: 4649, currency: "PLN" },
        lastCheckedAt: checkedAt,
      },
    ],
    history: [
      { amount: 4999, currency: "PLN", checkedAt: "2026-06-01T09:00:00.000Z" },
      { amount: 4799, currency: "PLN", checkedAt: "2026-06-04T09:00:00.000Z" },
      { amount: 4599, currency: "PLN", checkedAt },
    ],
    updatedAt: checkedAt,
  },
  {
    id: "lg-oled-c3-55",
    name: "LG OLED C3 55-inch",
    category: "TVs",
    imageUrl:
      "https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=900&auto=format&fit=crop",
    currentPrice: { amount: 5299, currency: "PLN" },
    lowestPrice: { amount: 5199, currency: "PLN" },
    offers: [
      {
        id: "offer-lg-rtveuroagd",
        storeName: "RTV Euro AGD",
        url: "https://example.com/lg-oled-c3-rtveuroagd",
        lastPrice: { amount: 5399, currency: "PLN" },
        lastCheckedAt: checkedAt,
      },
      {
        id: "offer-lg-mediaexpert",
        storeName: "Media Expert",
        url: "https://example.com/lg-oled-c3-mediaexpert",
        lastPrice: { amount: 5299, currency: "PLN" },
        lastCheckedAt: checkedAt,
      },
      {
        id: "offer-lg-neonet",
        storeName: "Neonet",
        url: "https://example.com/lg-oled-c3-neonet",
        lastPrice: { amount: 5449, currency: "PLN" },
        lastCheckedAt: checkedAt,
      },
    ],
    history: [
      { amount: 5799, currency: "PLN", checkedAt: "2026-06-01T09:00:00.000Z" },
      { amount: 5499, currency: "PLN", checkedAt: "2026-06-04T09:00:00.000Z" },
      { amount: 5299, currency: "PLN", checkedAt },
    ],
    updatedAt: checkedAt,
  },
];

export const seedAlerts: ReadonlyArray<Alert> = [
  {
    id: "alert-macbook-4900",
    productId: "macbook-air-m3",
    targetPrice: { amount: 4900, currency: "PLN" },
    enabled: true,
    createdAt: "2026-06-03T12:00:00.000Z",
  },
  {
    id: "alert-sony-1200",
    productId: "sony-wh-1000xm5",
    targetPrice: { amount: 1200, currency: "PLN" },
    enabled: true,
    createdAt: "2026-06-05T12:00:00.000Z",
  },
];

export const seedEvents: ReadonlyArray<DomainEvent> = [
  {
    id: "event-seed-1",
    type: "PriceDropped",
    productId: "macbook-air-m3",
    message: "Price for MacBook Air 13 M3 dropped by 100 PLN.",
    createdAt: "2026-06-08T09:00:00.000Z",
  },
  {
    id: "event-seed-2",
    type: "PriceChecked",
    productId: "sony-wh-1000xm5",
    message: "Checked 2 offers for Sony WH-1000XM5.",
    createdAt: "2026-06-08T09:00:00.000Z",
  },
];

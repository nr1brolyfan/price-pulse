# PricePulse

PricePulse is a full-stack price monitoring application built for the university project topic: **price monitoring app**.

The app lets users track product prices, compare store offers, create price alerts, and see automatic alert notifications when monitored prices fall below configured thresholds.

Full project documentation in Polish is available in [`docs/DOKUMENTACJA.md`](./docs/DOKUMENTACJA.md).

## Preview

![PricePulse dashboard](./docs/image.png)

![PricePulse product details](./docs/image-2.png)

## Features

- Product dashboard with automatic price updates
- Collapsible product cards
- Local product search by name and category
- Responsive SVG price history chart
- Store offer comparison sorted by price
- Price alerts with create and delete actions
- Alert notification UX: toast, product jump, banner, highlight, and sound
- Alert journal with filters
- System event journal
- Typed API contract shared by frontend and backend

## Stack

- TypeScript
- Effect v4 beta HTTP API backend
- React
- TanStack Start
- TanStack Query
- Vite
- Tailwind CSS
- Drizzle ORM 1 RC with Effect-native PostgreSQL support
- PostgreSQL in Docker Compose
- Oxlint and Oxfmt

## Project Structure

```txt
price-monitor/
├── apps/
│   ├── server/      # Effect HTTP API backend
│   └── web/         # React + TanStack Start frontend
├── packages/
│   ├── api/         # Shared Effect Schema + HttpApi contract
│   ├── db/          # Drizzle ORM schema and Dockerized PostgreSQL
│   └── ui/          # Shared UI primitives and styles
└── docs/            # Full project documentation and screenshots
```

## Getting Started

Install dependencies:

```bash
pnpm install
```

Run Dockerized PostgreSQL, push the Drizzle schema, and start the frontend and backend:

```bash
pnpm dev
```

Start only the database:

```bash
pnpm docker
```

Push the Drizzle schema manually:

```bash
pnpm db:push
```

Run only the backend:

```bash
pnpm dev:server
```

This requires PostgreSQL to be running and the schema to be pushed already.

Run only the frontend:

```bash
pnpm dev:web
```

## Local URLs

| Service     | URL                     |
| ----------- | ----------------------- |
| Frontend    | `http://localhost:3001` |
| Backend API | `http://localhost:3000` |

The web app proxies `/api` requests to the backend in development.

## API Overview

All API routes are served under `/api`.

| Method   | Endpoint                               | Description                            |
| -------- | -------------------------------------- | -------------------------------------- |
| `GET`    | `/api/health`                          | API health status                      |
| `GET`    | `/api/dashboard`                       | Products, alerts, and events snapshot  |
| `GET`    | `/api/products`                        | Product list                           |
| `GET`    | `/api/products/:productId`             | Product details                        |
| `POST`   | `/api/products/:productId/check-price` | Read current price without changing it |
| `GET`    | `/api/alerts`                          | Alert list                             |
| `POST`   | `/api/alerts`                          | Create alert                           |
| `DELETE` | `/api/alerts/:alertId`                 | Delete alert                           |
| `GET`    | `/api/events`                          | System event list                      |

## Validation

Run linting and formatting:

```bash
pnpm check
```

Check TypeScript types:

```bash
pnpm check-types
```

Build all packages and apps:

```bash
pnpm build
```

## Data

Runtime data is stored in PostgreSQL. The backend uses Drizzle ORM 1 RC through the Effect-native PostgreSQL driver from `@effect/sql-pg`.

On first startup, the backend seeds products, offers, price history, alerts, and events when the `products` table is empty. Price updates, alert creation/deletion, triggered alerts, and system events are persisted in the database.

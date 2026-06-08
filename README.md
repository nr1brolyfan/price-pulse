# PricePulse

PricePulse is a full-stack price monitoring application built for the university project topic: **price monitoring app**.

The app lets users track product prices, compare store offers, create price alerts, and see automatic alert notifications when monitored prices fall below configured thresholds.

Full project documentation in Polish is available in [`docs/DOKUMENTACJA.md`](./docs/DOKUMENTACJA.md).

## Preview

![PricePulse product dashboard](./docs/image-2.png)

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
- Drizzle schema package for future persistence
- Oxlint and Oxfmt

## Project Structure

```txt
price-monitor/
├── apps/
│   ├── server/      # Effect HTTP API backend
│   └── web/         # React + TanStack Start frontend
├── packages/
│   ├── api/         # Shared Effect Schema + HttpApi contract
│   ├── db/          # Drizzle schema
│   └── ui/          # Shared UI primitives and styles
└── docs/            # Full project documentation and screenshots
```

## Getting Started

Install dependencies:

```bash
pnpm install
```

Run the frontend and backend together:

```bash
pnpm dev
```

Run only the backend:

```bash
pnpm dev:server
```

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

The current demo version uses seeded in-memory state. The repository includes a Drizzle database schema in `packages/db`, but runtime persistence is not enabled in this version.

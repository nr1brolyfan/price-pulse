# PricePulse - aplikacja do monitorowania cen

## 1. Cel projektu

PricePulse realizuje temat: **Aplikacja do monitorowania cen**.

System umożliwia:

- śledzenie cen produktów w różnych sklepach,
- porównywanie ofert sklepów,
- ustawianie alertów cenowych,
- automatyczne wykrywanie spadków cen,
- prezentowanie historii cen na wykresie,
- przeglądanie dziennika alertów i zdarzeń systemowych.

Projekt jest aplikacją webową typu full-stack. Backend udostępnia typed HTTP API, a frontend korzysta z tego samego kontraktu typów.

![Dashboard](image.png)

## 2. Zakres funkcjonalny

### 2.1 Dashboard

Dashboard pokazuje skrócony stan systemu:

- liczba produktów,
- liczba aktywnych alertów,
- liczba uruchomionych alertów.

Sekcja została uproszczona, aby nie zajmowała dużo miejsca. Szczegóły alertów i zdarzeń są dostępne z poziomu navbaru.

### 2.2 Lista produktów

Produkty są domyślnie zwinięte. W stanie zwiniętym widoczna jest tylko najważniejsza część karty:

- miniatura produktu,
- kategoria,
- nazwa produktu,
- data ostatniej aktualizacji,
- liczba ofert,
- liczba pomiarów,
- liczba aktywnych alertów,
- aktualna cena,
- najniższa cena,
- informacja o spadku od startu, jeśli występuje.

Każdą kartę można rozwinąć pojedynczo. Nad listą produktów są też globalne akcje:

- `Rozwiń widoczne`,
- `Zwiń widoczne`.

Akcje działają na aktualnie widocznych produktach, czyli respektują filtr wyszukiwania.

![Zwinięte karty produktów](image-1.png)

### 2.3 Wyszukiwanie produktów

Nad listą produktów znajduje się wyszukiwarka. Filtr działa lokalnie po:

- nazwie produktu,
- kategorii produktu.

Jeżeli żaden produkt nie pasuje do zapytania, system pokazuje pusty stan z informacją o braku wyników.

### 2.4 Szczegóły produktu

Po rozwinięciu karty produktu widoczne są:

- wykres historii ceny,
- lista ofert sklepów,
- panel monitoringu alertów.

Kliknięcie `Rozwiń szczegóły` pokazuje pełną część szczegółową. Kliknięcie `Zwiń szczegóły` ponownie ukrywa wykres, oferty i monitoring.

![Rozwinięta karta produktu](image-2.png)

### 2.5 Historia cen

Historia cen jest prezentowana jako wykres liniowy SVG.

Wykres zawiera:

- oś ceny,
- oś daty pomiaru,
- linię ceny,
- wypełnienie pod linią,
- punkty pomiarowe,
- tooltip po najechaniu na punkt,
- ostatnie 12 pomiarów dla czytelności.

Wykres zajmuje pełną szerokość kontenera i jest skalowany responsywnie.

### 2.6 Porównywanie ofert sklepów

Każdy produkt posiada listę ofert ze sklepów.

Oferty są sortowane rosnąco po cenie:

- najtańsza oferta jest najwyżej,
- najdroższa oferta jest najniżej.

Najtańsza oferta otrzymuje oznaczenie `najlepsza`.

![Oferty](image-3.png)

### 2.7 Alerty cenowe

Dla produktu można dodać alert cenowy przez wpisanie progu ceny i kliknięcie `Dodaj alert`.

Alert może być:

- aktywny, czyli oczekujący na osiągnięcie progu,
- uruchomiony, czyli wykryty po spadku ceny do progu lub poniżej.

Alert można usunąć:

- z panelu monitoringu produktu,
- z modalnego dziennika alertów w navbarze.

Jeśli alert zostanie dodany z progiem większym lub równym aktualnej cenie, uruchamia się od razu.

### 2.8 Sygnalizacja uruchomionego alertu

Po wykryciu alertu system używa kilku form sygnalizacji:

- toast `Alert cenowy uruchomiony`,
- przycisk `Pokaż` w toastcie,
- automatyczne przewinięcie do właściwej karty produktu po kliknięciu `Pokaż`,
- automatyczne rozwinięcie właściwej karty produktu po kliknięciu `Pokaż`,
- globalny banner alertu nad listą produktów,
- przycisk `Pokaż produkt` w bannerze,
- zielona poświata i podświetlenie karty produktu,
- badge `nowy alert` przy produkcie,
- krótki dźwięk przez Web Audio API po pierwszej interakcji użytkownika.

Dźwięk jest aktywowany dopiero po interakcji użytkownika, ponieważ przeglądarki blokują automatyczne odtwarzanie audio bez interakcji.

![Reakcja na alert](image-4.png)

### 2.9 Dziennik alertów

Dziennik alertów jest dostępny w navbarze pod przyciskiem `Alerty`.

Modal alertów ma:

- stałą wysokość około 680 px,
- scrollowaną zawartość,
- listę alertów,
- przyciski usuwania alertów,
- filtrowanie.

Dostępne filtry:

- `Wszystkie`,
- `Aktywne`,
- `Uruchomione`.

Każdy filtr pokazuje licznik alertów. Jeżeli filtr nie ma wyników, modal zachowuje stały rozmiar i pokazuje pusty stan.

![Modal z alertami](image-5.png)

### 2.10 Zdarzenia systemowe

Zdarzenia systemowe są dostępne w navbarze pod przyciskiem `Zdarzenia`.

Modal zdarzeń pokazuje m.in.:

- automatyczne aktualizacje cen,
- spadki cen,
- uruchomione alerty,
- ręczne pobrania aktualnej ceny, jeśli endpoint zostanie użyty.

Modal ma stałą wysokość i scrollowaną listę, aby nie zmieniał rozmiaru przy małej liczbie wpisów.

![Modal ze zdarzeniami systemowymi](image-6.png)

## 3. Automatyczne monitorowanie cen

System nie zmienia ceny po kliknięciu użytkownika. Zmiana ceny odbywa się automatycznie po stronie backendu.

Mechanizm działania:

- backend uruchamia background fiber w Effect,
- co około 3 sekundy ceny ofert dryfują losowo niewielkim krokiem,
- system wybiera najtańszą ofertę jako aktualną cenę produktu,
- jeśli cena się zmieniła, dodawany jest punkt historii ceny,
- jeśli cena spadła poniżej progu alertu, alert zostaje uruchomiony,
- zdarzenia są zapisywane w PostgreSQL i publikowane przez EventBus.

Frontend odświeża dashboard przez TanStack Query co 1 sekundę. Dzięki temu użytkownik widzi zmiany ceny, wykresu i alertów bez ręcznego odświeżania strony.

## 4. Dane demonstracyjne

Aplikacja startuje z danymi seedowymi zapisanymi w PostgreSQL. Seedowanie wykonuje się przy starcie backendu, jeśli tabela `products` jest pusta.

Produkty seedowe:

| Produkt                |  Kategoria | Liczba ofert |
| ---------------------- | ---------: | -----------: |
| MacBook Air 13 M3      |    Laptopy |            2 |
| Sony WH-1000XM5        |      Audio |            2 |
| Steam Deck OLED 512 GB |     Gaming |            1 |
| iPhone 15 Pro 128 GB   |  Smartfony |            3 |
| LG OLED C3 55 cali     | Telewizory |            3 |

Seed zawiera też początkowe alerty i zdarzenia systemowe.

## 5. Architektura aplikacji

Projekt jest monorepo TypeScript.

Główne części:

| Część        | Ścieżka        | Rola                                                 |
| ------------ | -------------- | ---------------------------------------------------- |
| Frontend     | `apps/web`     | React, TanStack Start, TanStack Query, UI dashboardu |
| Backend      | `apps/server`  | Effect HTTP API, serwisy, background monitoring      |
| Kontrakt API | `packages/api` | Wspólne typy, Effect Schema, HttpApi                 |
| UI           | `packages/ui`  | Wspólne komponenty shadcn/Base UI                    |
| DB           | `packages/db`  | Drizzle ORM 1 RC, PostgreSQL, Docker Compose         |

### 5.1 Backend

Backend został zbudowany na Effect v4 beta i typed HTTP API.

Najważniejsze elementy backendu:

- `PriceMonitor` - główny serwis logiki domenowej,
- `PriceProvider` - symulacja nowych cen ofert,
- `EventBus` - dziennik zdarzeń domenowych zapisywany w PostgreSQL,
- `Database` - Effect layer z Drizzle ORM i `@effect/sql-pg`,
- `ServicesLive` - kompozycja warstw Effect,
- background fiber - automatyczna aktualizacja cen.

Backend działa na porcie `3000`.

### 5.2 Frontend

Frontend został zbudowany w React z TanStack Start.

Najważniejsze elementy frontendu:

- typed client na podstawie `PriceMonitorApi`,
- TanStack Query do pobierania dashboardu i mutacji,
- polling dashboardu co 1 sekundę,
- zwijane karty produktów,
- modalne dzienniki alertów i zdarzeń,
- wyszukiwarka produktów,
- sortowanie ofert po cenie,
- obsługa toastów, dźwięków i podświetleń alertów.

Frontend działa na porcie `3001`.

### 5.3 Wspólny kontrakt API

`packages/api` zawiera:

- schematy Effect Schema,
- typy domenowe,
- definicję `HttpApi`,
- typed errors,
- definicje endpointów.

Dzięki temu frontend i backend korzystają z tego samego kontraktu. Ogranicza to ryzyko rozjazdu typów między klientem i API.

## 6. API

Wszystkie endpointy są pod prefiksem `/api`.

| Metoda   | Endpoint                               | Opis                                              |
| -------- | -------------------------------------- | ------------------------------------------------- |
| `GET`    | `/api/health`                          | Status API                                        |
| `GET`    | `/api/dashboard`                       | Produkty, alerty i zdarzenia w jednym snapshotcie |
| `GET`    | `/api/products`                        | Lista produktów                                   |
| `GET`    | `/api/products/:productId`             | Szczegóły produktu                                |
| `POST`   | `/api/products/:productId/check-price` | Pull aktualnej ceny bez zmiany ceny               |
| `GET`    | `/api/alerts`                          | Lista alertów                                     |
| `POST`   | `/api/alerts`                          | Utworzenie alertu                                 |
| `DELETE` | `/api/alerts/:alertId`                 | Usunięcie alertu                                  |
| `GET`    | `/api/events`                          | Lista zdarzeń systemowych                         |

Błędy domenowe:

| Błąd              | Kiedy występuje                 |
| ----------------- | ------------------------------- |
| `ProductNotFound` | Produkt o danym ID nie istnieje |
| `AlertNotFound`   | Alert o danym ID nie istnieje   |

## 7. Model danych

Najważniejsze typy domenowe:

| Typ           | Opis                                  |
| ------------- | ------------------------------------- |
| `Product`     | Produkt monitorowany przez system     |
| `StoreOffer`  | Oferta produktu w konkretnym sklepie  |
| `PricePoint`  | Punkt historii ceny                   |
| `Alert`       | Reguła alertu cenowego                |
| `DomainEvent` | Zdarzenie domenowe systemu            |
| `Dashboard`   | Snapshot produktów, alertów i zdarzeń |

Projekt używa schematu bazy danych w `packages/db`:

- `products`,
- `storeOffers`,
- `priceHistory`,
- `alerts`,
- `domainEvents`,
- `priceCheckJobs`.

Runtime aplikacji przechowuje dane w PostgreSQL. Trwale zapisywane są produkty, oferty, historia cen, alerty i zdarzenia systemowe.

## 8. Uruchamianie projektu

Wymagania:

- Node.js,
- pnpm,
- Docker z Docker Compose.

Instalacja zależności:

```bash
pnpm install
```

Uruchomienie PostgreSQL w Dockerze, wypchnięcie schematu Drizzle i start frontendu oraz backendu:

```bash
pnpm dev
```

Uruchomienie samej bazy danych:

```bash
pnpm docker
```

Ręczne wypchnięcie schematu Drizzle do PostgreSQL:

```bash
pnpm db:push
```

Uruchomienie tylko backendu:

```bash
pnpm dev:server
```

Uruchomienie tylko frontendu:

```bash
pnpm dev:web
```

Adresy:

| Usługa      | URL                     |
| ----------- | ----------------------- |
| Frontend    | `http://localhost:3001` |
| Backend API | `http://localhost:3000` |
| PostgreSQL  | `localhost:5432`        |

Domyślny connection string zgodny z `docker-compose.yml`:

```txt
postgresql://postgres:password@localhost:5432/price-monitor
```

Jeżeli backend zgłasza `EADDRINUSE`, oznacza to, że port `3000` jest już zajęty przez inną instancję serwera.

Sprawdzenie procesu:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

Zatrzymanie procesu:

```bash
kill <PID>
```

## 9. Walidacja projektu

Użyte komendy walidacyjne:

```bash
pnpm check
pnpm check-types
pnpm --filter server build
pnpm --filter web build
```

Zakres walidacji:

- formatowanie i lint,
- pełne sprawdzenie typów TypeScript,
- build backendu,
- build frontendu,
- runtime check endpointów backendu podczas implementacji.

Build frontendu przechodzi poprawnie. Vite pokazuje ostrzeżenie o dużym chunku JavaScript, ale nie blokuje to działania aplikacji.

## 10. Najważniejsze decyzje projektowe

### 10.1 Automatyczne zmiany cen zamiast ręcznego zmieniania

Ręczne sprawdzanie ceny nie powinno samo zmieniać ceny produktu. Dlatego aktualizacje cen są generowane automatycznie przez backend. Frontend tylko odbiera aktualny stan.

### 10.2 Jeden snapshot dashboardu

Frontend pobiera `/api/dashboard`, czyli jeden snapshot z produktami, alertami i zdarzeniami. Upraszcza to synchronizację UI.

### 10.3 Polling zamiast WebSocket/SSE

Do realtime-like aktualizacji użyto TanStack Query polling co 1 sekundę. Jest to prostsze, stabilne i wystarczające dla demonstracyjnego monitoringu cen.

### 10.4 Zwijane karty produktów

Karty produktów są domyślnie zwinięte, żeby dashboard nie był zbyt długi. Szczegóły są dostępne po rozwinięciu.

### 10.5 Modalne dzienniki

Dziennik alertów i zdarzeń przeniesiono do navbaru. Dzięki temu główny ekran skupia się na produktach, a szczegóły są dostępne na żądanie.

### 10.6 PostgreSQL zamiast stanu in-memory

Stan aplikacji jest przechowywany w PostgreSQL uruchamianym przez Docker Compose. Backend używa Drizzle ORM 1 RC z natywną integracją Effect dla PostgreSQL, więc operacje bazodanowe są wykonywane jako efekty, a nie przez ręczne promisy poza systemem Effect.

## 11. Podsumowanie

Projekt spełnia wymagania aplikacji do monitorowania cen:

- produkty są prezentowane w dashboardzie,
- ceny są śledzone automatycznie,
- oferty sklepów są porównywane i sortowane po cenie,
- użytkownik może tworzyć i usuwać alerty,
- alerty uruchamiają się automatycznie po osiągnięciu progu,
- historia cen jest widoczna na wykresie,
- użytkownik może filtrować dziennik alertów,
- stan aplikacji jest trwale zapisywany w PostgreSQL,
- UI sygnalizuje alert toastem, dźwiękiem, bannerem i podświetleniem karty,
- frontend i backend korzystają ze wspólnego typed API contract.

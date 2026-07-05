# Taxi Fleet Tracking – REST API Design Document

> **Status:** Draft v1.0 — 2026-07-05  
> **Author:** Antigravity AI  
> **Runtime:** Node.js + Express (CommonJS)  
> **Data store:** In-memory from `seed.json` (no database, no auth)

---

## 1. Business Context

A taxi company operates a fleet of **tuk-tuks / taxis** spread across the nine provinces
of Sri Lanka.  Each vehicle carries a GPS telemetry device (`TUK-DEV-xxxxx`) that
periodically emits its location as a **ping**.  Vehicles are administratively assigned to
**stations** (local depots), which belong to **districts**, which belong to **provinces**.

The company wants a REST API that lets internal operations staff (dispatchers, fleet
managers, analysts) answer questions such as:

| Who is asking? | What they need |
|---|---|
| Fleet dispatcher | "Where are all vehicles right now?" |
| Station manager | "Which vehicles are registered to my station?" |
| Analyst | "Show me the ping history for vehicle #42 over the last week." |
| Admin | "List all districts in the Western Province." |

---

## 2. Assumptions

The following assumptions were made in the absence of explicit requirements.  Any item
marked **⚠ ASK** is a decision that the product owner should confirm before the API is
shipped.

| # | Assumption | Rationale |
|---|---|---|
| A1 | The system is **read-only** for external consumers (all routes are GET). | The seed data is loaded at startup; no mutations are in scope for this phase. |
| A2 | **No authentication or authorisation** is implemented in this phase. | Explicitly stated in the brief. |
| A3 | **No database** — all data lives in the in-memory copy of `seed.json`. | Explicitly stated in the brief. |
| A4 | A "ping" is a single GPS telemetry record emitted by one vehicle's device. | Inferred from the `pings` collection in `seed.json`: each record has `vehicle_id`, `latitude`, `longitude`, and `timestamp`. |
| A5 | The **latest ping** for a vehicle represents its **last known location**. | The pings have timestamps but the seed data has no `status` field. The most recent timestamp is the best proxy for "current" position. |
| A6 | A **station** is a physical depot where vehicles are registered. It does **not** imply a vehicle is physically there at any moment. | Vehicles may be anywhere; the station is an administrative home base. |
| A7 | `vehicle_id` inside a ping is a **foreign key** to the `vehicles` collection. | Confirmed by seed data structure. |
| A8 | IDs are **positive integers** in all collections. | Confirmed by seed data: all IDs start at 1 and are sequential. |
| A9 | The API returns `Content-Type: application/json` for all endpoints. | Standard REST convention for a data API. |
| A10 | **⚠ ASK** — Should a future `drivers` resource be added? | The seed data has no driver information. If drivers need to be tracked (shift logs, assignments to vehicles), a new entity and routes are required. |
| A11 | **⚠ ASK** — Should pings support real-time streaming (WebSocket / SSE)? | The current design is polling-based (GET). If near-real-time tracking is needed, a streaming endpoint would be a Phase 2 concern. |
| A12 | **⚠ ASK** — Do consumers need pagination on large collections? | The `/pings` collection has 1,435 records across 205 vehicles (~7 per vehicle). The `/vehicles` collection has 205 entries. For now, the API returns full arrays. Adding `?page` & `?limit` query params is easy to retrofit. |
| A13 | **⚠ ASK** — Should the `/vehicles/:vehicleId/pings` route support date-range filtering? | This is the most natural request from analysts ("pings for the last 7 days"). Proposed as a query-string extension. |

---

## 3. Data Model

### 3.1 Entity–Relationship Overview

```
Province  1 ──< District  1 ──< Station  1 ──< Vehicle  1 ──< Ping
```

Every entity at a lower level holds a **foreign key** to its parent:

- `district.province_id` → `Province.id`
- `station.district_id`  → `District.id`
- `vehicle.station_id`   → `Station.id`
- `ping.vehicle_id`      → `Vehicle.id`

### 3.2 Entity Definitions

#### 3.2.1 Province

Represents one of the nine administrative provinces of Sri Lanka.

| Field  | Type    | Constraints             | Description                   |
|--------|---------|-------------------------|-------------------------------|
| `id`   | integer | PK, positive, unique    | Auto-assigned surrogate key   |
| `name` | string  | NOT NULL, unique        | Human-readable province name  |

**Example record:**
```json
{
  "id": 1,
  "name": "Western"
}
```

**Seed count:** 9 records (all nine Sri Lanka provinces).

---

#### 3.2.2 District

Represents one of the 25 administrative districts.

| Field         | Type    | Constraints                      | Description                           |
|---------------|---------|----------------------------------|---------------------------------------|
| `id`          | integer | PK, positive, unique             | Auto-assigned surrogate key           |
| `name`        | string  | NOT NULL, unique                 | Human-readable district name          |
| `province_id` | integer | FK → Province.id, NOT NULL       | The province this district belongs to |

**Example record:**
```json
{
  "id": 1,
  "name": "Colombo",
  "province_id": 1
}
```

**Seed count:** 25 records.

---

#### 3.2.3 Station

A local depot / administrative home base for a group of vehicles.

| Field         | Type    | Constraints                | Description                            |
|---------------|---------|----------------------------|----------------------------------------|
| `id`          | integer | PK, positive, unique       | Auto-assigned surrogate key            |
| `name`        | string  | NOT NULL                   | Station name                           |
| `district_id` | integer | FK → District.id, NOT NULL | The district this station belongs to   |

**Example record:**
```json
{
  "id": 1,
  "name": "Colombo Police Station",
  "district_id": 1
}
```

**Seed count:** 25 records (one per district).

> **Assumption A6:** The station names reference "Police Station" in the seed data —
> this is likely a placeholder label. In production these would be renamed to something
> like "Colombo Central Depot". The API design is agnostic to the label.

---

#### 3.2.4 Vehicle

A single taxi / tuk-tuk in the fleet.

| Field                 | Type    | Constraints                | Description                                      |
|-----------------------|---------|----------------------------|--------------------------------------------------|
| `id`                  | integer | PK, positive, unique       | Auto-assigned surrogate key                      |
| `registration_number` | string  | NOT NULL, unique           | Government-issued plate (e.g. `"WP QA-2535"`)   |
| `device_id`           | string  | NOT NULL, unique           | Telemetry device identifier (`"TUK-DEV-10006"`) |
| `station_id`          | integer | FK → Station.id, NOT NULL  | Administrative home station                      |

**Example record:**
```json
{
  "id": 6,
  "registration_number": "WP QA-2535",
  "device_id": "TUK-DEV-10006",
  "station_id": 2
}
```

**Seed count:** 205 records.

**Registration number format:** `<PROVINCE_CODE> <SERIES>-<NUMBER>`
- Province codes observed: `WP`, `SP`, `CP`, `NP`, `EP`, `NW`, `NC`, `SG`, `UP`
  (Sri Lanka provincial vehicle registration prefixes).
- Series: two letters (QB through RG observed).
- Number: four digits.

---

#### 3.2.5 Ping

A single GPS telemetry event emitted by a vehicle's on-board device.

| Field        | Type    | Constraints               | Description                                               |
|--------------|---------|---------------------------|-----------------------------------------------------------|
| `id`         | integer | PK, positive, unique      | Auto-assigned surrogate key                               |
| `vehicle_id` | integer | FK → Vehicle.id, NOT NULL | The vehicle that sent this ping                           |
| `latitude`   | number  | NOT NULL, decimal degrees | WGS-84 latitude (approx. 5.9°–9.8°N for Sri Lanka)      |
| `longitude`  | number  | NOT NULL, decimal degrees | WGS-84 longitude (approx. 79.7°–81.9°E for Sri Lanka)   |
| `timestamp`  | string  | NOT NULL, ISO 8601 UTC    | When the ping was recorded                                |

**Example record:**
```json
{
  "id": 1,
  "vehicle_id": 1,
  "latitude": 7.953895,
  "longitude": 81.009892,
  "timestamp": "2026-06-14T12:31:00Z"
}
```

**Seed count:** 1,435 records (~7 pings per vehicle, covering 2026-06-14 to 2026-06-20).

---

## 4. URL & Resource Design

### 4.1 Naming Rules (REST Best Practices)

1. **Lowercase only** — no uppercase letters in path segments.
2. **Hyphens as word separators** — e.g. `/last-ping`, not `/lastPing` or `/last_ping`.
3. **Plural nouns for collections** — `/vehicles`, `/pings`, `/stations`, etc.
4. **Singular noun for a member** — the collection path + `/:id` param.
5. **Nouns, not verbs** — the HTTP method (GET, POST, PUT, DELETE) carries the action.
6. **Sub-resources for containment** — `/vehicles/:vehicleId/pings` because pings are
   contained within and only meaningful relative to a vehicle.
7. **Query strings for filtering, sorting, pagination** — never encoded in the path.

### 4.2 Base URL

```
http://localhost:5000
```

In production this would be something like `https://api.taxifleet.example.com/v1`.
A `/v1` prefix is recommended before going to production to allow non-breaking evolution,
but is omitted here to keep the development server simple.

---

## 5. Route Catalogue

Every route returns `Content-Type: application/json`.  
All IDs in URL parameters are **positive integers**; passing a non-numeric value yields
a `400 Bad Request` (Phase 2).  Requesting a resource that does not exist yields
`404 Not Found`.

---

### 5.1 Provinces

#### `GET /provinces`
Returns the complete list of provinces.

**Query parameters:** none  
**Response `200 OK`:**
```json
[
  { "id": 1, "name": "Western" },
  { "id": 2, "name": "Central" }
]
```

---

#### `GET /provinces/:provinceId`
Returns a single province by its ID.

**Path parameters:**

| Param        | Type    | Description         |
|--------------|---------|---------------------|
| `provinceId` | integer | ID of the province  |

**Response `200 OK`:**
```json
{ "id": 1, "name": "Western" }
```

**Response `404 Not Found`:**
```json
{ "error": "Province not found" }
```

---

#### `GET /provinces/:provinceId/districts`  *(planned — Phase 2)*
Returns all districts that belong to the given province.

> **Rationale:** A dispatcher filtering by province should be able to drill down without
> making a second request to `/districts` and filtering client-side.

---

### 5.2 Districts

#### `GET /districts`
Returns the complete list of districts.

**Response `200 OK`:**
```json
[
  { "id": 1, "name": "Colombo", "province_id": 1 },
  { "id": 2, "name": "Gampaha", "province_id": 1 }
]
```

---

#### `GET /districts/:districtId`
Returns a single district by its ID.

**Path parameters:**

| Param        | Type    | Description          |
|--------------|---------|----------------------|
| `districtId` | integer | ID of the district   |

**Response `200 OK`:**
```json
{ "id": 1, "name": "Colombo", "province_id": 1 }
```

**Response `404 Not Found`:**
```json
{ "error": "District not found" }
```

---

#### `GET /districts/:districtId/stations`  *(planned — Phase 2)*
Returns all stations in the given district.

---

### 5.3 Stations

#### `GET /stations`
Returns the complete list of stations.

**Response `200 OK`:**
```json
[
  { "id": 1, "name": "Colombo Police Station", "district_id": 1 },
  { "id": 2, "name": "Gampaha Police Station", "district_id": 2 }
]
```

---

#### `GET /stations/:stationId`
Returns a single station by its ID.

**Path parameters:**

| Param       | Type    | Description        |
|-------------|---------|--------------------|
| `stationId` | integer | ID of the station  |

**Response `200 OK`:**
```json
{ "id": 1, "name": "Colombo Police Station", "district_id": 1 }
```

**Response `404 Not Found`:**
```json
{ "error": "Station not found" }
```

---

#### `GET /stations/:stationId/vehicles`  *(planned — Phase 2)*
Returns all vehicles registered to the given station.

> **Rationale:** A station manager's most common query is "what vehicles are mine?".
> This avoids the consumer having to GET all vehicles and filter by `station_id`.

---

### 5.4 Vehicles

#### `GET /vehicles`
Returns the complete list of vehicles.

**Optional query parameters (Phase 2):**

| Param        | Type    | Description                                  |
|--------------|---------|----------------------------------------------|
| `station_id` | integer | Filter to vehicles belonging to this station |

**Response `200 OK`:**
```json
[
  {
    "id": 1,
    "registration_number": "NC QB-1409",
    "device_id": "TUK-DEV-10001",
    "station_id": 21
  }
]
```

---

#### `GET /vehicles/:vehicleId`
Returns a single vehicle by its ID.

**Path parameters:**

| Param       | Type    | Description         |
|-------------|---------|---------------------|
| `vehicleId` | integer | ID of the vehicle   |

**Response `200 OK`:**
```json
{
  "id": 1,
  "registration_number": "NC QB-1409",
  "device_id": "TUK-DEV-10001",
  "station_id": 21
}
```

**Response `404 Not Found`:**
```json
{ "error": "Vehicle not found" }
```

---

#### `GET /vehicles/:vehicleId/pings`
Returns **all pings** for the specified vehicle, ordered by `timestamp` ascending
(oldest first).

**Path parameters:**

| Param       | Type    | Description       |
|-------------|---------|-------------------|
| `vehicleId` | integer | ID of the vehicle |

**Optional query parameters (Phase 2 — date filtering):**

| Param  | Type            | Description                               |
|--------|-----------------|-------------------------------------------|
| `from` | ISO 8601 string | Include only pings at or after this time  |
| `to`   | ISO 8601 string | Include only pings at or before this time |

**Response `200 OK`:**
```json
[
  {
    "id": 1,
    "vehicle_id": 1,
    "latitude": 7.953895,
    "longitude": 81.009892,
    "timestamp": "2026-06-14T12:31:00Z"
  },
  {
    "id": 2,
    "vehicle_id": 1,
    "latitude": 7.94537,
    "longitude": 81.009784,
    "timestamp": "2026-06-15T08:45:00Z"
  }
]
```

**Response `404 Not Found` (vehicle does not exist):**
```json
{ "error": "Vehicle not found" }
```

> **Note:** An existing vehicle with **zero pings** returns `200 OK` with an empty
> array `[]`, not a 404. The resource (the sub-collection) exists; it is simply empty.

---

#### `GET /vehicles/:vehicleId/pings/latest`  *(planned — Phase 2)*
Returns the **single most recent ping** for the vehicle.  This is the primary query
for "where is vehicle #42 right now?".

**Response `200 OK`:**
```json
{
  "id": 7,
  "vehicle_id": 1,
  "latitude": 7.928573,
  "longitude": 81.015606,
  "timestamp": "2026-06-20T12:44:00Z"
}
```

**Response `404 Not Found` (vehicle has no pings yet):**
```json
{ "error": "No pings found for this vehicle" }
```

> **Design note:** `/latest` is a singular-noun member within the pings sub-collection,
> not a verb. It represents "the latest ping record" — a noun concept.

---

## 6. HTTP Status Code Policy

| Status | Meaning in this API |
|--------|---------------------|
| `200 OK` | Request succeeded; body contains the data. |
| `400 Bad Request` | *(Phase 2)* Malformed query parameter or non-integer ID. |
| `404 Not Found` | The requested resource ID does not exist. |
| `500 Internal Server Error` | *(Phase 2)* Unexpected server-side failure; body will include a safe error message. |

---

## 7. Representation Design (Response Bodies)

### 7.1 Collection Representation

All collection endpoints return a **top-level JSON array** of objects. There is no
envelope wrapper (e.g. no `{ "data": [...] }`) at this stage.

```json
[ { ... }, { ... }, { ... } ]
```

> **⚠ ASK (A12):** If pagination is added, the shape must change to an envelope:
> ```json
> {
>   "data": [ { ... }, { ... } ],
>   "meta": { "page": 1, "limit": 20, "total": 205 }
> }
> ```
> This is a **breaking change** for consumers already treating the response as a bare
> array. Decide before v1 ships.

### 7.2 Member Representation

Single-resource endpoints return a **plain JSON object** — never wrapped in an array.

```json
{ "id": 42, "registration_number": "WP RE-4733", ... }
```

### 7.3 Error Representation

All error responses use a consistent shape:

```json
{ "error": "<human-readable message>" }
```

> **Phase 2 enhancement:** Add a machine-readable `"code"` field alongside `"error"`
> so clients can branch on error type programmatically:
> ```json
> { "error": "Vehicle not found", "code": "VEHICLE_NOT_FOUND" }
> ```

### 7.4 Field Naming Convention

All JSON field names use **snake_case** (e.g. `province_id`, `registration_number`,
`vehicle_id`) — matching the existing seed data schema and following PostgreSQL / JSON
conventions common in REST APIs serving multi-language clients.

---

## 8. Currently Implemented Routes (Phase 1)

These routes are live in `index.js`:

| Method | Path                         | Description                    |
|--------|------------------------------|--------------------------------|
| GET    | `/`                          | Health-check / welcome message |
| GET    | `/provinces`                 | List all provinces             |
| GET    | `/provinces/:provinceId`     | Get one province               |
| GET    | `/districts`                 | List all districts             |
| GET    | `/districts/:districtId`     | Get one district               |
| GET    | `/stations`                  | List all stations              |
| GET    | `/stations/:stationId`       | Get one station                |
| GET    | `/vehicles`                  | List all vehicles              |
| GET    | `/vehicles/:vehicleId`       | Get one vehicle                |
| GET    | `/vehicles/:vehicleId/pings` | List all pings for a vehicle   |

---

## 9. Planned Routes (Phase 2)

| Method | Path                                     | Description                              |
|--------|------------------------------------------|------------------------------------------|
| GET    | `/provinces/:provinceId/districts`       | Districts belonging to a province        |
| GET    | `/districts/:districtId/stations`        | Stations in a district                   |
| GET    | `/stations/:stationId/vehicles`          | Vehicles registered to a station         |
| GET    | `/vehicles/:vehicleId/pings/latest`      | The most recent ping for a vehicle       |
| GET    | `/vehicles?station_id=:id`               | Filter vehicles by station               |
| GET    | `/vehicles/:vehicleId/pings?from=&to=`   | Filter pings by date range               |

---

## 10. Phase 2 – Proposed New Entities

The following entities are **not in the seed data** but would be natural additions to a
real taxi-fleet tracking API.

### 10.1 Driver *(future)*

| Field            | Type    | Description                        |
|------------------|---------|------------------------------------|
| `id`             | integer | Surrogate key                      |
| `full_name`      | string  | Driver's full name                 |
| `licence_number` | string  | Government driving-licence number  |
| `phone`          | string  | Contact phone number               |
| `station_id`     | integer | FK → Station (home station)        |

Proposed routes:
- `GET /drivers` — list all drivers
- `GET /drivers/:driverId` — get one driver
- `GET /stations/:stationId/drivers` — drivers assigned to a station

---

### 10.2 Assignment *(future)*

Links a driver to a vehicle for a specific period (a shift).

| Field        | Type      | Description                        |
|--------------|-----------|------------------------------------|
| `id`         | integer   | Surrogate key                      |
| `vehicle_id` | integer   | FK → Vehicle                       |
| `driver_id`  | integer   | FK → Driver                        |
| `started_at` | timestamp | When the shift/assignment started  |
| `ended_at`   | timestamp | When it ended (null = active)      |

Proposed routes:
- `GET /vehicles/:vehicleId/assignments` — shift history for a vehicle
- `GET /drivers/:driverId/assignments` — shift history for a driver

---

### 10.3 Trip *(future)*

A discrete passenger journey from pickup to drop-off.

| Field         | Type      | Description                        |
|---------------|-----------|------------------------------------|
| `id`          | integer   | Surrogate key                      |
| `vehicle_id`  | integer   | FK → Vehicle                       |
| `driver_id`   | integer   | FK → Driver                        |
| `started_at`  | timestamp | Pickup time                        |
| `ended_at`    | timestamp | Drop-off time (null = in progress) |
| `start_lat`   | number    | Pickup latitude                    |
| `start_lng`   | number    | Pickup longitude                   |
| `end_lat`     | number    | Drop-off latitude                  |
| `end_lng`     | number    | Drop-off longitude                 |
| `fare_amount` | number    | Fare charged (in LKR)              |

Proposed routes:
- `GET /trips` — list all trips (with date-range filter)
- `GET /vehicles/:vehicleId/trips` — trip history for a vehicle

---

## 11. File Structure

```
WEB_API/
├── index.js          <- Express server + all routes (Phase 1 implemented)
├── seed.json         <- In-memory data source loaded at startup
├── package.json      <- Node dependencies (express ^5.2.1)
├── vercel.json       <- Deployment config for Vercel
├── .env              <- Environment variables (PORT)
├── .gitignore
└── project.md        <- This document
```

---

## 12. Open Questions for Product Owner

1. **(A10) Drivers:** Do we need to track which driver is currently assigned to which
   vehicle? If yes, the `Driver` and `Assignment` entities in §10 need to be seeded
   and exposed.

2. **(A11) Real-time streaming:** Is the dispatcher dashboard polling the API at
   intervals, or does it need a push channel (WebSocket / Server-Sent Events)? This
   has a significant architecture impact.

3. **(A12) Pagination:** The `/vehicles` collection has 205 records and `/pings` has
   1,435. For a browser UI this is fine. If a mobile app or embedded device will
   consume the API, pagination is necessary to protect bandwidth.

4. **(A13) Date-range filtering on pings:** The seed data covers 2026-06-14 to
   2026-06-20 (7 days). In production, pings will accumulate rapidly. Should the API
   default to "last 24 hours" rather than "all time"?

5. **Response envelope vs bare array:** If pagination will ever be added, the collection
   response shape must change (see §7.1). Decide now to avoid a breaking change later.

6. **API versioning:** Should a `/v1/` prefix be added to all routes before the first
   external consumer integrates? It costs nothing now and saves a painful migration later.

---

*End of document.*

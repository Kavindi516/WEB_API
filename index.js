'use strict';

require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');

const { Province, District, Station, Vehicle, Ping } = require('./models');

const app  = express();
const port = process.env.PORT     || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/taxi_fleet';

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json());

// Return a clean JSON 400 when the client sends malformed JSON
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  next(err);
});

// X-API-Key authentication (used by POST routes)
const API_KEY = process.env.API_KEY || 'key_v01';

function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: 'Missing or invalid X-API-Key header' });
  }
  next();
}

// ── Provinces ─────────────────────────────────────────────────────────────────

app.get('/provinces', async (req, res, next) => {
  try {
    const provinces = await Province.find().sort({ id: 1 });
    res.json(provinces);
  } catch (err) { next(err); }
});

app.get('/provinces/:provinceId', async (req, res, next) => {
  try {
    const province = await Province.findOne({ id: Number(req.params.provinceId) });
    if (!province) return res.status(404).json({ error: 'Province not found' });
    res.json(province);
  } catch (err) { next(err); }
});

// ── Districts ─────────────────────────────────────────────────────────────────

app.get('/districts', async (req, res, next) => {
  try {
    const districts = await District.find().sort({ id: 1 });
    res.json(districts);
  } catch (err) { next(err); }
});

app.get('/districts/:districtId', async (req, res, next) => {
  try {
    const district = await District.findOne({ id: Number(req.params.districtId) });
    if (!district) return res.status(404).json({ error: 'District not found' });
    res.json(district);
  } catch (err) { next(err); }
});

// ── Stations ──────────────────────────────────────────────────────────────────

app.get('/stations', async (req, res, next) => {
  try {
    const stations = await Station.find().sort({ id: 1 });
    res.json(stations);
  } catch (err) { next(err); }
});

app.get('/stations/:stationId', async (req, res, next) => {
  try {
    const station = await Station.findOne({ id: Number(req.params.stationId) });
    if (!station) return res.status(404).json({ error: 'Station not found' });
    res.json(station);
  } catch (err) { next(err); }
});

// ── Vehicles ──────────────────────────────────────────────────────────────────

app.get('/vehicles', async (req, res, next) => {
  try {
    const vehicles = await Vehicle.find().sort({ id: 1 });
    res.json(vehicles);
  } catch (err) { next(err); }
});

app.get('/vehicles/:vehicleId', async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findOne({ id: Number(req.params.vehicleId) });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    res.json(vehicle);
  } catch (err) { next(err); }
});

// ── Pings (GET) ───────────────────────────────────────────────────────────────

app.get('/vehicles/:vehicleId/pings', async (req, res, next) => {
  try {
    const vehicleId = Number(req.params.vehicleId);
    const vehicleExists = await Vehicle.exists({ id: vehicleId });
    if (!vehicleExists) return res.status(404).json({ error: 'Vehicle not found' });

    const pings = await Ping.find({ vehicle_id: vehicleId }).sort({ id: 1 });
    res.json(pings);
  } catch (err) { next(err); }
});

// ── Pings (POST) ──────────────────────────────────────────────────────────────
//
// POST /vehicles/:vehicleId/pings
//
// Creates a new GPS ping for a vehicle and persists it to MongoDB.
//
// Headers required:
//   X-API-Key: <key>            (must match API_KEY in .env)
//   Content-Type: application/json
//
// Request body (JSON):
//   {
//     "latitude":  number,    -- WGS-84 decimal degrees (required)
//     "longitude": number,    -- WGS-84 decimal degrees (required)
//     "speed":     number     -- speed in km/h           (optional)
//   }
//
// Responses:
//   201 Created      -- ping saved; Location header → /vehicles/:id/pings/:pingId
//   400 Bad Request  -- missing or invalid body fields
//   401 Unauthorized -- missing or wrong X-API-Key
//   404 Not Found    -- vehicleId does not exist

app.post('/vehicles/:vehicleId/pings', requireApiKey, async (req, res, next) => {
  try {
    const vehicleId = Number(req.params.vehicleId);

    // 1. Confirm the parent vehicle exists
    const vehicleExists = await Vehicle.exists({ id: vehicleId });
    if (!vehicleExists) return res.status(404).json({ error: 'Vehicle not found' });

    // 2. Validate required body fields
    const { latitude, longitude, speed } = req.body || {};

    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({
        error: 'Request body must include latitude and longitude'
      });
    }
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return res.status(400).json({
        error: 'latitude and longitude must be numbers'
      });
    }
    if (speed !== undefined && typeof speed !== 'number') {
      return res.status(400).json({ error: 'speed must be a number when provided' });
    }

    // 3. Derive the next integer id from the highest existing ping id
    const latest = await Ping.findOne().sort({ id: -1 }).select('id');
    const newId  = (latest ? latest.id : 0) + 1;

    // 4. Build and persist the new ping
    const newPing = await Ping.create({
      id: newId,
      vehicle_id: vehicleId,
      latitude,
      longitude,
      ...(speed !== undefined && { speed }),
      timestamp: new Date().toISOString()
    });

    // 5. Return 201 Created with a Location header
    res
      .status(201)
      .location(`/vehicles/${vehicleId}/pings/${newPing.id}`)
      .json(newPing);
  } catch (err) { next(err); }
});

// ── Root ──────────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

// ── Global error handler ──────────────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Connect to MongoDB, then start server ─────────────────────────────────────

async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`MongoDB connected: ${MONGO_URI}`);

    if (process.env.NODE_ENV !== 'production') {
      app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
    }
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }
}

start();

module.exports = app;
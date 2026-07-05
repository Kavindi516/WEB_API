const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 5000;

// Load seed data into memory at startup
const db = require(path.join(__dirname, 'seed.json'));

// ── Provinces ────────────────────────────────────────────────────────────────

app.get('/provinces', (req, res) => {
  res.json(db.provinces);
});

app.get('/provinces/:provinceId', (req, res) => {
  const province = db.provinces.find(p => p.id === Number(req.params.provinceId));
  if (!province) return res.status(404).json({ error: 'Province not found' });
  res.json(province);
});

// ── Districts ─────────────────────────────────────────────────────────────────

app.get('/districts', (req, res) => {
  res.json(db.districts);
});

app.get('/districts/:districtId', (req, res) => {
  const district = db.districts.find(d => d.id === Number(req.params.districtId));
  if (!district) return res.status(404).json({ error: 'District not found' });
  res.json(district);
});

// ── Stations ──────────────────────────────────────────────────────────────────

app.get('/stations', (req, res) => {
  res.json(db.stations);
});

app.get('/stations/:stationId', (req, res) => {
  const station = db.stations.find(s => s.id === Number(req.params.stationId));
  if (!station) return res.status(404).json({ error: 'Station not found' });
  res.json(station);
});

// ── Vehicles ──────────────────────────────────────────────────────────────────

app.get('/vehicles', (req, res) => {
  res.json(db.vehicles);
});

app.get('/vehicles/:vehicleId', (req, res) => {
  const vehicle = db.vehicles.find(v => v.id === Number(req.params.vehicleId));
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  res.json(vehicle);
});

app.get('/vehicles/:vehicleId/pings', (req, res) => {
  const vehicleId = Number(req.params.vehicleId);
  const vehicleExists = db.vehicles.some(v => v.id === vehicleId);
  if (!vehicleExists) return res.status(404).json({ error: 'Vehicle not found' });
  const pings = db.pings.filter(p => p.vehicle_id === vehicleId);
  res.json(pings);
});

// ── Root ──────────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

// ── Start server ──────────────────────────────────────────────────────────────

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server running at ${port}`);
  });
}

module.exports = app;
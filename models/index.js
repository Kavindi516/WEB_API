'use strict';

/**
 * models/index.js
 *
 * Mongoose schemas and models for the taxi fleet tracking API.
 *
 * Design notes:
 *  - The integer `id` field from seed.json is kept on every document so that
 *    API responses look identical to the previous in-memory implementation.
 *  - Mongoose's `_id` (ObjectId) and `__v` (version key) are stripped from
 *    JSON output via a shared toJSON transform, keeping responses clean.
 */

const mongoose = require('mongoose');

// ── Shared toJSON transform ───────────────────────────────────────────────────
// Removes _id and __v from every serialised document.
const toJSON = {
  transform(doc, ret) {
    delete ret._id;
    delete ret.__v;
    return ret;
  }
};

// ── Province ──────────────────────────────────────────────────────────────────
const provinceSchema = new mongoose.Schema(
  {
    id:   { type: Number, required: true, unique: true },
    name: { type: String, required: true }
  },
  { collection: 'provinces', toJSON }
);

// ── District ──────────────────────────────────────────────────────────────────
const districtSchema = new mongoose.Schema(
  {
    id:          { type: Number, required: true, unique: true },
    name:        { type: String, required: true },
    province_id: { type: Number, required: true }
  },
  { collection: 'districts', toJSON }
);

// ── Station ───────────────────────────────────────────────────────────────────
const stationSchema = new mongoose.Schema(
  {
    id:          { type: Number, required: true, unique: true },
    name:        { type: String, required: true },
    district_id: { type: Number, required: true }
  },
  { collection: 'stations', toJSON }
);

// ── Vehicle ───────────────────────────────────────────────────────────────────
const vehicleSchema = new mongoose.Schema(
  {
    id:                  { type: Number, required: true, unique: true },
    registration_number: { type: String, required: true, unique: true },
    device_id:           { type: String, required: true, unique: true },
    station_id:          { type: Number, required: true }
  },
  { collection: 'vehicles', toJSON }
);

// ── Ping ──────────────────────────────────────────────────────────────────────
const pingSchema = new mongoose.Schema(
  {
    id:         { type: Number, required: true, unique: true },
    vehicle_id: { type: Number, required: true },
    latitude:   { type: Number, required: true },
    longitude:  { type: Number, required: true },
    speed:      { type: Number },                // optional
    timestamp:  { type: String, required: true }
  },
  { collection: 'pings', toJSON }
);

// Index on vehicle_id so filtering pings by vehicle is fast
pingSchema.index({ vehicle_id: 1 });

module.exports = {
  Province: mongoose.model('Province', provinceSchema),
  District: mongoose.model('District', districtSchema),
  Station:  mongoose.model('Station',  stationSchema),
  Vehicle:  mongoose.model('Vehicle',  vehicleSchema),
  Ping:     mongoose.model('Ping',     pingSchema)
};

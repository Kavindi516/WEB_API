'use strict';

/**
 * seed.js
 *
 * One-shot script: reads seed.json, drops existing data from each collection,
 * then bulk-inserts all documents into MongoDB.
 *
 * Usage:
 *   node seed.js
 *
 * Make sure MongoDB is running and MONGO_URI is set in .env (or the default
 * localhost URI is used) before running this script.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const path     = require('path');

const { Province, District, Station, Vehicle, Ping } = require('./models');
const seedData = require(path.join(__dirname, 'seed.json'));

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/taxi_fleet';

async function seed() {
  console.log('Connecting to MongoDB…');
  await mongoose.connect(MONGO_URI);
  console.log(`Connected to: ${MONGO_URI}\n`);

  // ── Provinces ──────────────────────────────────────────────────────────────
  await Province.deleteMany({});
  const provinces = await Province.insertMany(seedData.provinces);
  console.log(`✔ Provinces inserted: ${provinces.length}`);

  // ── Districts ──────────────────────────────────────────────────────────────
  await District.deleteMany({});
  const districts = await District.insertMany(seedData.districts);
  console.log(`✔ Districts inserted: ${districts.length}`);

  // ── Stations ───────────────────────────────────────────────────────────────
  await Station.deleteMany({});
  const stations = await Station.insertMany(seedData.stations);
  console.log(`✔ Stations  inserted: ${stations.length}`);

  // ── Vehicles ───────────────────────────────────────────────────────────────
  await Vehicle.deleteMany({});
  const vehicles = await Vehicle.insertMany(seedData.vehicles);
  console.log(`✔ Vehicles  inserted: ${vehicles.length}`);

  // ── Pings ──────────────────────────────────────────────────────────────────
  await Ping.deleteMany({});
  // insertMany in one shot; Mongoose streams large arrays in batches automatically
  const pings = await Ping.insertMany(seedData.pings, { ordered: false });
  console.log(`✔ Pings     inserted: ${pings.length}`);

  console.log('\nSeeding complete!');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});

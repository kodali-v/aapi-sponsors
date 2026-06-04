const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'aapisponsors',
  user: process.env.DB_USER || 'aapisponsors',
  password: process.env.DB_PASSWORD || 'changeme',
});

const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      -- Sponsors
      CREATE TABLE IF NOT EXISTS sponsors (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        status VARCHAR(20) DEFAULT 'probable',
        sort_order INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Days (Friday, Saturday, etc.)
      CREATE TABLE IF NOT EXISTS days (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL,
        date DATE,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Time slots within a day
      CREATE TABLE IF NOT EXISTS time_slots (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        day_id UUID NOT NULL REFERENCES days(id) ON DELETE CASCADE,
        start_time VARCHAR(20) NOT NULL,
        end_time VARCHAR(20) NOT NULL,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Sponsor assigned to a slot
      CREATE TABLE IF NOT EXISTS slot_assignments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        slot_id UUID NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
        sponsor_id UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(slot_id, sponsor_id)
      );

      -- Deliverable types (Booth, Product Theatre, Ad, etc.)
      CREATE TABLE IF NOT EXISTS deliverables (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Per-sponsor deliverable status + notes
      CREATE TABLE IF NOT EXISTS sponsor_deliverables (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        sponsor_id UUID NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
        deliverable_id UUID NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
        checked BOOLEAN DEFAULT FALSE,
        notes JSONB DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(sponsor_id, deliverable_id)
      );

      -- Seed default days
      INSERT INTO days (name, sort_order) VALUES
        ('Friday', 0), ('Saturday', 1)
      ON CONFLICT DO NOTHING;

      -- Seed default deliverables
      INSERT INTO deliverables (name, sort_order) VALUES
        ('Booth', 0), ('Product Theatre', 1), ('Ad', 2), ('Notes', 3)
      ON CONFLICT DO NOTHING;
    `);
    console.log('DB initialized');
  } finally {
    client.release();
  }
};

module.exports = { pool, initDB };

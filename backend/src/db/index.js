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

      -- Tabs (each tab is a 'schedule' board or a 'deliverables' table)
      CREATE TABLE IF NOT EXISTS tabs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'schedule',
        sort_order INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Scope days and deliverable columns to their owning tab
      ALTER TABLE days ADD COLUMN IF NOT EXISTS tab_id UUID REFERENCES tabs(id) ON DELETE CASCADE;
      ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS tab_id UUID REFERENCES tabs(id) ON DELETE CASCADE;

      -- Per-column data type (checkbox | text | number | currency) and a free value for non-checkbox cells
      ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS col_type VARCHAR(20) DEFAULT 'checkbox';
      ALTER TABLE sponsor_deliverables ADD COLUMN IF NOT EXISTS value TEXT DEFAULT '';

      -- Idempotent migration + safe default seeding (no duplicates on restart)
      DO $$
      DECLARE
        sched_tab UUID;
        deliv_tab UUID;
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM tabs) THEN
          INSERT INTO tabs (name, type, sort_order) VALUES ('Product Theatre', 'schedule', 0) RETURNING id INTO sched_tab;
          INSERT INTO tabs (name, type, sort_order) VALUES ('Deliverables', 'deliverables', 1) RETURNING id INTO deliv_tab;
        ELSE
          SELECT id INTO sched_tab FROM tabs WHERE type = 'schedule' ORDER BY sort_order LIMIT 1;
          SELECT id INTO deliv_tab FROM tabs WHERE type = 'deliverables' ORDER BY sort_order LIMIT 1;
        END IF;

        -- Backfill any pre-existing rows that have no tab yet
        IF sched_tab IS NOT NULL THEN
          UPDATE days SET tab_id = sched_tab WHERE tab_id IS NULL;
        END IF;
        IF deliv_tab IS NOT NULL THEN
          UPDATE deliverables SET tab_id = deliv_tab WHERE tab_id IS NULL;
        END IF;

        -- Seed default days only if the schedule tab has none
        IF sched_tab IS NOT NULL AND NOT EXISTS (SELECT 1 FROM days WHERE tab_id = sched_tab) THEN
          INSERT INTO days (name, tab_id, sort_order) VALUES
            ('Friday', sched_tab, 0), ('Saturday', sched_tab, 1);
        END IF;

        -- Seed default deliverable columns only if the deliverables tab has none
        IF deliv_tab IS NOT NULL AND NOT EXISTS (SELECT 1 FROM deliverables WHERE tab_id = deliv_tab) THEN
          INSERT INTO deliverables (name, tab_id, sort_order) VALUES
            ('Booth', deliv_tab, 0), ('Product Theatre', deliv_tab, 1), ('Ad', deliv_tab, 2), ('Notes', deliv_tab, 3);
        END IF;
      END $$;
    `);
    console.log('DB initialized');
  } finally {
    client.release();
  }
};

module.exports = { pool, initDB };

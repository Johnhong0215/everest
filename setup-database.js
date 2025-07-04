import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('Setting up Supabase database...');

// Create tables one by one
async function createTables() {
  try {
    // 1. Create ENUM types
    console.log('Creating ENUM types...');
    await supabase.rpc('exec_sql', {
      sql: `
        DO $$ BEGIN
          CREATE TYPE sport AS ENUM ('badminton', 'basketball', 'soccer', 'tennis', 'volleyball', 'tabletennis');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `
    });

    await supabase.rpc('exec_sql', {
      sql: `
        DO $$ BEGIN
          CREATE TYPE skill_level AS ENUM ('beginner', 'intermediate', 'advanced');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `
    });

    await supabase.rpc('exec_sql', {
      sql: `
        DO $$ BEGIN
          CREATE TYPE gender_mix AS ENUM ('mixed', 'mens', 'womens');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `
    });

    await supabase.rpc('exec_sql', {
      sql: `
        DO $$ BEGIN
          CREATE TYPE event_status AS ENUM ('draft', 'published', 'cancelled', 'completed');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `
    });

    await supabase.rpc('exec_sql', {
      sql: `
        DO $$ BEGIN
          CREATE TYPE booking_status AS ENUM ('requested', 'accepted', 'rejected', 'cancelled');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `
    });

    await supabase.rpc('exec_sql', {
      sql: `
        DO $$ BEGIN
          CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `
    });

    // 2. Create users table
    console.log('Creating users table...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR PRIMARY KEY,
          email VARCHAR UNIQUE NOT NULL,
          first_name VARCHAR,
          last_name VARCHAR,
          profile_image_url VARCHAR,
          stripe_customer_id VARCHAR,
          stripe_subscription_id VARCHAR,
          phone_verified BOOLEAN DEFAULT false,
          id_verified BOOLEAN DEFAULT false,
          bio TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    // 3. Create events table
    console.log('Creating events table...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS events (
          id SERIAL PRIMARY KEY,
          host_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR NOT NULL,
          description TEXT,
          sport sport NOT NULL,
          skill_level skill_level NOT NULL,
          gender_mix gender_mix NOT NULL,
          start_time TIMESTAMP WITH TIME ZONE NOT NULL,
          end_time TIMESTAMP WITH TIME ZONE NOT NULL,
          location VARCHAR NOT NULL,
          latitude DECIMAL(10, 8),
          longitude DECIMAL(11, 8),
          max_players INTEGER NOT NULL,
          current_players INTEGER DEFAULT 1,
          price_per_person DECIMAL(10, 2) NOT NULL,
          sport_config JSON DEFAULT '{}',
          status event_status DEFAULT 'published',
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    });

    // 4. Create sports_settings table
    console.log('Creating sports_settings table...');
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS sports_settings (
          id SERIAL PRIMARY KEY,
          sport sport NOT NULL,
          setting_key VARCHAR NOT NULL,
          setting_value VARCHAR NOT NULL,
          display_order INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(sport, setting_key, setting_value)
        );
      `
    });

    console.log('Database setup completed successfully!');
    
    // Test the connection
    console.log('Testing connection...');
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) {
      console.error('Connection test failed:', error);
    } else {
      console.log('Connection test successful!');
    }

  } catch (error) {
    console.error('Database setup failed:', error);
  }
}

createTables();
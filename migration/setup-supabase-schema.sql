-- Supabase Schema Setup
-- This script creates all necessary tables and relationships in Supabase

-- Create ENUM types
CREATE TYPE sport AS ENUM ('badminton', 'basketball', 'soccer', 'tennis', 'volleyball', 'tabletennis');
CREATE TYPE skill_level AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE gender_mix AS ENUM ('mixed', 'mens', 'womens');
CREATE TYPE event_status AS ENUM ('draft', 'published', 'cancelled', 'completed');
CREATE TYPE booking_status AS ENUM ('requested', 'accepted', 'rejected', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- Create sessions table (for compatibility with current session management)
CREATE TABLE sessions (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create users table
CREATE TABLE users (
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

-- Create events table
CREATE TABLE events (
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

-- Create bookings table
CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status booking_status DEFAULT 'requested',
  payment_intent_id VARCHAR,
  amount_paid DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Create chat_messages table
CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  sender_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type VARCHAR DEFAULT 'text',
  metadata JSON,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_by JSON DEFAULT '[]',
  receiver_id VARCHAR REFERENCES users(id) ON DELETE CASCADE
);

-- Create payments table
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  stripe_payment_intent_id VARCHAR,
  amount DECIMAL(10, 2) NOT NULL,
  platform_fee DECIMAL(10, 2),
  host_payout DECIMAL(10, 2),
  status payment_status DEFAULT 'pending',
  payout_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_sport_preferences table
CREATE TABLE user_sport_preferences (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport sport NOT NULL,
  skill_level skill_level NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, sport)
);

-- Create reviews table
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  reviewer_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewee_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, reviewer_id, reviewee_id)
);

-- Create sports_settings table
CREATE TABLE sports_settings (
  id SERIAL PRIMARY KEY,
  sport sport NOT NULL,
  setting_key VARCHAR NOT NULL,
  setting_value VARCHAR NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sport, setting_key, setting_value)
);

-- Create indexes for performance
CREATE INDEX idx_events_host_id ON events(host_id);
CREATE INDEX idx_events_sport ON events(sport);
CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_location ON events(location);
CREATE INDEX idx_bookings_event_id ON bookings(event_id);
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_chat_messages_event_id ON chat_messages(event_id);
CREATE INDEX idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX idx_payments_booking_id ON payments(booking_id);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sport_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since we're managing auth on the backend)
CREATE POLICY "Enable all access for service role" ON users FOR ALL USING (true);
CREATE POLICY "Enable all access for service role" ON events FOR ALL USING (true);
CREATE POLICY "Enable all access for service role" ON bookings FOR ALL USING (true);
CREATE POLICY "Enable all access for service role" ON chat_messages FOR ALL USING (true);
CREATE POLICY "Enable all access for service role" ON payments FOR ALL USING (true);
CREATE POLICY "Enable all access for service role" ON user_sport_preferences FOR ALL USING (true);
CREATE POLICY "Enable all access for service role" ON reviews FOR ALL USING (true);
CREATE POLICY "Enable all access for service role" ON sports_settings FOR ALL USING (true);
-- Complete Supabase Schema Creation Script (Fixed for Supabase Auth)
-- Copy and paste this entire script into Supabase SQL Editor

-- First, create all ENUM types
CREATE TYPE sport AS ENUM ('badminton', 'basketball', 'soccer', 'tennis', 'volleyball', 'tabletennis');
CREATE TYPE skill_level AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE gender_mix AS ENUM ('mixed', 'mens', 'womens');
CREATE TYPE event_status AS ENUM ('draft', 'published', 'cancelled', 'completed');
CREATE TYPE booking_status AS ENUM ('requested', 'accepted', 'rejected', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- Sessions table (for Replit Auth session storage)
CREATE TABLE sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_sessions_expire ON sessions (expire);

-- User profiles table (extends Supabase auth.users)
-- This stores additional profile information beyond what's in auth.users
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
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

-- Events table (references auth.users directly)
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Bookings table
CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status booking_status DEFAULT 'requested',
  payment_intent_id VARCHAR,
  amount_paid DECIMAL(8, 2),
  special_requests TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Chat messages table
CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text',
  metadata JSON,
  read_by JSON DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments table
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  platform_fee DECIMAL(10, 2) NOT NULL,
  host_payout DECIMAL(10, 2),
  status payment_status DEFAULT 'pending',
  stripe_payment_intent_id VARCHAR,
  payout_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User sport preferences table
CREATE TABLE user_sport_preferences (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sport sport NOT NULL,
  skill_level skill_level NOT NULL,
  preferred_times VARCHAR[],
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, sport)
);

-- Reviews table
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(reviewer_id, reviewee_id, event_id)
);

-- Sports settings table (for sport-specific configuration options)
CREATE TABLE sports_settings (
  id SERIAL PRIMARY KEY,
  sport sport NOT NULL,
  setting_key VARCHAR NOT NULL,
  setting_value VARCHAR NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sport, setting_key, setting_value)
);

-- Insert default sports settings
INSERT INTO sports_settings (sport, setting_key, setting_value, display_order) VALUES
-- Badminton settings
('badminton', 'format', 'Singles', 1),
('badminton', 'format', 'Doubles', 2),
('badminton', 'courtType', 'Indoor wood', 1),
('badminton', 'courtType', 'Outdoor concrete', 2),
('badminton', 'shuttlecock', 'Feather (slow)', 1),
('badminton', 'shuttlecock', 'Feather (medium)', 2),
('badminton', 'shuttlecock', 'Feather (fast)', 3),
('badminton', 'shuttlecock', 'Nylon', 4),
('badminton', 'lighting', 'Daylight', 1),
('badminton', 'lighting', 'Evening floodlights', 2),
('badminton', 'equipment', 'BYO racket', 1),
('badminton', 'equipment', 'Host-provided rental', 2),

-- Basketball settings
('basketball', 'format', '3×3 half-court', 1),
('basketball', 'format', '5×5 full-court', 2),
('basketball', 'venue', 'Outdoor public court', 1),
('basketball', 'venue', 'Indoor gym', 2),
('basketball', 'hoopHeight', 'Standard 10′', 1),
('basketball', 'hoopHeight', 'Adjustable', 2),
('basketball', 'ballSupply', 'BYO ball', 1),
('basketball', 'ballSupply', 'Host-provided', 2),
('basketball', 'skillDivision', 'Casual pickup', 1),
('basketball', 'skillDivision', 'Competitive', 2),
('basketball', 'referee', 'Self-officiated', 1),
('basketball', 'referee', 'Paid official', 2),
('basketball', 'duration', 'Timed quarters', 1),
('basketball', 'duration', 'First to X points', 2),

-- Soccer settings
('soccer', 'format', '5-a-side', 1),
('soccer', 'format', '7-a-side', 2),
('soccer', 'format', '11-a-side', 3),
('soccer', 'pitchSurface', 'Grass', 1),
('soccer', 'pitchSurface', 'Turf', 2),
('soccer', 'pitchSurface', 'Indoor dome', 3),
('soccer', 'goalType', 'Portable', 1),
('soccer', 'goalType', 'Regulation goals', 2),
('soccer', 'ballSize', 'Size 3', 1),
('soccer', 'ballSize', 'Size 4', 2),
('soccer', 'ballSize', 'Size 5', 3),
('soccer', 'referee', 'None', 1),
('soccer', 'referee', 'Certified referee', 2),
('soccer', 'matchLength', '2×30 min', 1),
('soccer', 'matchLength', '2×45 min', 2),
('soccer', 'cleatsRequirement', 'Turf shoes', 1),
('soccer', 'cleatsRequirement', 'Grass cleats', 2),

-- Tennis settings
('tennis', 'format', 'Singles', 1),
('tennis', 'format', 'Doubles', 2),
('tennis', 'scoring', 'Standard sets', 1),
('tennis', 'scoring', 'Pro-sets', 2),
('tennis', 'ballType', 'Pressurized', 1),
('tennis', 'ballType', 'Pressureless', 2),
('tennis', 'courtSurface', 'Hard', 1),
('tennis', 'courtSurface', 'Clay', 2),
('tennis', 'courtSurface', 'Grass', 3),
('tennis', 'courtLighting', 'Day play', 1),
('tennis', 'courtLighting', 'Night play', 2),
('tennis', 'equipmentRental', 'None', 1),
('tennis', 'equipmentRental', 'Racquets', 2),

-- Volleyball settings
('volleyball', 'surface', 'Sand', 1),
('volleyball', 'surface', 'Gym floor', 2),
('volleyball', 'netHeight', 'Men's regulation', 1),
('volleyball', 'netHeight', 'Women's regulation', 2),
('volleyball', 'ballSupply', 'Indoor volleyballs', 1),
('volleyball', 'ballSupply', 'Beach volleyballs', 2),
('volleyball', 'discipline', 'Indoor 6×6', 1),
('volleyball', 'discipline', 'Beach 2×2', 2),
('volleyball', 'skillLevel', 'Recreational', 1),
('volleyball', 'skillLevel', 'Competitive', 2),
('volleyball', 'rotationRules', 'Strict', 1),
('volleyball', 'rotationRules', 'Relaxed', 2),
('volleyball', 'weatherBackup', 'None', 1),
('volleyball', 'weatherBackup', 'Indoor facility', 2),

-- Table Tennis settings
('tabletennis', 'ballGrade', '3-star', 1),
('tabletennis', 'ballGrade', 'Training', 2),
('tabletennis', 'paddleRental', 'BYO', 1),
('tabletennis', 'paddleRental', 'Host-provided', 2),
('tabletennis', 'scoring', 'Best-of-5 to 11', 1),
('tabletennis', 'scoring', 'Best-of-7 to 11', 2),
('tabletennis', 'spaceAndLighting', 'Standard clearance', 1),
('tabletennis', 'spaceAndLighting', 'Professional setup', 2);

-- Function to handle new user registration
-- This automatically creates a user_profile when a new auth.user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, first_name, last_name, created_at, updated_at)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    NOW(),
    NOW()
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for better query performance
CREATE INDEX idx_events_host_id ON events(host_id);
CREATE INDEX idx_events_sport ON events(sport);
CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_bookings_event_id ON bookings(event_id);
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_chat_messages_event_id ON chat_messages(event_id);
CREATE INDEX idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_reviews_reviewee_id ON reviews(reviewee_id);

-- Enable Row Level Security (RLS) for all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sport_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow read access to all authenticated users for sports_settings
CREATE POLICY "Allow read access to sports_settings" ON sports_settings FOR SELECT USING (true);

-- Allow users to read and update their own profile
CREATE POLICY "Users can read own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- Allow reading published events
CREATE POLICY "Allow reading published events" ON events FOR SELECT USING (status = 'published');

-- Allow users to create events
CREATE POLICY "Users can create events" ON events FOR INSERT WITH CHECK (auth.uid() = host_id);

-- Allow hosts to update their own events
CREATE POLICY "Hosts can update own events" ON events FOR UPDATE USING (auth.uid() = host_id);

-- Allow reading bookings for event hosts and booking users
CREATE POLICY "Allow reading relevant bookings" ON bookings FOR SELECT 
USING (
  auth.uid() = user_id OR 
  auth.uid() IN (SELECT host_id FROM events WHERE id = event_id)
);

-- Allow users to create bookings
CREATE POLICY "Users can create bookings" ON bookings FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow reading chat messages for event participants
CREATE POLICY "Allow reading chat messages for participants" ON chat_messages FOR SELECT 
USING (
  auth.uid() = sender_id OR 
  auth.uid() = receiver_id OR
  auth.uid() IN (SELECT host_id FROM events WHERE id = event_id) OR
  auth.uid() IN (SELECT user_id FROM bookings WHERE event_id = chat_messages.event_id)
);

-- Allow creating chat messages for event participants
CREATE POLICY "Allow creating chat messages for participants" ON chat_messages FOR INSERT 
WITH CHECK (
  auth.uid() = sender_id AND (
    auth.uid() IN (SELECT host_id FROM events WHERE id = event_id) OR
    auth.uid() IN (SELECT user_id FROM bookings WHERE event_id = chat_messages.event_id)
  )
);
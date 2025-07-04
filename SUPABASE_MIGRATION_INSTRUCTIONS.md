# Supabase Migration Instructions

## Steps to Complete Migration

### 1. Execute SQL Schema in Supabase
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the entire contents of `supabase-schema-fixed.sql`
4. Paste and execute the script

This will:
- Create all required tables with proper Supabase auth integration
- Set up Row Level Security (RLS) policies
- Create indexes for performance
- Insert default sports settings data
- Set up automatic user profile creation

### 2. Authentication Changes
The app now uses Supabase's built-in `auth.users` table instead of a custom users table:

**Key Changes:**
- All user IDs are now UUIDs (Supabase standard)
- User data split between `auth.users` (core) and `user_profiles` (extended info)
- Events table references `auth.users(id)` directly
- Foreign key constraints properly established

### 3. What's Fixed
- ✅ Foreign key constraint errors (events.host_id now references auth.users)
- ✅ Column name mapping (camelCase ↔ snake_case) 
- ✅ Proper UUID handling for all user references
- ✅ Row Level Security for data protection
- ✅ Automatic user profile creation on signup

### 4. Backend Authentication Updates Completed
I've updated the backend to use Supabase authentication:

- ✅ Switched from Replit Auth to Supabase Auth
- ✅ Updated API routes to use proper Bearer token authentication  
- ✅ Fixed all user ID references to use Supabase UUIDs
- ✅ Updated query client to include Authorization headers

### 5. Testing After Migration
1. Execute the SQL schema in Supabase (step 1)
2. Try creating a new event
3. Verify user authentication works
4. Test chat functionality
5. Check bookings system

The database will now properly integrate with Supabase's authentication system and resolve the foreign key errors you were experiencing.

**Critical:** You must execute the SQL schema in Supabase first before the application will work properly!
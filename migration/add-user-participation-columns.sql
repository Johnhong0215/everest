-- Add user participation columns to events table
ALTER TABLE events 
ADD COLUMN requested_users text[] DEFAULT '{}',
ADD COLUMN accepted_users text[] DEFAULT '{}',
ADD COLUMN rejected_users text[] DEFAULT '{}';

-- Update existing events to have empty arrays
UPDATE events 
SET 
  requested_users = '{}',
  accepted_users = '{}',
  rejected_users = '{}'
WHERE 
  requested_users IS NULL 
  OR accepted_users IS NULL 
  OR rejected_users IS NULL;
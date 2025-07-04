-- Database structure updates for better chat system and request handling

-- Create chats table to track conversations between users for specific events
CREATE TABLE IF NOT EXISTS chats (
    id SERIAL PRIMARY KEY,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique conversation per event between two users
    UNIQUE(sender_id, receiver_id, event_id)
);

-- Create chat_messages table to store individual messages
CREATE TABLE IF NOT EXISTS chat_messages_new (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    
    -- Index for performance
    INDEX(chat_id, created_at),
    INDEX(sender_id)
);

-- Migrate existing chat_messages to new structure
-- First, create chats for existing messages
INSERT INTO chats (sender_id, receiver_id, event_id, created_at)
SELECT DISTINCT 
    sender_id, 
    receiver_id, 
    event_id,
    MIN(created_at) as created_at
FROM chat_messages 
WHERE receiver_id IS NOT NULL
GROUP BY sender_id, receiver_id, event_id
ON CONFLICT (sender_id, receiver_id, event_id) DO NOTHING;

-- Create reverse chats (receiver -> sender) for bidirectional conversations
INSERT INTO chats (sender_id, receiver_id, event_id, created_at)
SELECT DISTINCT 
    receiver_id as sender_id, 
    sender_id as receiver_id, 
    event_id,
    MIN(created_at) as created_at
FROM chat_messages 
WHERE receiver_id IS NOT NULL
GROUP BY receiver_id, sender_id, event_id
ON CONFLICT (sender_id, receiver_id, event_id) DO NOTHING;

-- Migrate existing messages to new structure
INSERT INTO chat_messages_new (chat_id, sender_id, content, created_at)
SELECT 
    c.id as chat_id,
    cm.sender_id,
    cm.content,
    cm.created_at
FROM chat_messages cm
JOIN chats c ON (
    c.sender_id = cm.sender_id 
    AND c.receiver_id = cm.receiver_id 
    AND c.event_id = cm.event_id
)
WHERE cm.receiver_id IS NOT NULL;

-- Drop old chat_messages table and rename new one
DROP TABLE chat_messages;
ALTER TABLE chat_messages_new RENAME TO chat_messages;

-- Enable Row Level Security on new tables
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for chats
CREATE POLICY "Users can view their own chats" ON chats
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create chats they participate in" ON chats
    FOR INSERT WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can update their own chats" ON chats
    FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Create RLS policies for chat_messages
CREATE POLICY "Users can view messages in their chats" ON chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chats 
            WHERE chats.id = chat_messages.chat_id 
            AND (chats.sender_id = auth.uid() OR chats.receiver_id = auth.uid())
        )
    );

CREATE POLICY "Users can create messages in their chats" ON chat_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id 
        AND EXISTS (
            SELECT 1 FROM chats 
            WHERE chats.id = chat_messages.chat_id 
            AND (chats.sender_id = auth.uid() OR chats.receiver_id = auth.uid())
        )
    );

CREATE POLICY "Users can update their own messages" ON chat_messages
    FOR UPDATE USING (auth.uid() = sender_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chats_participants ON chats(sender_id, receiver_id, event_id);
CREATE INDEX IF NOT EXISTS idx_chats_event ON chats(event_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_time ON chat_messages(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender_id);

-- Create function to automatically create bidirectional chats
CREATE OR REPLACE FUNCTION create_bidirectional_chat()
RETURNS TRIGGER AS $$
BEGIN
    -- Create the reverse chat if it doesn't exist
    INSERT INTO chats (sender_id, receiver_id, event_id, created_at)
    VALUES (NEW.receiver_id, NEW.sender_id, NEW.event_id, NEW.created_at)
    ON CONFLICT (sender_id, receiver_id, event_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for bidirectional chats
CREATE TRIGGER create_bidirectional_chat_trigger
    AFTER INSERT ON chats
    FOR EACH ROW
    EXECUTE FUNCTION create_bidirectional_chat();

-- Update the updated_at timestamp on chats when messages are added
CREATE OR REPLACE FUNCTION update_chat_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chats 
    SET updated_at = NEW.created_at 
    WHERE id = NEW.chat_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update chat timestamp
CREATE TRIGGER update_chat_timestamp_trigger
    AFTER INSERT ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_chat_timestamp();
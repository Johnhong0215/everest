import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read environment variables
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

console.log('Connected to Supabase...');

// Read and execute schema setup
async function setupSchema() {
  console.log('Setting up schema...');
  
  const schemaSQL = readFileSync(join(__dirname, 'setup-supabase-schema.sql'), 'utf8');
  
  // Split by statements and execute each one
  const statements = schemaSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  for (const statement of statements) {
    try {
      console.log(`Executing: ${statement.substring(0, 100)}...`);
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      if (error) {
        // Some errors are expected (like type already exists)
        if (!error.message.includes('already exists')) {
          console.error('Schema error:', error.message);
        }
      }
    } catch (err) {
      console.error('Schema execution error:', err.message);
    }
  }
  
  console.log('Schema setup complete');
}

// Migrate data
async function migrateData() {
  console.log('Migrating data...');
  
  const dataSQL = readFileSync(join(__dirname, 'migrate-data.sql'), 'utf8');
  
  // Split by statements and execute each one
  const statements = dataSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  
  for (const statement of statements) {
    try {
      if (statement.includes('INSERT INTO') || statement.includes('ALTER SEQUENCE') || statement.includes('SELECT setval')) {
        console.log(`Executing: ${statement.substring(0, 100)}...`);
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        if (error) {
          console.error('Data migration error:', error.message);
        }
      }
    } catch (err) {
      console.error('Data execution error:', err.message);
    }
  }
  
  console.log('Data migration complete');
}

// Test connection
async function testConnection() {
  console.log('Testing connection...');
  
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) {
      console.error('Connection test failed:', error.message);
    } else {
      console.log('Connection test successful');
    }
  } catch (err) {
    console.error('Connection test error:', err.message);
  }
}

// Run migration
async function runMigration() {
  try {
    await setupSchema();
    await migrateData();
    await testConnection();
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
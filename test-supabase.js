import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('Testing Supabase connection...');
console.log('URL:', supabaseUrl);
console.log('Has Key:', !!supabaseServiceRoleKey);

// Test basic connection
async function test() {
  try {
    // Try to insert data directly first
    console.log('Attempting to insert test user...');
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: 'test-user-123',
        email: 'test@example.com'
      })
      .select();
    
    if (error) {
      console.log('Insert error (expected if table doesnt exist):', error.message);
      
      // Try to list available tables
      console.log('Checking available tables...');
      const { data: tables, error: tablesError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');
      
      if (tablesError) {
        console.log('Tables query error:', tablesError.message);
      } else {
        console.log('Available tables:', tables);
      }
    } else {
      console.log('Success! User inserted:', data);
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

test();
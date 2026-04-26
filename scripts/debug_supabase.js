const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debug() {
  console.log("Checking sample data...");
  const { data, error, count } = await supabase
    .from('publications')
    .select('*', { count: 'exact' })
    .limit(5);

  if (error) {
    console.error("Error:", error);
  } else {
    console.log(`Total records in publications: ${count}`);
    console.log("Sample records:", JSON.stringify(data, null, 2));
  }

  const { data: journals, error: jError } = await supabase
    .from('journals')
    .select('*')
    .limit(5);
  
  if (jError) console.error("Journal Error:", jError);
  else console.log("Sample journals:", JSON.stringify(journals, null, 2));
}

debug();

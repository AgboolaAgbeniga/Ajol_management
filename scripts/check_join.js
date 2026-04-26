const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkJoin() {
  const { data, error } = await supabase
    .from('publications')
    .select('id, source_id, journals(source_title)')
    .limit(5);

  if (error) console.error("Error:", error);
  else console.log("Join result:", JSON.stringify(data, null, 2));
}

checkJoin();

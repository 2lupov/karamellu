import { createClient } from '@supabase/supabase-js';

const url = 'https://ifxwucbdfwaxlbwwzdwb.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmeHd1Y2JkZndheGxid3d6ZHdiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDMxNDI3NCwiZXhwIjoyMDk5ODkwMjc0fQ.rBYgN3ENFWFHqYaxGNmGpvHr65nI7iNNSgIETMNC2cQ';

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from('products').select('count');
  if (error) {
    console.log('Error querying products:', error.message);
  } else {
    console.log('Products table exists! Record count/result:', data);
  }
}

check();

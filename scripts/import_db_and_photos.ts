import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Configuration
const NEW_SUPABASE_URL = process.env.NEW_SUPABASE_URL || 'https://YOUR_NEW_PROJECT_REF.supabase.co';
const NEW_SUPABASE_SERVICE_ROLE_KEY = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY';

const DB_EXPORT_DIR = '/Users/2lupov/Downloads/db-export 2';
const PRODUCT_PHOTOS_DIR = '/Users/2lupov/Downloads/product-photos';
const BUCKET_NAME = 'product-images';

// Initialize Supabase Client with service role key to bypass RLS
const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false
  }
});

// CSV Parser (RFC 4180 compliant)
function parseCSV(content: string): any[] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentVal = '';

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentVal);
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentVal);
      lines.push(row);
      row = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  if (row.length > 0 || currentVal !== '') {
    row.push(currentVal);
    lines.push(row);
  }

  if (lines.length === 0) return [];
  const headers = lines[0].map(h => h.trim());
  const data: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.length === 0 || (line.length === 1 && line[0] === '')) continue;
    
    const obj: any = {};
    headers.forEach((header, index) => {
      let val: string | null = line[index];
      if (val === undefined || val === '') {
        val = null;
      } else {
        val = val.trim();
      }
      obj[header] = val;
    });
    data.push(obj);
  }
  return data;
}

// Convert fields to correct DB types (boolean, numeric, null)
function sanitizeRecord(table: string, record: any) {
  const sanitized = { ...record };
  for (const key in sanitized) {
    let val = sanitized[key];
    
    // Replace old supabase URL with new one in any string fields
    if (typeof val === 'string' && val.includes('.supabase.co/storage/v1/object/public/')) {
      const match = val.match(/https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/(.*)/);
      if (match && match[1]) {
        val = `${NEW_SUPABASE_URL}/storage/v1/object/public/${match[1]}`;
      }
    }
    
    // Convert boolean values
    if (val === 't' || val === 'true') {
      sanitized[key] = true;
    } else if (val === 'f' || val === 'false') {
      sanitized[key] = false;
    }
    // Convert numeric values
    else if (val !== null && !isNaN(val as any) && val.trim() !== '' && !/^\d{4}-\d{2}-\d{2}/.test(val)) {
      sanitized[key] = Number(val);
    } else {
      sanitized[key] = val;
    }
  }

  // Adjust foreign keys referencing auth.users which is empty in the new project
  if (table === 'shops') {
    sanitized['owner_user_id'] = null;
  }
  if (table === 'orders') {
    sanitized['user_id'] = null;
  }
  
  return sanitized;
}

async function main() {
  console.log('🚀 Starting import and photos upload script...');

  if (NEW_SUPABASE_URL.includes('YOUR_NEW_PROJECT_REF') || NEW_SUPABASE_SERVICE_ROLE_KEY === 'YOUR_SERVICE_ROLE_KEY') {
    console.error('❌ Error: Please specify your actual NEW_SUPABASE_URL and NEW_SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }

  // 1. Check or Create Storage Bucket
  console.log(`\n📦 Step 1: Checking storage bucket "${BUCKET_NAME}"...`);
  const { data: buckets, error: getBucketsError } = await supabase.storage.listBuckets();
  if (getBucketsError) {
    console.error('❌ Error listing buckets:', getBucketsError.message);
    process.exit(1);
  }

  const bucketExists = buckets.some(b => b.name === BUCKET_NAME);
  if (!bucketExists) {
    console.log(`Creating bucket "${BUCKET_NAME}" with public access...`);
    const { error: createBucketError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      fileSizeLimit: 10485760 // 10MB
    });
    if (createBucketError) {
      console.error('❌ Error creating bucket:', createBucketError.message);
      process.exit(1);
    }
    console.log(`✔ Bucket "${BUCKET_NAME}" created successfully.`);
  } else {
    console.log(`✔ Bucket "${BUCKET_NAME}" already exists.`);
  }

  // 2. Upload product photos to Supabase Storage
  console.log('\n📸 Step 2: Uploading product photos...');
  const files = fs.readdirSync(PRODUCT_PHOTOS_DIR);
  console.log(`Found ${files.length} photos in ${PRODUCT_PHOTOS_DIR}`);

  let uploadedCount = 0;
  for (const filename of files) {
    if (filename.startsWith('.')) continue; // skip system files like .DS_Store
    
    const filePath = path.join(PRODUCT_PHOTOS_DIR, filename);
    const fileBuffer = fs.readFileSync(filePath);
    
    // We determine destination path inside bucket (looks like they were in "transparent/" folder)
    const destinationPath = `transparent/${filename}`;
    
    console.log(`Uploading ${filename} -> ${destinationPath}...`);
    const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(destinationPath, fileBuffer, {
      contentType: 'image/png',
      upsert: true
    });

    if (uploadError) {
      console.error(`❌ Error uploading ${filename}:`, uploadError.message);
    } else {
      uploadedCount++;
    }
  }
  console.log(`✔ Successfully uploaded ${uploadedCount} / ${files.length} photos.`);

  // 3. Import CSV Tables
  console.log('\n📊 Step 3: Importing database CSV tables...');
  
  // Dependency order to prevent foreign key violations (excluding profiles and user_roles as they require auth.users)
  const tablesToImport = [
    { name: 'categories', file: 'categories.csv' },
    { name: 'products', file: 'products.csv' },
    { name: 'shops', file: 'shops.csv' },
    { name: 'catalog_products', file: 'catalog_products.csv' },
    { name: 'shop_inventory', file: 'shop_inventory.csv' },
    { name: 'service_categories', file: 'service_categories.csv' },
    { name: 'services', file: 'services.csv' },
    { name: 'masters', file: 'masters.csv' },
    { name: 'master_schedule', file: 'master_schedule.csv' },
    { name: 'bookings', file: 'bookings.csv' },
    { name: 'promo_codes', file: 'promo_codes.csv' },
    { name: 'orders', file: 'orders.csv' },
    { name: 'order_items', file: 'order_items.csv' }
  ];

  for (const table of tablesToImport) {
    const csvPath = path.join(DB_EXPORT_DIR, table.file);
    if (!fs.existsSync(csvPath)) {
      console.log(`⚠️ Warning: ${table.file} not found, skipping table "${table.name}"`);
      continue;
    }

    console.log(`Importing table "${table.name}" from ${table.file}...`);
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const parsedData = parseCSV(csvContent);

    if (parsedData.length === 0) {
      console.log(`Table "${table.name}" is empty.`);
      continue;
    }

    const sanitizedData = parsedData.map(record => sanitizeRecord(table.name, record));
    
    // Perform bulk upsert to database table
    const { error: upsertError } = await supabase.from(table.name).upsert(sanitizedData, {
      onConflict: 'id'
    });

    if (upsertError) {
      console.error(`❌ Error importing table "${table.name}":`, upsertError.message);
      console.error('Sample record:', JSON.stringify(sanitizedData[0]));
    } else {
      console.log(`✔ Successfully imported ${sanitizedData.length} records into "${table.name}".`);
    }
  }

  console.log('\n🎉 Database import and photos upload complete!');
}

main().catch(err => {
  console.error('❌ Critical script error:', err);
});

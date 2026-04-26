const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey || supabaseUrl === 'your_supabase_url') {
  console.error('Please provide valid Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadCSV(filePath, tableName, mapping) {
  console.log(`Starting upload for ${tableName}...`);
  const results = [];
  let batch = [];
  const BATCH_SIZE = 500;

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        const mappedData = {};
        for (const [csvKey, dbKey] of Object.entries(mapping)) {
          mappedData[dbKey] = data[csvKey];
        }
        batch.push(mappedData);

        if (batch.length >= BATCH_SIZE) {
          const currentBatch = [...batch];
          batch = [];
          results.push(supabase.from(tableName).upsert(currentBatch));
        }
      })
      .on('end', async () => {
        if (batch.length > 0) {
          results.push(supabase.from(tableName).upsert(batch));
        }
        
        console.log(`Waiting for ${results.length} batches to upload...`);
        try {
          await Promise.all(results);
          console.log(`Finished uploading ${tableName}`);
          resolve();
        } catch (error) {
          console.error(`Error uploading ${tableName}:`, error);
          reject(error);
        }
      });
  });
}

async function run() {
  try {
    // 1. Upload Journals
    await uploadCSV(
      path.join(__dirname, '../public/data/ajol_journals.csv'),
      'journals',
      {
        source_id: 'source_id',
        source_title: 'source_title',
        country: 'country',
        issn_print: 'issn_print',
        issn_online: 'issn_online',
        source_url: 'source_url'
      }
    );

    // 2. Upload Publications
    await uploadCSV(
      path.join(__dirname, '../public/data/ajol_pub.csv'),
      'publications',
      {
        id: 'id',
        article_url: 'article_url',
        doi: 'doi',
        source_id: 'source_id',
        issue: 'issue',
        volume: 'volume',
        date: 'date',
        year: 'year',
        title: 'title',
        first_page: 'first_page',
        last_page: 'last_page'
      }
    );

    // 3. Upload Authors
    await uploadCSV(
      path.join(__dirname, '../public/data/ajol_pub_author.csv'),
      'authors',
      {
        ajol_id: 'ajol_id',
        author: 'author'
      }
    );

    // 4. Upload Keywords
    await uploadCSV(
      path.join(__dirname, '../public/data/ajol_pub_keyword.csv'),
      'keywords',
      {
        ajol_id: 'ajol_id',
        keyword: 'keyword'
      }
    );

    // 5. Upload Areas
    await uploadCSV(
      path.join(__dirname, '../public/data/ajol_journals_area.csv'),
      'journal_areas',
      {
        source_id: 'source_id',
        area: 'area'
      }
    );

    console.log('All data uploaded successfully!');
  } catch (error) {
    console.error('Upload failed:', error);
  }
}

run();

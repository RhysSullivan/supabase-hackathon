import { createClient } from '@supabase/supabase-js';
import duckdb from 'duckdb';

interface CsvProcessorConfig {
  supabaseUrl: string;
  supabaseKey: string;
  bucketName: string;
}

async function fetchCsvFromUrl(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch CSV: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function uploadToSupabaseStorage(
  config: CsvProcessorConfig,
  fileName: string,
  data: Buffer
) {
  const supabase = createClient(config.supabaseUrl, config.supabaseKey);

  const { data: uploadData, error } = await supabase
    .storage
    .from(config.bucketName)
    .upload(`csv/${fileName}`, data, {
      contentType: 'text/csv',
      upsert: true
    });

  if (error) {
    throw new Error(`Failed to upload to Supabase: ${error.message}`);
  }

  return uploadData;
}

async function queryWithDuckDb<T>(filePath: string, query: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const db = new duckdb.Database(':memory:');

    // Create a temporary table from the CSV
    db.run(
      `CREATE TEMPORARY TABLE temp_data AS SELECT * FROM read_csv_auto('${filePath}')`,
      (err) => {
        if (err) reject(err);

        // Execute the query
        db.all(query, (err, result) => {
          if (err) reject(err);
          resolve(result as T);
        });
      }
    );
  });
}

export async function processCsvData(
  config: CsvProcessorConfig,
  sourceUrl: string,
  fileName: string,
  query: string
) {
  try {
    // Step 1: Fetch CSV
    const csvData = await fetchCsvFromUrl(sourceUrl);

    // Step 2: Upload to Supabase
    const uploadResult = await uploadToSupabaseStorage(config, fileName, csvData);

    // Step 3: Query with DuckDB
    const queryResult = await queryWithDuckDb(
      `${config.supabaseUrl}/storage/v1/object/public/${config.bucketName}/csv/${fileName}`,
      query
    );

    return {
      uploadResult,
      queryResult
    };
  } catch (error) {
    throw new Error(`CSV processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

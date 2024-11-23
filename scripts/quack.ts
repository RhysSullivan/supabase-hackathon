import duckdb from "duckdb";
import { cookies } from 'next/headers';
import { env } from '~/env';
import { createClient } from '../utils/supabase/server';

// const db = new duckdb.Database(":memory:");
// db.run("CREATE TEMPORARY TABLE temp_traffic AS SELECT * FROM read_csv_auto('traffic.csv', sample_size=-1)");

// db.all("DESCRIBE temp_traffic", function(err, res) {
//     if (err) {
//       console.warn(err);
//       return;
//     }
//     // print the results with no formatting, whitespace, etc.
//     // console.log(JSON.stringify(res, null, 0))
// });

// db.all(`SELECT DISTINCT
//     analysis_neighborhood
// FROM temp_traffic
// WHERE analysis_neighborhood IS NOT NULL
// AND analysis_neighborhood != ''
// ORDER BY analysis_neighborhood;`, function(err, res) {
//     if (err) {
//       console.warn(err);
//       return;
//     }
//     console.log(res)
// });

const cookieStore = cookies();

interface DuckDbConfig {
  awsKeyId: string;
  awsSecretKey: string;
  awsRegion: string;
  endpointUrl: string;
  bucketUrl: string;
}

function setupDuckDbConnection(config: DuckDbConfig): duckdb.Database {
  const db = new duckdb.Database(":memory:");

  // Configure S3 credentials
  db.run(`
    DROP SECRET IF EXISTS supabase_storage;
    CREATE SECRET supabase_storage (
      TYPE S3,
      KEY_ID '${config.awsKeyId}',
      SECRET '${config.awsSecretKey}',
      ENDPOINT '${config.endpointUrl}',
      REGION '${config.awsRegion}',
      URL_STYLE 'path'
    )
  `);

  return db;
}

/**
 * Fetches a CSV file from a URL and returns it as a Buffer
 */
export async function fetchCsvFromUrl(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch CSV: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Uploads a CSV file to Supabase Storage and returns the full path
 */
export async function uploadCsvToStorage(
  config: DuckDbConfig,
  fileName: string,
  data: Buffer
): Promise<string> {
  const supabase = await createClient(cookieStore);

  const bucketName = new URL(config.bucketUrl).hostname;
  const filePath = `csv/${fileName}`;

  const { error } = await supabase
    .storage
    .from(bucketName)
    .upload(filePath, data, {
      contentType: 'text/csv',
      upsert: true
    });

  if (error) {
    throw new Error(`Failed to upload to storage: ${error.message}`);
  }

  return `${config.bucketUrl}/${filePath}`;
}

/**
 * Queries a CSV file directly from Supabase Storage using DuckDB
 */
export async function queryCsvFromStorage<T>(
  db: duckdb.Database,
  storagePath: string,
  query: string
): Promise<T> {
  try {
    // Execute the query
    return new Promise((resolve, reject) => {
      db.all(query.replace('${storagePath}', storagePath), (err, result) => {
        if (err) reject(err);
        else resolve(result as T);
      });
    });
  } finally {
    db.close();
  }
}

const config = {
  awsKeyId: env.AWS_ACCESS_KEY_ID,
  awsSecretKey: env.AWS_SECRET_ACCESS_KEY,
  awsRegion: env.AWS_REGION,
  endpointUrl: env.ENDPOINT_URL.replace("https://", ""),
  bucketUrl: env.BUCKET_URL,
};

const db = setupDuckDbConnection(config);

const storagePath = await uploadCsvToStorage(config, "traffic.csv", await fetchCsvFromUrl("https://data.sfgov.org/resource/ybh5-27n2.csv"));

const result = await queryCsvFromStorage(db, storagePath, "select * from read_csv_auto('${storagePath}', sample_size=-1)");

console.log(result);

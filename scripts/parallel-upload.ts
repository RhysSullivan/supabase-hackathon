import { env } from '@/env';
import { Dataset } from '@/types/data';
import { Stagehand } from '@browserbasehq/stagehand';
import * as fs from 'node:fs';
import { uploadCsvToStorage } from './quack';

interface UploadResult {
  datasetId: string;
  success: boolean;
  error?: string;
  size?: number;
}

const config = {
  awsKeyId: env.AWS_ACCESS_KEY_ID,
  awsSecretKey: env.AWS_SECRET_ACCESS_KEY,
  awsRegion: env.AWS_REGION,
  endpointUrl: env.ENDPOINT_URL.replace('https://', ''),
  bucketUrl: env.BUCKET_URL,
};

async function downloadAndUploadDataset(
  dataset: Dataset,
  stagehand: Stagehand
): Promise<UploadResult> {
  try {
    // Navigate to the CSV download page
    const page = await stagehand.page;
    if (!dataset.downloadUrl) throw new Error('Download URL not found');

    console.log(`Downloading ${dataset.title}...`);

    // Use fetch directly instead of browser download
    const response = await fetch(dataset.downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`Uploading ${dataset.title} (${buffer.length} bytes)...`);

    // Upload to Supabase
    const storagePath = await uploadCsvToStorage(
      config,
      `${dataset.id}.csv`,
      buffer
    );

    const result: UploadResult = {
      datasetId: dataset.id ?? '',
      success: true,
      size: buffer.length,
    };

    return result;

  } catch (error) {
    console.error(`Failed ${dataset.title}:`, error);
    return {
      datasetId: dataset.id ?? '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function parallelUpload() {
  // Read datasets
  const datasets: Dataset[] = JSON.parse(
    fs.readFileSync('data/sf_datasets_with_downloads.json', 'utf8')
  );

  // Read progress file if it exists
  let progress: Record<string, UploadResult> = {};
  try {
    progress = JSON.parse(fs.readFileSync('data/upload_progress.json', 'utf8'));
  } catch (error) {
    // No progress file exists yet
  }

  // Filter out already completed datasets
  const remainingDatasets = datasets.filter(
    (d) => !progress[d.id ?? '']?.success
  );

  // Create 5 parallel Stagehand instances
  const stagehandInstances = await Promise.all(
    Array(5).fill(null).map(() => new Stagehand({
      // env: 'LOCAL',
      // verbose: 1,
      env: 'BROWSERBASE',
      enableCaching: true,
    }))
  );

  // Process datasets in parallel
  const results = await Promise.all(remainingDatasets.map((dataset) => downloadAndUploadDataset(dataset, stagehandInstances[Math.floor(Math.random() * stagehandInstances.length)])));
}

parallelUpload().catch(console.error);

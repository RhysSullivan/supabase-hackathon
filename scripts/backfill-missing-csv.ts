import { env } from '@/env';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { DatasetDetails } from './parse-descriptions';

// Load environment variables
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = env.SUPABASE_SERVICE_KEY!;

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function getExistingCsvFiles() {
  const { data: files, error } = await supabase
    .storage
    .from('data')
    .list('csv', {
      limit: 700
    })

  // get all the names
  // const names = files?.map()

  // console.log(files);

  if (error) {
    throw error
  }

  return new Set(files.map(f => f.name))
}

await getExistingCsvFiles()

async function downloadAndUploadCsv(id: string, downloadUrl: string) {
  console.log(`Downloading ${id}.csv from ${downloadUrl}...`)

  try {
    const response = await fetch(downloadUrl)
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`)
    }

    const csvData = await response.text()

    // Upload to Supabase
    const { error } = await supabase
      .storage
      .from('data')
      .upload(`csv/${id}.csv`, csvData, {
        contentType: 'text/csv',
        upsert: true
      })

    if (error) {
      throw error
    }

    console.log(`Successfully uploaded ${id}.csv`)
  } catch (error) {
    console.error(`Error processing ${id}.csv:`, error)
  }
}

async function main() {
  // Read datasets from JSON file
  const datasetsJson = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), 'data', 'sf_datasets_with_details.json'),
      'utf8'
    )
  )

  // Get existing CSV files from Supabase
  const existingFiles = await getExistingCsvFiles()

  // Find missing datasets
  const missingDatasets = datasetsJson.filter(
    (dataset: any) => !existingFiles.has(`${dataset.id}.csv`)
  )

  // print names of missing datasets
  let count = 0;
  missingDatasets.forEach((dataset: DatasetDetails) => {
    console.log(`${dataset.id},${dataset.title},${dataset.downloadUrl}`)
    count++;
  })
  console.log(count);

  // Download and upload missing CSVs
  for (const dataset of missingDatasets) {
    await downloadAndUploadCsv(dataset.id, dataset.downloadUrl)
  }
}

main().catch(console.error)

// import { Stagehand } from '@browserbasehq/stagehand'
// import { createClient } from '@supabase/supabase-js'
// import fs from 'fs'
// import path from 'path'

// // Load environment variables
// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
// const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

// // Initialize Supabase client with service role key
// const supabase = createClient(supabaseUrl, supabaseServiceKey)

// async function getExistingCsvFiles() {
//   const { data: files, error } = await supabase
//     .storage
//     .from('data')
//     .list('csv', {
//       limit: 700
//     })

//   if (error) {
//     throw error
//   }

//   return new Set(files.map(f => f.name))
// }

// async function downloadAndUploadCsv(stagehand: Stagehand, id: string, downloadUrl: string) {
//   console.log(`Processing ${id}.csv from ${downloadUrl}...`)

//   try {
//     // Use stagehand to download the file
//     await stagehand.page.goto(downloadUrl, {
//       waitUntil: 'networkidle',
//       timeout: 60000 // 60 second timeout
//     })

//     // Wait for the download to complete and get the downloaded file content
//     const csvContent = await stagehand.page.evaluate(async () => {
//       const response = await fetch(window.location.href)
//       return response.text()
//     })

//     // Upload to Supabase
//     const { error } = await supabase
//       .storage
//       .from('data')
//       .upload(`csv/${id}.csv`, csvContent, {
//         contentType: 'text/csv',
//         upsert: true
//       })

//     if (error) {
//       throw error
//     }

//     console.log(`Successfully uploaded ${id}.csv`)
//   } catch (error) {
//     console.error(`Error processing ${id}.csv:`, error)
//   }
// }


// async function main() {
//   // Initialize stagehand with browserbase
//   const stagehand = new Stagehand({
//     env: 'BROWSERBASE',
//     enableCaching: true,
//   })

//   await stagehand.init()

//   // Read datasets from JSON file
//   const datasetsJson = JSON.parse(
//     fs.readFileSync(
//       path.join(process.cwd(), 'data', 'sf_datasets_with_details.json'),
//       'utf8'
//     )
//   )

//   // Get existing CSV files from Supabase
//   const existingFiles = await getExistingCsvFiles()

//   // Find missing datasets
//   const missingDatasets = datasetsJson.filter(
//     (dataset: any) => !existingFiles.has(`${dataset.id}.csv`)
//   )

//   console.log(`Found ${missingDatasets.length} missing datasets`)

//   // Process each dataset sequentially
//   for (const dataset of missingDatasets) {
//     await downloadAndUploadCsv(stagehand, dataset.id, dataset.downloadUrl)
//   }

//   // Cleanup
//   await stagehand.page.close()
//   await stagehand.context.close()
// }
// main().catch(console.error)

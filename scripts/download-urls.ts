import { Dataset } from "@/types/data";
import * as fs from "fs";

async function addDownloadUrls() {
  // First, read the existing datasets
  const rawData = fs.readFileSync('data/sf_datasets.json', 'utf8');
  const datasets: Array<Dataset> = JSON.parse(rawData).map((dataset: Dataset) => {
    // Extract the ID from the URL
    const id = dataset.url.split('/').pop() || '';

    return {
      ...dataset,
      id,
      downloadUrl: `https://data.sfgov.org/api/views/${id}/rows.csv`
    };
  });

  // Save the enhanced dataset
  fs.writeFileSync(
    "sf_datasets_with_downloads.json",
    JSON.stringify(datasets, null, 2)
  );

  console.log(`Processing complete! Added download URLs for ${datasets.length} datasets`);

  // Optional: Save just the download URLs to a separate file
  const downloadUrls = datasets.map(d => d.downloadUrl).join('\n');
  fs.writeFileSync("data/download_urls.txt", downloadUrls);
}

// Run the script
addDownloadUrls().catch(console.error);

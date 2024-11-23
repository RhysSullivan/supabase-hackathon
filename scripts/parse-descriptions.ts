import { Stagehand } from '@browserbasehq/stagehand';
import fs from 'fs/promises';
import path from 'path';

interface Dataset {
  title: string;
  url: string;
  id: string;
  downloadUrl: string;
}

interface DatasetDetails {
  title: string;
  url: string;
  id: string;
  downloadUrl: string;
  description?: string;
  providedBy?: string;
  updatedAt?: string;
  category?: string;
  tags?: string[];
}

async function parseDatasetDescriptions() {
  // Read the datasets file
  const datasetsPath = path.join(process.cwd(), 'data', 'sf_datasets_with_downloads.json');
  const datasets: Dataset[] = JSON.parse(await fs.readFile(datasetsPath, 'utf-8'));

  const stagehand = new Stagehand({
    env: "LOCAL",
    // env: 'BROWSERBASE',
    // enableCaching: true,
  });

  await stagehand.init();

  const results: DatasetDetails[] = [];

  for (let i = 0; i < datasets.length; i++) {
    const dataset = datasets[i];
    console.log(`Processing ${i + 1}/${datasets.length}: ${dataset.title}`);

    try {
      await stagehand.page.goto(dataset.url, {
        timeout: 30000,
        waitUntil: 'domcontentloaded',
      });

      // Extract information using DOM queries
      const details = await stagehand.page.evaluate((dataset: DatasetDetails) => {
        const details: DatasetDetails = {
          ...dataset,
        };

        // Get title
        const titleElement = document.querySelector('h2.asset-name');
        if (titleElement) {
          details.title = titleElement.textContent?.trim() || dataset.title;
        }

        // Get description
        const descriptionElement = document.querySelector('.collapsed-text-section>div');
        if (descriptionElement) {
          details.description = descriptionElement.textContent?.trim();
        }

        // Get provided by and updated at
        const providedByElement = document.querySelector('.metadata-row>.date');
        if (providedByElement) {
          details.providedBy = providedByElement.textContent?.trim();
        }

        const updatedAtElement = document.querySelector('.metadata-top-row>.date');
        if (updatedAtElement) {
          details.updatedAt = updatedAtElement.textContent?.trim();
        }

        // Get Topics table information
        const topicsTable = document.querySelector('.metadata-table');
        if (topicsTable) {
          const rows = topicsTable.querySelectorAll('tbody tr');
          rows.forEach((row) => {
            const header = row.querySelector('[role="rowheader"]')?.textContent?.trim();
            const value = row.querySelector('td:last-child')?.textContent?.trim();

            if (header === 'Category' && value) {
              details.category = value;
            }
            if (header === 'Tags' && value) {
              // Extract tags from the links
              const tagLinks = row.querySelectorAll('td:last-child a');
              details.tags = Array.from(tagLinks).map(link => link.textContent?.trim()).filter(Boolean) as string[];
            }
          });
        }

        return details;
      }, dataset);

      results.push(details);

      // Add a small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error processing ${dataset.title}:`, error);
      // Add the dataset with basic information even if there's an error
      results.push(dataset);
    }
  }

  // Save the results
  const outputPath = path.join(process.cwd(), 'data', 'sf_datasets_with_details.json');
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
}

parseDatasetDescriptions().catch(console.error);

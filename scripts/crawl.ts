import type { Dataset } from '@/types/data';
import { Stagehand } from '@browserbasehq/stagehand';
import * as fs from 'node:fs';

async function crawlDatasets() {
  const stagehand = new Stagehand({
    env: 'LOCAL',
    verbose: 1,
  });

  await stagehand.init();

  // Navigate to the datasets page with minimal wait
  await stagehand.page.goto('https://data.sfgov.org/browse?limitTo=datasets', {
    timeout: 10000,
    waitUntil: 'domcontentloaded',
  });

  const datasets: Array<Dataset> = [];
  let hasNextPage = true;
  let currentPage = 1;

  while (hasNextPage && currentPage <= 70) {
    // Added page limit safety just in case
    console.log(`Processing page ${currentPage}...`);

    // Use fast direct DOM selection instead of AI extraction
    const pageDatasets = await stagehand.page.evaluate(() => {
      const results: Array<Dataset> = [];
      const links = document.querySelectorAll('a.browse2-result-name-link');

      links.forEach((link) => {
        results.push({
          title: link.textContent?.trim() || '',
          url: link.getAttribute('href') || '',
        });
      });

      return results;
    });

    datasets.push(...pageDatasets);

    // Quick check for next button
    const hasNext = await stagehand.page.evaluate(() => {
      const nextButton = document.querySelector('a.next');
      return nextButton && !nextButton.classList.contains('disabled');
    });

    if (hasNext) {
      // Click next page and continue with minimal waiting
      await stagehand.page.click('a.next');
      await stagehand.page.waitForTimeout(500); // Small wait for page update
      currentPage++;
    } else {
      hasNextPage = false;
    }
  }

  // Save final results
  fs.writeFileSync('data/sf_datasets.json', JSON.stringify(datasets, null, 2));

  console.log(
    `Crawl complete! Found ${datasets.length} datasets across ${currentPage} pages`,
  );

  await stagehand.page.close();
}

// Run the crawler
crawlDatasets().catch(console.error);

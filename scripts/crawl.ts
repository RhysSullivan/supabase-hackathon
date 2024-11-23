import { Stagehand } from "@browserbasehq/stagehand";
import * as fs from "fs";

async function crawlDatasets() {
  const stagehand = new Stagehand({
    env: "LOCAL",
    verbose: 1
  });

  await stagehand.init();

  // Navigate to the datasets page with minimal wait
  await stagehand.page.goto("https://data.sfgov.org/browse?limitTo=datasets", {
    timeout: 10000,
    waitUntil: 'domcontentloaded' // Faster than 'networkidle'
  });

  const datasets: Array<{ title: string, url: string }> = [];
  let hasNextPage = true;
  let currentPage = 1;

  while (hasNextPage && currentPage <= 70) { // Added page limit safety
    console.log(`Processing page ${currentPage}...`);

    // Use fast direct DOM selection instead of AI extraction
    const pageDatasets = await stagehand.page.evaluate(() => {
      const results: Array<{ title: string, url: string }> = [];
      const links = document.querySelectorAll('a.browse2-result-name-link');

      links.forEach(link => {
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

    // Save progress every 10 pages
    if (currentPage % 10 === 0) {
      fs.writeFileSync(
        "sf_datasets_progress.json",
        JSON.stringify(datasets, null, 2)
      );
      console.log(`Progress saved: ${datasets.length} datasets so far...`);
    }
  }

  // Save final results
  fs.writeFileSync(
    "sf_datasets.json",
    JSON.stringify(datasets, null, 2)
  );

  console.log(`Crawl complete! Found ${datasets.length} datasets across ${currentPage} pages`);

  await stagehand.page.close();
}

//
// single page extraction
//
// async function crawlDatasets() {
//   const stagehand = new Stagehand({
//     env: "LOCAL",
//     verbose: 1
//   });

//   await stagehand.init();

//   // Navigate to the datasets page
//   await stagehand.page.goto("https://data.sfgov.org/browse?limitTo=datasets");

//   // Extract dataset links from current page only
//   const pageDatasets = await stagehand.extract({
//     instruction: `\
//       Extract all dataset titles and their links from the current page.
//       Only include direct links to datasets (URLs containing '/d/' or \
//       ending in specific IDs like 'g8m3-pdis'). Ignore department filter \
//       links and tag links that start with '/browse'. \
//     `,
//     schema: z.object({
//       datasets: z.array(z.object({
//         title: z.string(),
//         url: z.string()
//       }))
//     })
//   });

//   // Save results to file
//   fs.writeFileSync(
//     "sf_datasets.json",
//     JSON.stringify(pageDatasets.datasets, null, 2)
//   );

//   console.log(`Crawl complete! Found ${pageDatasets.datasets.length} datasets on first page`);

//   await stagehand.page.close();
// }

// Run the crawler
crawlDatasets().catch(console.error);

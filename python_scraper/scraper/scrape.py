import base64
import os
import re
import time

import cv2
import numpy as np
from playwright.sync_api import sync_playwright
from tqdm import tqdm

url = "https://data.sfgov.org/Public-Safety/Fire-Incidents/wr8u-xric/about_data"  # Replace with the actual website URL


def get_data_links(url):
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(
            f"wss://connect.browserbase.com?apiKey={os.environ['BROWSERBASE_API_KEY']}"
        )
        context = browser.contexts[0]
        page = context.pages[0]

        page.goto(url)

        # Find all links on the page
        links = page.evaluate(
            """
            () => {
                return Array.from(document.querySelectorAll('a')).map(a => a.href);
            }
        """
        )

        # Filter links ending with .xlsx or .csv
        download_links = [
            link for link in links if re.search(r"\.(xlsx|csv)$", link, re.IGNORECASE)
        ]

        browser.close()
        return download_links


# # Example usage
# download_links = get_download_links(url)

# print("Download links:")
# for link in download_links:
#     print(link)


def get_page_text(url, max_retries=3, delay=5):
    retries = 0
    while retries < max_retries:
        try:
            with sync_playwright() as p:
                browser = p.chromium.connect_over_cdp(
                    f"wss://connect.browserbase.com?apiKey={os.environ['BROWSERBASE_API_KEY']}"
                )
                context = browser.contexts[0]
                page = context.pages[0]

                page.goto(url)

                # Extract all text from the page
                text_content = page.evaluate(
                    """
                    () => {
                        return document.body.innerText;
                    }
                """
                )

                browser.close()
                return text_content
        except Exception as e:
            print(f"Error: {e}")
            if "Too Many Requests" in str(e):
                retries += 1
                print(f"Retrying {retries}/{max_retries} after {delay} seconds...")
                time.sleep(delay)
            else:
                raise
    raise Exception("Max retries exceeded")


# Example usage
# page_text = get_page_text(url)

# print("Page text:")
# print(page_text)


def take_full_page_screenshot(url):
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(
            f"wss://connect.browserbase.com?apiKey={os.environ['BROWSERBASE_API_KEY']}"
        )
        context = browser.contexts[0]
        page = context.pages[0]

        page.goto(url, wait_until="domcontentloaded")

        temp_path = "temp_screenshot.jpeg"
        page.screenshot(path=temp_path, full_page=True)
        browser.close()

        with open(temp_path, "rb") as image_file:
            base64_screenshot = base64.b64encode(image_file.read()).decode("utf-8")

        os.remove(temp_path)
        return base64_screenshot


def display_base64_image(base64_string):
    img_data = base64.b64decode(base64_string)
    img_array = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)

    cv2.imshow("Screenshot", img)
    cv2.waitKey(0)
    cv2.destroyAllWindows()


# base64_screenshot = take_full_page_screenshot(url)
# display_base64_image(base64_screenshot)


def get_text_from_urls(website_urls, max_retries=3, delay=5):
    with sync_playwright() as p:
        browser = p.chromium.connect_over_cdp(
            f"wss://connect.browserbase.com?apiKey={os.environ['BROWSERBASE_API_KEY']}"
        )
        context = browser.contexts[0]
        page = context.pages[0]

        for index, website in enumerate(tqdm(website_urls, desc="Processing URLs")):
            url = website["url"]
            retries = 0
            while retries < max_retries:
                try:
                    page.goto(url)
                    text_content = page.evaluate(
                        """
                        () => {
                            return document.body.innerText;
                        }
                        """
                    )
                    website["text"] = text_content
                    break
                except Exception as e:
                    print(f"Error: {e}")
                    if "Too Many Requests" in str(e):
                        retries += 1
                        print(
                            f"Retrying {retries}/{max_retries} after {delay} seconds..."
                        )
                    else:
                        raise

            # Save checkpoint every 50 iterations
            if (index + 1) % 25 == 0:
                with open(
                    f"scraper/checkpoints/checkpoint_{index + 1 + 124}.json", "w"
                ) as f:
                    json.dump(website_urls, f)

        browser.close()
    return website_urls


import glob
import json

if __name__ == "__main__":
    with open("scraper/download_links.json", "r") as f:
        data_links = json.load(f)
    data_links = data_links[125:]
    enhanced_data_links = get_text_from_urls(data_links)
    with open("scraper/enhanced_data_links.json", "w") as f:
        json.dump(enhanced_data_links, f)

    # all_data_links = []
    # checkpoint_dir = "scraper/checkpoints"
    # for checkpoint_file in glob.glob(os.path.join(checkpoint_dir, "checkpoint_*.json")):
    #     with open(checkpoint_file, "r") as f:
    #         all_data_links.extend(json.load(f))

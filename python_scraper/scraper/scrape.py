import base64
import os
import re

import cv2
import numpy as np
from playwright.sync_api import sync_playwright

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


def get_page_text(url):
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

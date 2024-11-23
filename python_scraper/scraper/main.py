import code
import os
import tempfile
from typing import Dict, List

from scraper.scrape import get_data_links, get_page_text, take_full_page_screenshot
from scraper.utils.llm import LLMClient
from scraper.utils.supabase import SupabaseClient


class DataPageProcessor:
    def __init__(self):
        self.llm_client = LLMClient()
        # self.supabase_client = SupabaseClient()

    def process_page(self, url: str) -> None:
        # Create temporary file for screenshot
        with tempfile.NamedTemporaryFile(suffix=".jpeg", delete=False) as temp_file:
            screenshot_path = temp_file.name

            # Take screenshot
            take_full_page_screenshot(url, screenshot_path)

            # Get download links
            download_links = get_data_links(url)

            # Get page analysis from LLM
            with open(screenshot_path, "rb") as image_file:
                page_analysis = self.llm_client.get_response(image_file)

            # Prepare data for Supabase
            page_data = {
                "url": url,
                "title": page_analysis["title"],
                "description": page_analysis["description"],
                "download_links": download_links,
            }

            # Upload to Supabase
            self.supabase_client.upsert_embeddings("data_pages", [page_data])

            # Cleanup
            os.unlink(screenshot_path)

    def process_just_text(self, url: str) -> None:
        # Get page text content
        page_text = get_page_text(url)

        # Get download links
        download_links = get_data_links(url)

        # Get page analysis from LLM using text
        page_analysis = self.llm_client.get_text_response(page_text, download_links)
        code.interact(local=locals())
        # Prepare data for Supabase
        page_data = {
            "url": url,
            "title": page_analysis["title"],
            "description": page_analysis["description"],
            "download_links": download_links,
        }

        # # Upload to Supabase
        # self.supabase_client.upsert_embeddings("data_pages", [page_data])


def main():
    processor = DataPageProcessor()
    url = "https://data.sfgov.org/Public-Safety/Fire-Incidents/wr8u-xric/about_data"
    processor.process_just_text(url)


if __name__ == "__main__":
    main()

import code
import json
import os
import tempfile
import time
from typing import Dict, List

from dotenv import load_dotenv
from scraper.scrape import get_data_links, get_page_text, take_full_page_screenshot
from scraper.utils.llm import LLMClient
from scraper.utils.supabase_client import SupabaseClient
from scraper.utils.utils import download_file
from scraper.utils.vectorizer import get_embedding

load_dotenv()


class DataPageProcessor:
    def __init__(self):
        self.llm_client = LLMClient()
        self.supabase_client = SupabaseClient()

    def process_page(self, url: str) -> None:
        # Create temporary file for screenshot
        with tempfile.NamedTemporaryFile(suffix=".jpeg", delete=False) as temp_file:
            screenshot_path = temp_file.name

            # Take screenshot
            take_full_page_screenshot(url, screenshot_path)

            # Get download links
            download_links = get_data_links(url)

            download_file(download_links[0])

            code.interact(local=locals())
            exit()
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
        print(f"\nProcessing URL: {url}")

        # Get page text content
        page_text = get_page_text(url)
        print(f"Retrieved page text: {len(page_text)} characters")

        # Get download links
        download_links = get_data_links(url)
        print(f"Found download links: {len(download_links)} links")

        # Get page analysis from LLM using text
        page_analysis = self.llm_client.get_text_response_and_download_link(
            page_text, download_links
        )
        print(f"Received LLM analysis with title: {page_analysis.title}")

        primary_data_link = page_analysis.primary_data_link.LINK_0.value
        print(f"Primary data link: {primary_data_link}")

        title_embedding = get_embedding(page_analysis.title)
        print(f"Generated title embedding: {len(title_embedding)} dimensions")

        description_embedding = get_embedding(page_analysis.description)
        print(
            f"Generated description embedding: {len(description_embedding)} dimensions"
        )

        # Prepare data for Supabase
        page_data = {
            "url": url,
            "title": page_analysis.title,
            "description": page_analysis.description,
            "csv_url": primary_data_link,
            "description_vector": description_embedding,
            "title_vector": title_embedding,
        }

        print("Prepared data for Supabase upload")

        # Upload to Supabase
        self.supabase_client.upsert_embeddings("sf_csv_data", [page_data])
        print("Uploaded data to Supabase")

    def process_with_preprocessed_data(
        self,
        url: str,
        download_link: str,
        pre_extracted_title: str,
        page_text: str,
        id: str,
    ) -> None:
        print(f"\nProcessing URL: {url}")

        # page_text = get_page_text(url)
        print(f"Retrieved page text: {len(page_text)} characters")

        page_analysis = self.llm_client.get_text_response(page_text)
        print(
            f"Received LLM analysis with title: {page_analysis.title} and description: {page_analysis.description}"
        )

        title_embedding = get_embedding(pre_extracted_title)
        description_embedding = get_embedding(page_analysis.description)
        # file_content, file_extension = download_file(download_link)
        # full_csv_path = self.supabase_client.upload_csv_to_bucket(
        #     "data", file_content, "csv", file_extension, pre_extracted_title
        # )
        page_data = {
            "title": pre_extracted_title,
            "llm_enhanced_title": page_analysis.title,
            "description": page_analysis.description,
            "csv_url": download_link,
            "description_vector": description_embedding,
            "title_vector": title_embedding,
            "url": url,
            "id": id,
            # "csv_filepath": full_csv_path,
        }

        print("Prepared data for Supabase upload")
        self.supabase_client.upsert_embeddings("sf_csv_data_duplicate", [page_data])
        print("Uploaded data to Supabase")

    def process_with_preprocessed_data_local(
        self, url: str, download_link: str, pre_extracted_title: str, page_text: str
    ) -> None:
        print(f"\nProcessing URL: {url}")

        # page_text = get_page_text(url)
        print(f"Retrieved page text: {len(page_text)} characters")

        page_analysis = self.llm_client.get_text_response(page_text)
        print(
            f"Received LLM analysis with title: {page_analysis.title} and description: {page_analysis.description}"
        )

        title_embedding = get_embedding(pre_extracted_title)
        description_embedding = get_embedding(page_analysis.description)

        # full_csv_path = self.supabase_client.download_csv_to_local(
        #     download_link, "csv", pre_extracted_title
        # )
        page_data = {
            "title": pre_extracted_title,
            "llm_enhanced_title": page_analysis.title,
            "description": page_analysis.description,
            "csv_url": download_link,
            "description_vector": description_embedding,
            "title_vector": title_embedding,
            "url": url,
            # "csv_filepath": full_csv_path,
        }

        print("Prepared data for Supabase upload")

        return page_data

    def upsert_data_from_json(self, json_file_path: str) -> None:
        print(f"Reading data from JSON file: {json_file_path}")
        with open(json_file_path, "r") as f:
            data_rows = json.load(f)

        print(f"Upserting {len(data_rows)} records to Supabase")
        self.supabase_client.upsert_embeddings("sf_csv_data", data_rows)
        print("Upsert completed")


def main():
    processor = DataPageProcessor()
    url = "https://data.sfgov.org/Public-Safety/Fire-Incidents/wr8u-xric/about_data"
    json_file_path = "scraper/download_links.json"
    import glob
    import os

    all_data_links = []
    checkpoint_dir = "scraper/checkpoints"
    for checkpoint_file in glob.glob(os.path.join(checkpoint_dir, "checkpoint_*.json")):
        with open(checkpoint_file, "r") as f:
            all_data_links.extend(json.load(f))

    data_links = all_data_links
    # Process each entry
    errors = []
    uploaded_data = []
    for entry in data_links:
        try:
            page_data = processor.process_with_preprocessed_data(
                url=entry["url"],
                download_link=entry["downloadUrl"],
                pre_extracted_title=entry["title"],
                page_text=entry["text"],
                id=entry["id"],
            )
            uploaded_data.append(page_data)
        except Exception as e:
            print(f"Error processing {entry['title']}: {str(e)}")
            errors.append({"url": entry["url"], "error": str(e)})

    with open("errors.json", "w") as f:
        json.dump(errors, f)

    with open("uploaded_data.json", "w") as f:
        json.dump(uploaded_data, f)


if __name__ == "__main__":
    main()

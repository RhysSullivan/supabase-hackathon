import os
from typing import Any, Dict, List
from uuid import uuid4

import requests
from dotenv import load_dotenv
from scraper.utils.utils import download_file
from supabase import create_client

load_dotenv()


class SupabaseClient:
    def __init__(self):
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
        self.client = create_client(supabase_url, supabase_key)

    def upsert_embeddings(self, table_name: str, data: List[Dict[Any, Any]]) -> None:
        try:
            print(f"Upserting {len(data)} embeddings to {table_name}")
            self.client.table(table_name).upsert(data).execute()
        except Exception as e:
            raise Exception(f"Failed to upsert embeddings to {table_name}: {str(e)}")

    def match_embeddings(
        self, table_name: str, query_embedding: List[float], match_count: int = 5
    ) -> List[Dict[Any, Any]]:
        try:
            response = self.client.rpc(
                "match_documents",
                {
                    "query_embedding": query_embedding,
                    "match_count": match_count,
                    "table_name": table_name,
                },
            ).execute()
            return response.data
        except Exception as e:
            raise Exception(f"Failed to match embeddings in {table_name}: {str(e)}")

    def test_upload(self) -> None:
        try:
            test_data = [{"title": "test title"}]
            self.upsert_embeddings("sf_csv_data", test_data)
            print("✅ Test upload successful")
        except Exception as e:
            print(f"❌ Test upload failed: {str(e)}")
            raise Exception(f"Failed to upload test data: {str(e)}")

    def upload_csv_to_bucket(
        self,
        bucket_name: str,
        file_content: bytes,
        folder_path: str,
        file_extension: str,
        title: str,
    ) -> str:
        print(f"uploading csv to {bucket_name}")
        print(f"File size: {len(file_content) / (1024 * 1024):.2f} MB")
        try:
            normalized_title = (
                title.lower().replace(" ", "_").replace("/", "_").replace(".", "_")
            )
            full_path = (
                f"{folder_path}/{normalized_title}_{str(uuid4())}.{file_extension}"
            )
            self.client.storage.from_(bucket_name).upload(
                path=full_path,
                file=file_content,
                file_options={"content-type": "text/csv"},
            )
            return full_path
        except Exception as e:
            raise Exception(f"Failed to upload CSV to bucket {bucket_name}: {str(e)}")

    def download_csv_to_local(
        self,
        url: str,
        folder_path: str,
        title: str,
    ) -> str:
        print("Downloading CSV to local file")
        try:
            response = requests.get(url, stream=True)
            response.raise_for_status()

            file_extension = url.split(".")[-1].lower()
            if file_extension not in ["csv", "xlsx"]:
                raise ValueError("File must be a .csv or .xlsx file")

            normalized_title = (
                title.lower().replace(" ", "_").replace("/", "_").replace(".", "_")
            )
            full_path = (
                f"{folder_path}/{normalized_title}_{str(uuid4())}.{file_extension}"
            )

            with open(full_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)

            return full_path
        except Exception as e:
            raise Exception(f"Failed to download CSV to local: {str(e)}")


# client = SupabaseClient()
# bucket_name = "data"
# file_path = "csv"
# file_content, file_extension = download_file(
#     "https://data.sfgov.org/api/views/wr8u-xric/files/54c601a2-63f1-4b27-a79d-f484c620f061?download=true&filename=FIR-0001_DataDictionary_fire-incidents.xlsx"
# )
# print(file_extension)

# client.upload_csv_to_bucket(
#     bucket_name, file_content, file_path, file_extension, "fire incidents"
# )

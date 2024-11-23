import os
from typing import Any, Dict, List

from supabase import create_client


class SupabaseClient:
    def __init__(self):
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_KEY")
        self.client = create_client(supabase_url, supabase_key)

    def upsert_embeddings(self, table_name: str, data: List[Dict[Any, Any]]) -> None:
        try:
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

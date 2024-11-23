import os
from enum import Enum
from typing import Type

from openai import OpenAI
from pydantic import BaseModel, Field, create_model
from scraper.utils.utils import get_content_objects


def create_data_link_enum(data_links: list[str]) -> Type[Enum]:
    return Enum("DataLink", {f"LINK_{i}": link for i, link in enumerate(data_links)})


class DataResponse(BaseModel):
    title: str
    description: str
    primary_data_link: str

    @classmethod
    def with_dynamic_enum(cls, data_links: list[str]):
        DataLinkEnum = create_data_link_enum(data_links)
        return create_model(
            "DataResponse",
            __module__=__name__,
            title=(str, ...),
            description=(str, ...),
            primary_data_link=(DataLinkEnum, ...),
        )


class WithoutDownloadLinkResponse(BaseModel):
    title: str
    description: str


class LLMClient:
    def __init__(self):
        self.openai_client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    def get_response(self, image, text, data_links):
        content = get_content_objects(image, "jpeg")
        messages = [
            {
                "role": "system",
                "content": "Analyze the following content and identify the most relevant download link. The content includes a screenshot of the page, scraped text, and available download links.",
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Screenshot of the page:"},
                    *content,
                    {"type": "text", "text": f"Scraped text from the page:\n{text}"},
                    {
                        "type": "text",
                        "text": f"Available download links:\n{', '.join(data_links)}",
                    },
                ],
            },
        ]

        completion = self.openai_client.beta.chat.completions.parse(
            model="gpt-4o-2024-08-06",
            messages=messages,
            response_format=DataResponse.with_dynamic_enum(data_links),
        )

        return completion.choices[0].message.parsed

    def get_text_response_and_download_link(
        self, text: str, data_links: list[str]
    ) -> DataResponse:
        messages = [
            {
                "role": "system",
                "content": "Analyze the following content and identify the most relevant download link. The content includes scraped text and available download links.",
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": f"Scraped text from the page:\n{text}"},
                    {
                        "type": "text",
                        "text": f"Available download links:\n{', '.join(data_links)}",
                    },
                ],
            },
        ]

        completion = self.openai_client.beta.chat.completions.parse(
            model="gpt-4o-2024-08-06",
            messages=messages,
            response_format=DataResponse.with_dynamic_enum(data_links),
        )

        return completion.choices[0].message.parsed

    def get_text_response(self, text: str) -> WithoutDownloadLinkResponse:
        messages = [
            {
                "role": "system",
                "content": "Analyze the following content and extract the title and description.",
            },
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": f"Scraped text from the page:\n{text}"},
                ],
            },
        ]

        completion = self.openai_client.beta.chat.completions.parse(
            model="gpt-4o-2024-08-06",
            messages=messages,
            response_format=WithoutDownloadLinkResponse,
        )

        return completion.choices[0].message.parsed


# def test_data_response():
#     # Test data
#     sample_links = [
#         "https://example.com/data1.pdf",
#         "https://example.com/data2.csv",
#         "https://example.com/data3.xlsx",
#     ]

#     # Create dynamic model
#     DynamicResponse = DataResponse.with_dynamic_enum(sample_links)

#     # Create instance
#     try:
#         response = DynamicResponse(
#             title="Test Document",
#             description="A test description",
#             primary_data_link=sample_links[0],  # Use the actual URL instead of "LINK_0"
#         )
#         print("Test passed! Created instance:", response.model_dump())
#         return True
#     except Exception as e:
#         print(f"Test failed with error: {e}")
#         return False


# if __name__ == "__main__":
#     test_data_response()

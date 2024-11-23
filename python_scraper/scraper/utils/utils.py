import base64
import code
import io

import pandas as pd
import requests


def get_content_objects(file_content: str, file_extension: str) -> list:
    content_objects = []

    if file_extension in ["jpg", "jpeg", "png"]:
        content_objects = [
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/{file_extension};base64,{file_content}",
                    "detail": "high",
                },
            }
        ]

    else:
        raise ValueError(f"Unsupported file type: {file_extension}")

    return content_objects


def download_file(url: str) -> tuple[bytes, str]:
    response = requests.get(url, stream=True)
    response.raise_for_status()
    print(f"Downloaded file from {url}")
    file_extension = url.split(".")[-1].lower()
    if file_extension not in ["csv", "xlsx"]:
        raise ValueError(f"Unsupported file type: {file_extension}")

    return response.content, (url.split(".")[-1])


def download_file_to_local(url: str, save_path: str) -> tuple[bytes, str]:
    response = requests.get(url, stream=True)
    response.raise_for_status()
    print(f"Downloaded file from {url}")
    file_extension = url.split(".")[-1].lower()
    if file_extension not in ["csv", "xlsx"]:
        raise ValueError(f"Unsupported file type: {file_extension}")

    # Save the file locally
    with open(save_path, "wb") as file:
        file.write(response.content)
    print(f"File saved to {save_path}")

    return response.content, file_extension

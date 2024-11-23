import base64
import io


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

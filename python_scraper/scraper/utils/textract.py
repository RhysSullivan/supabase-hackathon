import base64
import logging
import os
from collections import defaultdict

import boto3
from regimen_python.llm.utils.utils import pdf_to_base64_pngs

logger = logging.getLogger("regimen")
log_level = os.getenv("LOG_LEVEL", "INFO").upper()
logger.setLevel((getattr(logging, log_level)))


class TextractClient:
    def __init__(
        self,
        aws_access_key_id,
        aws_secret_access_key,
        region_name,
        encrypt_key,
    ):
        if any(
            cred is None
            for cred in [aws_access_key_id, aws_secret_access_key, region_name]
        ):
            raise ValueError("Missing required AWS credentials for TextractClient")

        self.client = boto3.client(
            "textract",
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
            region_name=region_name,
        )

    def detect_document_text(self, img_bytes):
        try:
            return self.client.detect_document_text(Document={"Bytes": img_bytes})
        except Exception as e:
            logger.error(f"Failed to detect document text: {str(e)}")
            raise

    def transcribe(self, base64_string, filename):
        logger.info(f"Transcribing document with aws textract: {filename}")
        file_extension = os.path.splitext(filename)[1].lower()
        logger.debug(f"Processing file with extension: {file_extension}")

        try:
            result = None
            if file_extension == ".pdf":
                result = self._extract_text_from_pdf_base64(base64_string)
            else:
                result = self._extract_text_from_base64(base64_string)

            return result
        except Exception as e:
            logger.error(f"Failed to transcribe document {filename}: {str(e)}")
            raise

    def _detect_and_process_document_text_from_base64(self, base64_string):
        try:
            img_bytes = base64.b64decode(base64_string)
            logger.debug("Detecting document text with Textract")
            response = self.client.detect_document_text(Document={"Bytes": img_bytes})
            return self._process_detected_text_response(response)
        except Exception as e:
            logger.error(f"Failed to detect document text: {str(e)}")
            raise

    def _process_detected_text_response(self, response):
        blocks = response["Blocks"]
        text = ""
        for block in blocks:
            if block["BlockType"] == "WORD":
                text += block["Text"] + " "
            elif block["BlockType"] == "LINE":
                text += "\n"
        return text.strip()

    def _extract_text_from_base64(self, base64_string):
        return self._detect_and_process_document_text_from_base64(base64_string)

    def _extract_text_from_pdf_base64(self, base64_pdf):
        logger.info(f"Processing PDF with feature type: TEXT")
        base64_pngs = pdf_to_base64_pngs(base64_pdf)
        logger.debug(f"PDF converted to {len(base64_pngs)} PNG images")
        extracted_text = []

        for i, base64_png in enumerate(base64_pngs, 1):
            logger.debug(f"Processing page {i} of {len(base64_pngs)}")
            extracted_text.append(self._extract_text_from_base64(base64_png))

        return "\n".join(extracted_text).strip()

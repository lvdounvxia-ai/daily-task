"""自定义 HTTP 多部分上传接口（预留，对接内部图片服务）。"""

from pathlib import Path
from typing import Any, Dict, Optional

import requests

from src.providers.base import GenerationProvider


class HttpMultipartProvider(GenerationProvider):
    provider_id = "http_multipart"

    def __init__(self, endpoint: str, api_key: str = "", timeout: int = 600) -> None:
        if not endpoint:
            raise ValueError("HTTP endpoint is empty")
        self.endpoint = endpoint
        self.api_key = api_key
        self.timeout = timeout

    def generate_text_from_image(
        self,
        image_path: str,
        instruction: str,
        *,
        task_id: str = "",
        extra: Optional[Dict[str, Any]] = None,
    ) -> str:
        raise NotImplementedError("http_multipart provider does not support text generation")

    def generate_image_from_prompt(
        self,
        prompt: str,
        output_path: Path,
        *,
        extra: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        data = {"prompt": prompt}
        resp = requests.post(self.endpoint, headers=headers, data=data, timeout=self.timeout)
        resp.raise_for_status()
        self._write_response(resp, output_path)
        return {"api_method": "http_multipart_generate", "endpoint": self.endpoint}

    def edit_image_from_prompt(
        self,
        image_path: str,
        prompt: str,
        output_path: Path,
        *,
        extra: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        headers = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        with open(image_path, "rb") as f:
            files = {"image": (Path(image_path).name, f, "application/octet-stream")}
            data = {"prompt": prompt}
            resp = requests.post(self.endpoint, headers=headers, data=data, files=files, timeout=self.timeout)
        resp.raise_for_status()
        self._write_response(resp, output_path)
        return {"api_method": "http_multipart_edit", "endpoint": self.endpoint, "input_image_path": image_path}

    def _write_response(self, resp: requests.Response, output_path: Path) -> None:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        content_type = resp.headers.get("Content-Type", "")
        if "image" in content_type:
            output_path.write_bytes(resp.content)
            return
        payload = resp.json()
        url = payload.get("url") or payload.get("image_url")
        if not url:
            raise ValueError(f"HTTP API response missing image url: {payload}")
        img_resp = requests.get(url, timeout=120)
        img_resp.raise_for_status()
        output_path.write_bytes(img_resp.content)

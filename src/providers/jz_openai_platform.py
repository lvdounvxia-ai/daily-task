"""
JZ 短剧平台 OpenAI 兼容 API。

支持：
- chat.completions（多模态：图片+指令→文本）
- images.generate（文本→图片）
- images.edit（图片+指令→图片，平台不支持时降级到 generate）
"""

import base64
import logging
from pathlib import Path
from typing import Any, Dict, Optional

from src.providers.base import GenerationProvider

logger = logging.getLogger(__name__)

TEXT_SYSTEM = """你是图像理解与文本生成助手。
请严格遵循用户指令，基于输入图片完成任务。
只输出任务要求的内容，不要附加无关解释。"""


class JzOpenAIPlatformProvider(GenerationProvider):
    provider_id = "jz_openai"

    def __init__(
        self,
        api_key: str,
        base_url: str,
        model: str,
        *,
        size: str = "1024x1024",
        response_format: str = "b64_json",
        timeout: int = 300,
        max_retries: int = 3,
    ) -> None:
        if not api_key:
            raise ValueError("JZ API key is empty")
        if not base_url:
            raise ValueError("JZ API base_url is empty")
        if not model:
            raise ValueError("JZ model is empty")

        try:
            import httpx
            from openai import OpenAI
        except ImportError as exc:
            raise RuntimeError("pip install openai httpx") from exc

        self.model = model
        self.size = size
        self.response_format = response_format
        self.timeout = timeout
        self.max_retries = max_retries
        # 避免本机 SOCKS/HTTP 代理导致 openai SDK 初始化失败
        http_client = httpx.Client(trust_env=False, timeout=timeout)
        self._client = OpenAI(
            api_key=api_key,
            base_url=base_url.rstrip("/"),
            max_retries=max_retries,
            http_client=http_client,
        )

    def _save_b64_image(self, b64_data: str, output_path: Path) -> None:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(base64.b64decode(b64_data))

    def _save_image_response(self, resp: Any, output_path: Path) -> Dict[str, Any]:
        item = resp.data[0]
        if getattr(item, "b64_json", None):
            self._save_b64_image(item.b64_json, output_path)
            return {"saved_path": str(output_path), "source": "b64_json"}
        if getattr(item, "url", None):
            import requests
            r = requests.get(item.url, timeout=120)
            r.raise_for_status()
            output_path.write_bytes(r.content)
            return {"saved_path": str(output_path), "source": "url", "url": item.url}
        raise ValueError(f"images API response missing b64_json/url: {item}")

    def generate_text_from_image(
        self,
        image_path: str,
        instruction: str,
        *,
        task_id: str = "",
        extra: Optional[Dict[str, Any]] = None,
    ) -> str:
        from src.common.llm_client import image_to_data_url

        user_text = (
            f"任务ID: {task_id}\n"
            f"指令:\n{instruction}\n"
            "请基于输入图片完成任务。"
        )

        resp = self._client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": TEXT_SYSTEM},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_text},
                        {"type": "image_url", "image_url": {"url": image_to_data_url(image_path)}},
                    ],
                },
            ],
            temperature=0.2,
        )
        return resp.choices[0].message.content or ""

    def generate_image_from_prompt(
        self,
        prompt: str,
        output_path: Path,
        *,
        extra: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        size = (extra or {}).get("size") or self.size
        response_format = (extra or {}).get("response_format") or self.response_format
        n = int((extra or {}).get("n") or 1)

        resp = self._client.images.generate(
            model=self.model,
            prompt=prompt,
            n=n,
            size=size,
            response_format=response_format,
        )
        meta = self._save_image_response(resp, output_path)
        meta.update({"api_method": "images_generate", "model": self.model, "size": size})
        return meta

    def edit_image_from_prompt(
        self,
        image_path: str,
        prompt: str,
        output_path: Path,
        *,
        extra: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        size = (extra or {}).get("size") or self.size
        response_format = (extra or {}).get("response_format") or self.response_format

        try:
            with open(image_path, "rb") as img_f:
                resp = self._client.images.edit(
                    model=self.model,
                    image=img_f,
                    prompt=prompt,
                    n=1,
                    size=size,
                    response_format=response_format,
                )
            meta = self._save_image_response(resp, output_path)
            meta.update({"api_method": "images_edit", "model": self.model, "size": size})
            return meta
        except Exception as exc:
            # 平台若暂未开放 images.edit，降级为 generate（prompt 中附带编辑说明）
            logger.warning("images.edit failed, fallback to images.generate: %s", exc)
            fallback_prompt = (
                "请根据以下图片编辑任务生成结果图。"
                "尽量保持原图主体与构图，仅完成指定编辑。\n"
                f"编辑指令：{prompt}"
            )
            meta = self.generate_image_from_prompt(fallback_prompt, output_path, extra=extra)
            meta["api_method"] = "images_generate_fallback"
            meta["fallback_reason"] = str(exc)
            meta["input_image_path"] = image_path
            return meta

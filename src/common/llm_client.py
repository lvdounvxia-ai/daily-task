import base64
import json
import logging
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger(__name__)


def image_to_data_url(image_path: str) -> str:
    p = Path(image_path)
    suffix = p.suffix.lower()
    mime = "image/png"
    if suffix in [".jpg", ".jpeg"]:
        mime = "image/jpeg"
    elif suffix == ".webp":
        mime = "image/webp"

    b64 = base64.b64encode(p.read_bytes()).decode("utf-8")
    return f"data:{mime};base64,{b64}"


def extract_json_object(text: str) -> Dict[str, Any]:
    text = (text or "").strip()

    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*", "", text).strip()
        text = re.sub(r"```$", "", text).strip()

    try:
        return json.loads(text)
    except Exception:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        return json.loads(text[start:end + 1])

    raise ValueError(f"Cannot parse JSON from model response: {text[:500]}")


def clamp_score(x: Any) -> Optional[float]:
    if x is None or x == "":
        return None
    try:
        return round(max(0.0, min(100.0, float(x))), 4)
    except Exception:
        return None


class OpenAICompatibleClient:
    def __init__(
        self,
        api_base: str,
        api_key: str,
        model: str,
        timeout: int = 180,
        max_retries: int = 3,
    ) -> None:
        self.api_base = api_base.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.timeout = timeout
        self.max_retries = max_retries

    @property
    def chat_url(self) -> str:
        if self.api_base.endswith("/chat/completions"):
            return self.api_base
        return f"{self.api_base}/chat/completions"

    def chat(
        self,
        system_prompt: str,
        user_text: str,
        image_paths: Optional[List[str]] = None,
        temperature: float = 0.0,
        json_mode: bool = False,
    ) -> str:
        content: List[Dict[str, Any]] = [{"type": "text", "text": user_text}]

        for p in image_paths or []:
            if p and Path(p).exists():
                content.append({
                    "type": "image_url",
                    "image_url": {"url": image_to_data_url(p)},
                })

        payload: Dict[str, Any] = {
            "model": self.model,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": content},
            ],
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        last_error = None
        for i in range(self.max_retries):
            try:
                resp = requests.post(
                    self.chat_url,
                    headers=headers,
                    json=payload,
                    timeout=self.timeout,
                )
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"]
            except Exception as exc:
                last_error = exc
                logger.exception("LLM request failed attempt=%d", i + 1)
                time.sleep(min(20, 2 * (i + 1)))

        raise RuntimeError(f"LLM request failed after retries: {last_error}")

    def chat_json(
        self,
        system_prompt: str,
        user_text: str,
        image_paths: Optional[List[str]] = None,
        temperature: float = 0.0,
    ) -> Dict[str, Any]:
        text = self.chat(
            system_prompt=system_prompt,
            user_text=user_text,
            image_paths=image_paths,
            temperature=temperature,
            json_mode=True,
        )
        return extract_json_object(text)

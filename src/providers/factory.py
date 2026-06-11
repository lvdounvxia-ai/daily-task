import os
from typing import Any, Dict

from src.providers.http_multipart import HttpMultipartProvider
from src.providers.jz_openai_platform import JzOpenAIPlatformProvider


def _resolve_platform(cfg: Dict[str, Any], model_cfg: Dict[str, Any]) -> Dict[str, Any]:
    platform_id = model_cfg.get("platform", "")
    platforms = cfg.get("platforms") or {}
    if platform_id and platform_id in platforms:
        return platforms[platform_id]
    return {}


def _env_value(key: str, default: str = "") -> str:
    return os.getenv(key, default) if key else default


def create_provider(cfg: Dict[str, Any], model_cfg: Dict[str, Any]):
    provider = model_cfg.get("provider", "jz_openai")
    platform = _resolve_platform(cfg, model_cfg)

    api_base = _env_value(
        model_cfg.get("api_base_env") or platform.get("api_base_env", "JZ_API_BASE_URL"),
        platform.get("default_base_url", "https://jzapi.duanju.com/v1"),
    )
    api_key = _env_value(
        model_cfg.get("api_key_env") or platform.get("api_key_env", "JZ_API_KEY"),
    )
    model = model_cfg.get("model") or _env_value(model_cfg.get("model_env", ""))

    if provider in {"jz_openai", "openai_sdk", "openai_images"}:
        return JzOpenAIPlatformProvider(
            api_key=api_key,
            base_url=api_base,
            model=model,
            size=model_cfg.get("size", "1024x1024"),
            response_format=model_cfg.get("response_format", "b64_json"),
            timeout=int(model_cfg.get("timeout", 300)),
            max_retries=int(model_cfg.get("max_retries", 3)),
        )

    if provider == "http_multipart":
        endpoint = _env_value(model_cfg.get("endpoint_env", "IMAGE_GEN_API_ENDPOINT"))
        return HttpMultipartProvider(endpoint=endpoint, api_key=api_key)

    if provider == "openai_compatible":
        # 文本多模态仍走 requests chat；与历史配置兼容
        from src.common.llm_client import OpenAICompatibleClient
        return OpenAICompatibleClient(api_base=api_base, api_key=api_key, model=model)

    raise ValueError(f"unknown provider: {provider}")

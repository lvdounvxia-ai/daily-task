#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
调用被测生成模型，产出 output_text 或 output_image_path。

Provider 接口（src/providers/）：
- chat_vision          图片+指令 → 文本
- images_generate      文本 → 图片
- images_edit          图片+指令 → 图片（不支持时自动降级 generate）
- http_multipart       自定义 HTTP（预留）
"""

import argparse
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List

import yaml

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from project_paths import project_path
from src.common.env import load_dotenv
from src.common.io import append_jsonl, load_done_items, read_jsonl
from src.common.llm_client import OpenAICompatibleClient
from src.providers.base import GenerationProvider
from src.providers.factory import create_provider

LOG_FORMAT = "%(asctime)s [%(levelname)s] %(message)s"

TEXT_SYSTEM = """你是图像理解与文本生成助手。
请严格遵循用户指令，基于输入图片完成任务。
只输出任务要求的内容，不要附加无关解释。"""


def setup_logger(log_file: str = "") -> logging.Logger:
    handlers = [logging.StreamHandler()]
    if log_file:
        Path(log_file).parent.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(log_file, encoding="utf-8"))
    logging.basicConfig(level=logging.INFO, format=LOG_FORMAT, handlers=handlers, force=True)
    return logging.getLogger("generate_model_outputs")


def load_models_config(path: Path) -> Dict[str, Any]:
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def enabled_models(cfg: Dict[str, Any], category: str, model_filter: str = "") -> List[Dict[str, Any]]:
    models = cfg.get("generation_models", {}).get(category, [])
    out = []
    for m in models:
        if not m.get("enabled", True):
            continue
        if model_filter and m.get("id") != model_filter:
            continue
        out.append(m)
    return out


def generate_text_output(provider: Any, model_cfg: Dict[str, Any], row: Dict[str, Any]) -> str:
    if isinstance(provider, GenerationProvider):
        return provider.generate_text_from_image(
            image_path=row["input_image_path"],
            instruction=row.get("instruction_prompt", ""),
            task_id=row.get("task_id", ""),
        )

    if isinstance(provider, OpenAICompatibleClient):
        import json
        user_text = json.dumps({
            "instruction": row.get("instruction_prompt", ""),
            "task_id": row.get("task_id"),
            "input_image_name": row.get("input_image_name"),
        }, ensure_ascii=False, indent=2)
        return provider.chat(
            system_prompt=TEXT_SYSTEM,
            user_text=user_text,
            image_paths=[row.get("input_image_path", "")],
            temperature=0.2,
            json_mode=False,
        )

    raise TypeError(f"unsupported text provider type: {type(provider)}")


def generate_image_output(
    provider: Any,
    model_cfg: Dict[str, Any],
    row: Dict[str, Any],
    output_path: Path,
) -> Dict[str, Any]:
    instruction = row.get("instruction_prompt", "")
    image_path = row.get("input_image_path", "")
    api_method = model_cfg.get("api_method", "auto")

    if isinstance(provider, GenerationProvider):
        return provider.generate_image_for_task(
            image_path=image_path,
            instruction=instruction,
            output_path=output_path,
            api_method=api_method,
            extra={
                "size": model_cfg.get("size"),
                "response_format": model_cfg.get("response_format"),
                "n": model_cfg.get("n", 1),
            },
        )

    if isinstance(provider, OpenAICompatibleClient):
        raise ValueError("openai_compatible provider does not support image generation; use jz_openai")

    raise TypeError(f"unsupported image provider type: {type(provider)}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="item_mapping.jsonl")
    ap.add_argument("--output", required=True, help="generation_outputs.jsonl")
    ap.add_argument("--models-config", default=str(project_path("config", "benchmark_models.yaml")))
    ap.add_argument("--output-dir", required=True, help="生成图片保存目录")
    ap.add_argument("--model", default="", help="只跑指定 generation_model_id")
    ap.add_argument("--task", default="", help="只跑指定 task_id")
    ap.add_argument("--skip-generate", action="store_true", help="跳过 API 调用，仅写 mapping 占位")
    ap.add_argument("--resume", action="store_true")
    ap.add_argument("--env-file", default=str(project_path(".env")))
    ap.add_argument("--log-file", default="")
    args = ap.parse_args()

    load_dotenv(args.env_file)
    logger = setup_logger(args.log_file)

    rows = read_jsonl(Path(args.input))
    cfg = load_models_config(Path(args.models_config))
    output_path = Path(args.output)
    gen_image_dir = Path(args.output_dir)
    gen_image_dir.mkdir(parents=True, exist_ok=True)

    if output_path.exists() and not args.resume:
        output_path.unlink()

    done = load_done_items(output_path) if args.resume else set()

    total = 0
    for row in rows:
        if args.task and row.get("task_id") != args.task:
            continue

        category = row.get("task_category")
        models = enabled_models(cfg, category, args.model)
        if not models:
            logger.warning("no enabled models for category=%s item=%s", category, row.get("item_id"))
            continue

        for model_cfg in models:
            model_id = model_cfg["id"]
            gen_item_id = f"{row['item_id']}__{model_id}"
            if gen_item_id in done:
                logger.info("skip done %s", gen_item_id)
                continue

            result = dict(row)
            result["generation_model_id"] = model_id
            result["gen_item_id"] = gen_item_id
            result["status"] = "pending"
            result["api_provider"] = model_cfg.get("provider", "")
            result["api_method"] = model_cfg.get("api_method", "")

            try:
                if args.skip_generate:
                    result["status"] = "skipped_generate"
                    result["output_text"] = row.get("output_text", "")
                    result["output_image_path"] = row.get("output_image_path", "")
                elif category == "text_model":
                    provider = create_provider(cfg, model_cfg)
                    text = generate_text_output(provider, model_cfg, row)
                    result["output_text"] = text
                    result["status"] = "ok"
                elif category == "image_model":
                    provider = create_provider(cfg, model_cfg)
                    out_img = gen_image_dir / f"{gen_item_id}.png"
                    api_meta = generate_image_output(provider, model_cfg, row, out_img)
                    result["output_image_path"] = str(out_img.resolve())
                    result["api_meta"] = api_meta
                    result["status"] = "ok"
                else:
                    raise ValueError(f"unknown task_category: {category}")

            except Exception as exc:
                logger.exception("failed %s", gen_item_id)
                result["status"] = "failed"
                result["error"] = str(exc)

            append_jsonl(output_path, result)
            total += 1
            logger.info("generated %s status=%s", gen_item_id, result["status"])

    logger.info("done total=%d output=%s", total, output_path)


if __name__ == "__main__":
    main()

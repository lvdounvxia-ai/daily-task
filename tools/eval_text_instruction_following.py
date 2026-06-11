#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
场景1评测：图片 + 指令 → 文本
评测维度：instruction_following / image_grounding / output_quality
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional

import yaml

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from project_paths import project_path
from src.common.env import load_dotenv
from src.common.io import append_jsonl, load_done_items, read_jsonl
from src.common.llm_client import OpenAICompatibleClient, clamp_score

LOG_FORMAT = "%(asctime)s [%(levelname)s] %(message)s"

JUDGE_SYSTEM = """你是严格的图文指令遵循评测专家。

你将收到：
1. instruction_prompt：任务指令
2. output_text：模型输出文本
3. 一张输入图片

请评估模型输出是否遵循指令，以及内容是否 grounded 于图片。

评分 0-100。只返回 JSON：
{
  "instruction_following": number,
  "image_grounding": number,
  "output_quality": number,
  "sub_scores": {
    "task_completion": number,
    "format_compliance": number,
    "fact_accuracy": number,
    "hallucination_penalty": number,
    "completeness": number,
    "readability": number
  },
  "failure_reasons": ["string"],
  "diagnosis": "string"
}

硬性规则：
- 输出明显未按指令格式/任务要求，instruction_following 不得超过 60
- 描述与图片明显不符，image_grounding 不得超过 55
- 凭空编造图片不存在的内容，fact_accuracy 必须低于 50
"""


def setup_logger(log_file: str = "") -> logging.Logger:
    handlers = [logging.StreamHandler()]
    if log_file:
        Path(log_file).parent.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(log_file, encoding="utf-8"))
    logging.basicConfig(level=logging.INFO, format=LOG_FORMAT, handlers=handlers, force=True)
    return logging.getLogger("eval_text_instruction")


def final_score(vlm: Dict[str, Any], weights: Dict[str, float]) -> Optional[float]:
    parts = []
    for k, w in weights.items():
        v = clamp_score(vlm.get(k))
        if v is not None:
            parts.append(v * w)
    if not parts:
        return None
    return round(sum(parts), 4)


def resolve_judge_client(cfg: Dict[str, Any]) -> OpenAICompatibleClient:
    judge = cfg.get("judge_models", {}).get("vlm", {})
    api_base = os.getenv(judge.get("api_base_env", "OPENAI_BASE_URL"), "")
    api_key = os.getenv(judge.get("api_key_env", "OPENAI_API_KEY"), "")
    model = os.getenv(judge.get("model_env", "OPENAI_VLM_MODEL"), judge.get("default_model", "gpt-4o"))

    if not api_base or not api_key:
        raise ValueError("Judge VLM API config missing")

    return OpenAICompatibleClient(api_base=api_base, api_key=api_key, model=model)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, help="generation_outputs.jsonl")
    ap.add_argument("--output", required=True)
    ap.add_argument("--models-config", default=str(project_path("config", "benchmark_models.yaml")))
    ap.add_argument("--resume", action="store_true")
    ap.add_argument("--env-file", default=str(project_path(".env")))
    ap.add_argument("--log-file", default="")
    args = ap.parse_args()

    load_dotenv(args.env_file)
    logger = setup_logger(args.log_file)

    cfg = yaml.safe_load(Path(args.models_config).read_text(encoding="utf-8"))
    weights = cfg.get("default_weights", {}).get("s1_text_output", {
        "instruction_following": 0.45,
        "image_grounding": 0.40,
        "output_quality": 0.15,
    })

    client = resolve_judge_client(cfg)
    rows = read_jsonl(Path(args.input))
    output_path = Path(args.output)

    if output_path.exists() and not args.resume:
        output_path.unlink()
    done = load_done_items(output_path, key="gen_item_id") if args.resume else set()

    for row in rows:
        if row.get("task_category") != "text_model":
            continue

        gen_item_id = row.get("gen_item_id") or row.get("item_id")
        if gen_item_id in done:
            continue

        output_text = (row.get("output_text") or "").strip()
        if not output_text or row.get("status") not in {"ok", "skipped_generate"}:
            append_jsonl(output_path, {
                "gen_item_id": gen_item_id,
                "item_id": row.get("item_id"),
                "generation_model_id": row.get("generation_model_id"),
                "metric_name": "text_instruction_following",
                "status": "missing_output",
                "score": None,
            })
            continue

        user_text = json.dumps({
            "instruction_prompt": row.get("instruction_prompt", ""),
            "output_text": output_text,
            "task_id": row.get("task_id"),
        }, ensure_ascii=False, indent=2)

        try:
            vlm = client.chat_json(
                system_prompt=JUDGE_SYSTEM,
                user_text=user_text,
                image_paths=[row.get("input_image_path", "")],
            )
            score = final_score(vlm, weights)
            result = {
                "gen_item_id": gen_item_id,
                "item_id": row.get("item_id"),
                "generation_model_id": row.get("generation_model_id"),
                "task_id": row.get("task_id"),
                "metric_name": "text_instruction_following",
                "status": "ok",
                "score": score,
                "sub_scores": {
                    "instruction_following": clamp_score(vlm.get("instruction_following")),
                    "image_grounding": clamp_score(vlm.get("image_grounding")),
                    "output_quality": clamp_score(vlm.get("output_quality")),
                },
                "vlm_result": vlm,
                "weights": weights,
            }
        except Exception as exc:
            logger.exception("eval failed %s", gen_item_id)
            result = {
                "gen_item_id": gen_item_id,
                "metric_name": "text_instruction_following",
                "status": "failed",
                "score": None,
                "error": str(exc),
            }

        append_jsonl(output_path, result)
        logger.info("evaluated %s score=%s", gen_item_id, result.get("score"))

    logger.info("done output=%s", output_path)


if __name__ == "__main__":
    main()

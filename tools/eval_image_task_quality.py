#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
场景2评测：图片 + 指令 → 图片
按任务类型评测：高清 / 抠图 / 扩图
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import yaml
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from project_paths import project_path
from src.common.env import load_dotenv
from src.common.io import append_jsonl, load_done_items, read_jsonl
from src.common.llm_client import OpenAICompatibleClient, clamp_score

LOG_FORMAT = "%(asctime)s [%(levelname)s] %(message)s"

JUDGE_SYSTEM = """你是严格的图像编辑任务评测专家。

你将收到任务指令、原图、输出图，请评估输出是否完成任务。

只返回 JSON：
{
  "task_compliance": number,
  "image_quality": number,
  "source_preservation": number,
  "failure_reasons": ["string"],
  "diagnosis": "string"
}
"""


def setup_logger(log_file: str = "") -> logging.Logger:
    handlers = [logging.StreamHandler()]
    if log_file:
        Path(log_file).parent.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(log_file, encoding="utf-8"))
    logging.basicConfig(level=logging.INFO, format=LOG_FORMAT, handlers=handlers, force=True)
    return logging.getLogger("eval_image_task_quality")


def image_metrics(path: str) -> Dict[str, Any]:
    p = Path(path)
    if not p.exists() or p.stat().st_size <= 0:
        return {"exists": False}

    with Image.open(p) as img:
        w, h = img.size
        mode = img.mode
        has_alpha = mode in ("RGBA", "LA") or (mode == "P" and "transparency" in img.info)
        alpha_ratio = None
        if has_alpha and mode == "RGBA":
            alpha = img.split()[-1]
            pixels = alpha.size[0] * alpha.size[1]
            transparent = sum(1 for v in alpha.getdata() if v < 10)
            alpha_ratio = round(transparent / max(pixels, 1), 4)

    long_side = max(w, h)
    return {
        "exists": True,
        "width": w,
        "height": h,
        "long_side": long_side,
        "mode": mode,
        "has_alpha": has_alpha,
        "alpha_ratio": alpha_ratio,
        "is_4k": long_side >= 3840,
    }


def rule_task_compliance(task_id: str, src: Dict[str, Any], out: Dict[str, Any], expected: Dict[str, Any]) -> float:
    if not out.get("exists"):
        return 0.0

    if task_id == "image_hd_4k":
        return 100.0 if out.get("is_4k") else max(30.0, min(90.0, out.get("long_side", 0) / 38.4))

    if task_id == "image_matting":
        if out.get("has_alpha") and (out.get("alpha_ratio") or 0) > 0.05:
            return 85.0
        return 20.0

    if task_id == "image_outpaint_1_5x":
        sw, sh = src.get("width", 1), src.get("height", 1)
        ow, oh = out.get("width", 1), out.get("height", 1)
        ratio_w = ow / sw
        ratio_h = oh / sh
        target = float(expected.get("scale", 1.5))
        err = abs(ratio_w - target) + abs(ratio_h - target)
        return max(0.0, 100.0 - err * 40)

    if task_id == "image_outpaint_9_16_2x":
        ow, oh = out.get("width", 1), out.get("height", 1)
        actual = ow / max(oh, 1)
        target = 9 / 16
        aspect_score = max(0.0, 100.0 - abs(actual - target) / target * 200)
        sw, sh = src.get("width", 1), src.get("height", 1)
        scale_score = max(0.0, 100.0 - abs(ow / sw - 2.0) * 30)
        return round(0.6 * aspect_score + 0.4 * scale_score, 4)

    return 50.0


def resolve_judge_client(cfg: Dict[str, Any]) -> OpenAICompatibleClient:
    judge = cfg.get("judge_models", {}).get("vlm", {})
    api_base = os.getenv(judge.get("api_base_env", "OPENAI_BASE_URL"), "")
    api_key = os.getenv(judge.get("api_key_env", "OPENAI_API_KEY"), "")
    model = os.getenv(judge.get("model_env", "OPENAI_VLM_MODEL"), judge.get("default_model", "gpt-4o"))
    return OpenAICompatibleClient(api_base=api_base, api_key=api_key, model=model)


def final_score(vlm: Dict[str, Any], rule_score: float, weights: Dict[str, float]) -> float:
    tc = clamp_score(vlm.get("task_compliance")) or rule_score
    iq = clamp_score(vlm.get("image_quality")) or 50.0
    sp = clamp_score(vlm.get("source_preservation")) or 50.0
    return round(
        weights.get("task_compliance", 0.55) * tc
        + weights.get("image_quality", 0.25) * iq
        + weights.get("source_preservation", 0.20) * sp,
        4,
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--output", required=True)
    ap.add_argument("--models-config", default=str(project_path("config", "benchmark_models.yaml")))
    ap.add_argument("--resume", action="store_true")
    ap.add_argument("--skip-vlm", action="store_true", help="仅用规则分，不调 Judge VLM")
    ap.add_argument("--env-file", default=str(project_path(".env")))
    ap.add_argument("--log-file", default="")
    args = ap.parse_args()

    load_dotenv(args.env_file)
    logger = setup_logger(args.log_file)

    cfg = yaml.safe_load(Path(args.models_config).read_text(encoding="utf-8"))
    weights = cfg.get("default_weights", {}).get("s2_image_output", {})
    client = None if args.skip_vlm else resolve_judge_client(cfg)

    rows = read_jsonl(Path(args.input))
    output_path = Path(args.output)
    if output_path.exists() and not args.resume:
        output_path.unlink()
    done = load_done_items(output_path, key="gen_item_id") if args.resume else set()

    for row in rows:
        if row.get("task_category") != "image_model":
            continue

        gen_item_id = row.get("gen_item_id") or row.get("item_id")
        if gen_item_id in done:
            continue

        src_path = row.get("input_image_path", "")
        out_path = row.get("output_image_path", "")
        src_m = image_metrics(src_path)
        out_m = image_metrics(out_path)

        rule_score = rule_task_compliance(
            row.get("task_id", ""),
            src_m,
            out_m,
            row.get("expected") or {},
        )

        if not out_m.get("exists"):
            append_jsonl(output_path, {
                "gen_item_id": gen_item_id,
                "metric_name": "image_task_quality",
                "status": "missing_output",
                "score": None,
                "rule_task_compliance": rule_score,
            })
            continue

        vlm = {}
        if client is not None:
            user_text = json.dumps({
                "task_id": row.get("task_id"),
                "instruction_prompt": row.get("instruction_prompt", ""),
                "source_metrics": src_m,
                "output_metrics": out_m,
            }, ensure_ascii=False, indent=2)
            try:
                vlm = client.chat_json(
                    system_prompt=JUDGE_SYSTEM,
                    user_text=user_text,
                    image_paths=[src_path, out_path],
                )
            except Exception as exc:
                logger.warning("VLM judge failed %s: %s", gen_item_id, exc)

        score = final_score(vlm, rule_score, weights)
        append_jsonl(output_path, {
            "gen_item_id": gen_item_id,
            "item_id": row.get("item_id"),
            "generation_model_id": row.get("generation_model_id"),
            "task_id": row.get("task_id"),
            "metric_name": "image_task_quality",
            "status": "ok",
            "score": score,
            "rule_task_compliance": rule_score,
            "source_metrics": src_m,
            "output_metrics": out_m,
            "vlm_result": vlm,
            "weights": weights,
        })
        logger.info("evaluated %s score=%s", gen_item_id, score)

    logger.info("done output=%s", output_path)


if __name__ == "__main__":
    main()

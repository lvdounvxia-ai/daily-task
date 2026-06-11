#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
从 data/test_images + config/tasks.yaml 构建评测 mapping。

每条样本 = 一张有效图片 × 一个任务 × 一个生成模型（在 generate 阶段展开）。
"""

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List

import yaml

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from project_paths import project_path

LOG_FORMAT = "%(asctime)s [%(levelname)s] %(message)s"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def setup_logger(log_file: str = "") -> logging.Logger:
    handlers = [logging.StreamHandler()]
    if log_file:
        Path(log_file).parent.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(log_file, encoding="utf-8"))
    logging.basicConfig(level=logging.INFO, format=LOG_FORMAT, handlers=handlers, force=True)
    return logging.getLogger("build_mapping")


def load_tasks(tasks_path: Path, task_filter: str = "") -> List[Dict[str, Any]]:
    data = yaml.safe_load(tasks_path.read_text(encoding="utf-8"))
    tasks = data.get("tasks") or []
    out = []
    for t in tasks:
        if not t.get("enabled", True):
            continue
        if task_filter and t.get("id") != task_filter:
            continue
        out.append(t)
    return out


def list_valid_images(image_dir: Path) -> List[Path]:
    images = []
    for p in sorted(image_dir.iterdir()):
        if not p.is_file():
            continue
        if p.suffix.lower() not in IMAGE_EXTS:
            continue
        if p.stat().st_size <= 0:
            continue
        images.append(p)
    return images


def build_rows(
    images: List[Path],
    tasks: List[Dict[str, Any]],
    image_dir: Path,
    prompt_dir: Path,
) -> List[Dict[str, Any]]:
    rows = []
    for img in images:
        for task in tasks:
            item_id = f"{img.stem}__{task['id']}"
            rows.append({
                "item_id": item_id,
                "scenario": task.get("scenario"),
                "task_id": task["id"],
                "task_name": task.get("name"),
                "task_category": task.get("category"),
                "input_image_path": str(img.resolve()),
                "input_image_name": img.name,
                "instruction_prompt": task.get("instruction", "").strip(),
                "expected": task.get("expected") or {},
                "image_dir": str(image_dir.resolve()),
                "prompt_dir": str(prompt_dir.resolve()),
                "output_text": "",
                "output_image_path": "",
                "generation_model_id": "",
                "status": "pending",
            })
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--image-dir", default=str(project_path("data", "test_images")))
    ap.add_argument("--prompt-dir", default=str(project_path("data", "prompt")))
    ap.add_argument("--tasks-config", default=str(project_path("config", "tasks.yaml")))
    ap.add_argument("--output", required=True)
    ap.add_argument("--task", default="", help="只构建指定 task_id")
    ap.add_argument("--limit-images", type=int, default=0)
    ap.add_argument("--log-file", default="")
    args = ap.parse_args()

    logger = setup_logger(args.log_file)

    image_dir = Path(args.image_dir)
    prompt_dir = Path(args.prompt_dir)
    tasks_path = Path(args.tasks_config)
    output_path = Path(args.output)

    if not image_dir.is_dir():
        raise FileNotFoundError(f"image_dir not found: {image_dir}")
    if not tasks_path.is_file():
        raise FileNotFoundError(f"tasks config not found: {tasks_path}")

    tasks = load_tasks(tasks_path, args.task)
    images = list_valid_images(image_dir)

    if args.limit_images > 0:
        images = images[:args.limit_images]

    rows = build_rows(images, tasks, image_dir, prompt_dir)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    logger.info(
        "built mapping: images=%d tasks=%d rows=%d output=%s",
        len(images), len(tasks), len(rows), output_path,
    )


if __name__ == "__main__":
    main()

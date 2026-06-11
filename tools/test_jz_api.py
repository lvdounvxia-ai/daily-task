#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
连通性测试：验证 JZ 平台 API 是否可用。

用法：
  export JZ_API_KEY=sk-xxx
  export JZ_API_BASE_URL=https://jzapi.duanju.com/v1
  python tools/test_jz_api.py --mode images_generate
  python tools/test_jz_api.py --mode images_edit --image data/test_images/image_5.jpg
  python tools/test_jz_api.py --mode chat_vision --image data/test_images/image_5.jpg
"""

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from project_paths import project_path
from src.common.env import load_dotenv
from src.providers.jz_openai_platform import JzOpenAIPlatformProvider


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["images_generate", "images_edit", "chat_vision"], default="images_generate")
    ap.add_argument("--image", default=str(project_path("data", "test_images", "image_5.jpg")))
    ap.add_argument("--prompt", default="一只穿着红色斗篷的羊驼，卡通风格")
    ap.add_argument("--model", default="gpt-image-2-all")
    ap.add_argument("--vision-model", default="gemini-2.5-flash")
    ap.add_argument("--output", default="outputs/_api_test/output.png")
    ap.add_argument("--env-file", default=str(project_path(".env")))
    args = ap.parse_args()
    load_dotenv(args.env_file)

    api_key = os.getenv("YUNWU_API_KEY") or os.getenv("JZ_API_KEY", "")
    base_url = os.getenv("YUNWU_API_BASE_URL") or os.getenv("JZ_API_BASE_URL", "https://yunwu.ai/v1")
    if not api_key:
        raise SystemExit("YUNWU_API_KEY / JZ_API_KEY is empty. Set in .env or environment.")

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)

    if args.mode == "chat_vision":
        provider = JzOpenAIPlatformProvider(api_key=api_key, base_url=base_url, model=args.vision_model)
        text = provider.generate_text_from_image(
            image_path=args.image,
            instruction="请用一句话描述这张图片的主体与场景。",
            task_id="api_test",
        )
        txt_out = out.with_suffix(".txt")
        txt_out.write_text(text, encoding="utf-8")
        print(f"chat_vision ok -> {txt_out}")
        print(text[:500])
        return

    provider = JzOpenAIPlatformProvider(api_key=api_key, base_url=base_url, model=args.model)
    if args.mode == "images_generate":
        meta = provider.generate_image_from_prompt(args.prompt, out)
    else:
        meta = provider.edit_image_from_prompt(args.image, args.prompt, out)

    print(f"{args.mode} ok -> {out}")
    print(meta)


if __name__ == "__main__":
    main()

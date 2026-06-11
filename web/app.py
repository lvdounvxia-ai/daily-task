#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import logging
import sys
import uuid
from pathlib import Path
from typing import List, Optional

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from project_paths import project_path
from web.model_registry import ModelRegistry
from web.service import WebEvalService

app = FastAPI(
    title="模型效果评测平台",
    description="文本 / 图片 / 视频生成模型评测 Web 服务",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

registry = ModelRegistry()
service = WebEvalService()

STATIC_DIR = project_path("web", "static")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/", response_class=HTMLResponse)
def index():
    html_path = STATIC_DIR / "index.html"
    return HTMLResponse(html_path.read_text(encoding="utf-8"))


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "image_text_model_eval"}


@app.get("/api/models")
def list_models(category: str = "text"):
    models = registry.list_models(category)
    return {"category": category, "models": models}


@app.get("/api/tasks")
def list_tasks(category: str = "text"):
    tasks = registry.list_tasks(category)
    return {"category": category, "tasks": tasks}


@app.post("/api/run")
async def run_eval(
    category: str = Form(...),
    model_id: str = Form(...),
    task_id: str = Form(...),
    instruction: str = Form(""),
    input_text: str = Form(""),
    run_eval: bool = Form(True),
    image: Optional[UploadFile] = File(None),
    text_file: Optional[UploadFile] = File(None),
):
    if category not in {"text", "image", "video"}:
        raise HTTPException(400, "invalid category")

    job_id = uuid.uuid4().hex[:12]
    job_dir = service.work_dir / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    image_path = None
    if image and image.filename:
        suffix = Path(image.filename).suffix or ".png"
        image_path = str(job_dir / f"input{suffix}")
        content = await image.read()
        Path(image_path).write_bytes(content)

    final_instruction = instruction
    final_text = input_text
    if text_file and text_file.filename:
        raw = await text_file.read()
        try:
            file_text = raw.decode("utf-8")
        except UnicodeDecodeError:
            file_text = raw.decode("gbk", errors="ignore")
        if not final_instruction:
            final_instruction = file_text
        else:
            final_text = file_text if not final_text else final_text

    try:
        result = service.run_job(
            category=category,
            model_id=model_id,
            task_id=task_id,
            instruction=final_instruction,
            input_text=final_text,
            image_path=image_path,
            run_eval=run_eval,
            job_id=job_id,
        )
        return result
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(500, f"run failed: {exc}") from exc


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    result = service.get_job(job_id)
    if not result:
        raise HTTPException(404, "job not found")
    return result


@app.get("/api/files/{job_id}/{filename}")
def get_file(job_id: str, filename: str):
    path = service.get_file_path(job_id, filename)
    if not path:
        raise HTTPException(404, "file not found")
    return FileResponse(path)


@app.post("/api/run_batch")
async def run_batch_eval(
    category: str = Form(...),
    model_id: str = Form(...),
    task_id: str = Form(...),
    default_instruction: str = Form(""),
    batch_prompts: str = Form(""),
    input_text: str = Form(""),
    run_eval: bool = Form(True),
    images: List[UploadFile] = File(...),
    prompt_files: List[UploadFile] = File(default=[]),
    prompt_file_indices: List[str] = Form(default=[]),
):
    if category not in {"text", "image", "video"}:
        raise HTTPException(400, "invalid category")
    if category == "video":
        raise HTTPException(400, "视频生成评测即将上线")

    batch_id = "batch_" + uuid.uuid4().hex[:12]
    batch_dir = service.work_dir / batch_id
    batch_dir.mkdir(parents=True, exist_ok=True)

    image_items = []
    for idx, image in enumerate(images):
        if not image.filename:
            continue
        suffix = Path(image.filename).suffix or ".png"
        safe_name = Path(image.filename).name
        image_path = str(batch_dir / f"input_{idx:03d}_{safe_name}")
        content = await image.read()
        Path(image_path).write_bytes(content)
        image_items.append({"name": safe_name, "path": image_path})

    if not image_items:
        raise HTTPException(400, "请至少上传一张有效图片")

    file_prompts = []
    for idx, pf in enumerate(prompt_files or []):
        if not pf.filename:
            continue
        raw = await pf.read()
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            text = raw.decode("gbk", errors="ignore")
        row_index = None
        if idx < len(prompt_file_indices):
            try:
                row_index = int(prompt_file_indices[idx])
            except (TypeError, ValueError):
                row_index = None
        file_prompts.append({
            "filename": pf.filename,
            "content": text,
            "row_index": row_index,
        })

    prompts = service.parse_batch_prompts(batch_prompts)
    prompt_file_map = service.parse_prompt_file_map(file_prompts)

    try:
        return service.run_batch(
            category=category,
            model_id=model_id,
            task_id=task_id,
            default_instruction=default_instruction,
            input_text=input_text,
            image_items=image_items,
            prompts=prompts,
            prompt_file_map=prompt_file_map,
            run_eval=run_eval,
            batch_id=batch_id,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(500, f"batch run failed: {exc}") from exc


@app.get("/api/batches/{batch_id}")
def get_batch(batch_id: str):
    path = service.work_dir / batch_id / "batch_result.json"
    if not path.exists():
        raise HTTPException(404, "batch not found")
    import json
    return json.loads(path.read_text(encoding="utf-8"))


@app.post("/api/reload-config")
def reload_config():
    registry.reload()
    return {"status": "ok"}


def main():
    import uvicorn
    uvicorn.run(
        "web.app:app",
        host="0.0.0.0",
        port=int(__import__("os").getenv("WEB_PORT", "8080")),
        reload=False,
    )


if __name__ == "__main__":
    main()

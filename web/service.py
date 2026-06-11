import json
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("web_eval_service")

from project_paths import project_path
from src.common.env import load_dotenv
from src.providers.base import GenerationProvider
from src.providers.factory import create_provider
from web.model_registry import ModelRegistry

CATEGORY_TO_KEY = {
    "text": "text_model",
    "image": "image_model",
}


class WebEvalService:
    def __init__(self, work_dir: Optional[Path] = None) -> None:
        load_dotenv(str(project_path(".env")))
        self.registry = ModelRegistry()
        self.work_dir = work_dir or project_path("outputs", "web_jobs")
        self.work_dir.mkdir(parents=True, exist_ok=True)

    def _job_dir(self, job_id: str) -> Path:
        p = self.work_dir / job_id
        p.mkdir(parents=True, exist_ok=True)
        return p

    def _find_model_cfg(self, category: str, model_id: str) -> Dict[str, Any]:
        cfg = self.registry.get_model(category, model_id)
        if not cfg:
            raise ValueError(f"model not found: {category}/{model_id}")
        return cfg

    def run_job(
        self,
        *,
        category: str,
        model_id: str,
        task_id: str,
        instruction: str,
        input_text: str = "",
        image_path: Optional[str] = None,
        run_eval: bool = True,
        job_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        if category == "video":
            raise ValueError("视频生成评测即将上线，敬请期待")

        job_id = job_id or (datetime.now().strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:8])
        job_dir = self._job_dir(job_id)

        task = self.registry.get_task(task_id)
        if not task:
            raise ValueError(f"task not found: {task_id}")

        model_cfg = self._find_model_cfg(category, model_id)
        final_instruction = instruction.strip() or (task.get("instruction") or "").strip()

        row = {
            "item_id": job_id,
            "gen_item_id": f"{job_id}__{model_id}",
            "task_id": task_id,
            "task_name": task.get("name"),
            "task_category": task.get("category"),
            "instruction_prompt": final_instruction,
            "input_text": input_text,
            "input_image_path": image_path or "",
            "generation_model_id": model_id,
        }

        cfg = self.registry.models_config_data
        provider = create_provider(cfg, model_cfg)
        result: Dict[str, Any] = {
            "job_id": job_id,
            "category": category,
            "model_id": model_id,
            "task_id": task_id,
            "status": "ok",
        }

        logger.info(
            "run_job start job_id=%s category=%s model=%s task=%s image=%s",
            job_id, category, model_id, task_id, image_path,
        )

        if category == "text":
            if not image_path:
                raise ValueError("文本生成任务需要上传参考图片")
            if isinstance(provider, GenerationProvider):
                output_text = provider.generate_text_from_image(
                    image_path=image_path,
                    instruction=final_instruction,
                    task_id=task_id,
                )
            else:
                from tools.generate_model_outputs import generate_text_output
                output_text = generate_text_output(provider, model_cfg, row)
            result["output_text"] = output_text
            (job_dir / "output.txt").write_text(output_text, encoding="utf-8")

        elif category == "image":
            out_path = job_dir / "output.png"
            if isinstance(provider, GenerationProvider):
                api_meta = provider.generate_image_for_task(
                    image_path=image_path or "",
                    instruction=final_instruction,
                    output_path=out_path,
                    api_method=model_cfg.get("api_method", "auto"),
                    extra={
                        "size": model_cfg.get("size"),
                        "response_format": model_cfg.get("response_format"),
                    },
                )
                result["api_meta"] = api_meta
            else:
                raise ValueError(f"unsupported image provider: {type(provider)}")
            result["output_image_url"] = f"/api/files/{job_id}/output.png"

        if run_eval:
            logger.info("run_job eval start job_id=%s", job_id)
            result["eval"] = self._run_eval(category, row, result)

        meta_path = job_dir / "result.json"
        meta_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        logger.info(
            "run_job done job_id=%s status=%s score=%s",
            job_id,
            result.get("status"),
            (result.get("eval") or {}).get("score"),
        )
        return result

    def _run_eval(self, category: str, row: Dict[str, Any], gen_result: Dict[str, Any]) -> Dict[str, Any]:
        job_dir = self._job_dir(gen_result["job_id"])
        cfg = self.registry.models_config_data

        if category == "text":
            row["output_text"] = gen_result.get("output_text", "")
            from src.common.llm_client import OpenAICompatibleClient, clamp_score
            import os

            judge = cfg.get("judge_models", {}).get("vlm", {})
            api_base = os.getenv(judge.get("api_base_env", "JZ_API_BASE_URL"), "")
            api_key = os.getenv(judge.get("api_key_env", "JZ_API_KEY"), "")
            model = os.getenv(judge.get("model_env", "JZ_JUDGE_VLM_MODEL"), judge.get("default_model", "gpt-4o"))
            client = OpenAICompatibleClient(api_base=api_base, api_key=api_key, model=model)

            from tools.eval_text_instruction_following import JUDGE_SYSTEM, final_score
            weights = cfg.get("default_weights", {}).get("s1_text_output", {})
            user_text = json.dumps({
                "instruction_prompt": row.get("instruction_prompt", ""),
                "output_text": row.get("output_text", ""),
                "task_id": row.get("task_id"),
            }, ensure_ascii=False, indent=2)
            vlm = client.chat_json(
                system_prompt=JUDGE_SYSTEM,
                user_text=user_text,
                image_paths=[row.get("input_image_path")] if row.get("input_image_path") else None,
            )
            return {
                "score": final_score(vlm, weights),
                "sub_scores": {
                    "instruction_following": clamp_score(vlm.get("instruction_following")),
                    "image_grounding": clamp_score(vlm.get("image_grounding")),
                    "output_quality": clamp_score(vlm.get("output_quality")),
                },
                "diagnosis": vlm.get("diagnosis", ""),
            }

        if category == "image":
            row["output_image_path"] = str(job_dir / "output.png")
            from tools.eval_image_task_quality import rule_task_compliance, final_score, image_metrics
            weights = cfg.get("default_weights", {}).get("s2_image_output", {})
            src_m = image_metrics(row.get("input_image_path", ""))
            out_m = image_metrics(row["output_image_path"])
            rule_score = rule_task_compliance(
                row.get("task_id", ""),
                src_m,
                out_m,
                {},
            )
            return {
                "score": final_score({}, rule_score, weights),
                "rule_task_compliance": rule_score,
                "source_metrics": src_m,
                "output_metrics": out_m,
            }

        return {}

    @staticmethod
    def parse_batch_prompts(
        batch_prompts: str,
    ) -> List[str]:
        """解析批量 Prompt 文本框内容。"""
        prompts: List[str] = []
        text = (batch_prompts or "").strip()
        if text:
            parts = [p.strip() for p in text.split("\n---\n") if p.strip()]
            prompts.extend(parts)
        return prompts

    @staticmethod
    def parse_prompt_file_map(
        prompt_files: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[int, str]:
        """解析上传文本文件，按批量行索引建立映射。"""
        prompt_map: Dict[int, str] = {}
        if not prompt_files:
            return prompt_map

        for item in prompt_files:
            row_index = item.get("row_index")
            content = (item.get("content") or "").strip()
            if row_index is None or row_index < 0 or not content:
                continue
            prompt_map[int(row_index)] = content
        return prompt_map

    @staticmethod
    def resolve_prompt_for_index(
        index: int,
        prompts: List[str],
        prompt_file_map: Optional[Dict[int, str]],
        default_instruction: str,
        task_instruction: str,
    ) -> str:
        if prompt_file_map and index in prompt_file_map and prompt_file_map[index]:
            return prompt_file_map[index]
        if index < len(prompts) and prompts[index]:
            return prompts[index]
        if default_instruction.strip():
            return default_instruction.strip()
        return (task_instruction or "").strip()

    def run_batch(
        self,
        *,
        category: str,
        model_id: str,
        task_id: str,
        default_instruction: str = "",
        input_text: str = "",
        image_items: List[Dict[str, Any]],
        prompts: Optional[List[str]] = None,
        prompt_file_map: Optional[Dict[int, str]] = None,
        run_eval: bool = True,
        batch_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not image_items:
            raise ValueError("请至少上传一张图片")

        batch_id = batch_id or ("batch_" + uuid.uuid4().hex[:12])
        batch_dir = self._job_dir(batch_id)
        task = self.registry.get_task(task_id)
        if not task:
            raise ValueError(f"task not found: {task_id}")

        prompt_list = prompts or []
        results: List[Dict[str, Any]] = []
        scores: List[float] = []

        logger.info(
            "run_batch start batch_id=%s total=%d model=%s task=%s",
            batch_id, len(image_items), model_id, task_id,
        )

        for idx, item in enumerate(image_items):
            image_path = item.get("path", "")
            image_name = item.get("name", f"image_{idx}")
            instruction = self.resolve_prompt_for_index(
                idx,
                prompt_list,
                prompt_file_map,
                default_instruction,
                task.get("instruction") or "",
            )
            job_id = f"{batch_id}_{idx:03d}"

            try:
                one = self.run_job(
                    category=category,
                    model_id=model_id,
                    task_id=task_id,
                    instruction=instruction,
                    input_text=input_text,
                    image_path=image_path,
                    run_eval=run_eval,
                    job_id=job_id,
                )
                one["batch_index"] = idx
                one["image_name"] = image_name
                one["instruction"] = instruction
                results.append(one)
                if one.get("eval", {}).get("score") is not None:
                    scores.append(float(one["eval"]["score"]))
            except Exception as exc:
                logger.exception("run_batch item failed batch=%s idx=%d", batch_id, idx)
                results.append({
                    "job_id": job_id,
                    "batch_index": idx,
                    "image_name": image_name,
                    "instruction": instruction,
                    "status": "failed",
                    "error": str(exc),
                })

        success = sum(1 for r in results if r.get("status") == "ok")
        failed = len(results) - success
        summary = {
            "total": len(results),
            "success": success,
            "failed": failed,
            "avg_score": round(sum(scores) / len(scores), 2) if scores else None,
        }

        payload = {
            "batch_id": batch_id,
            "category": category,
            "model_id": model_id,
            "task_id": task_id,
            "status": "ok" if failed == 0 else ("partial" if success else "failed"),
            "summary": summary,
            "results": results,
        }
        (batch_dir / "batch_result.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        logger.info("run_batch done batch_id=%s summary=%s", batch_id, summary)
        return payload

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        meta = self.work_dir / job_id / "result.json"
        if not meta.exists():
            return None
        return json.loads(meta.read_text(encoding="utf-8"))

    def get_file_path(self, job_id: str, filename: str) -> Optional[Path]:
        p = self.work_dir / job_id / filename
        if p.exists() and p.is_file():
            return p
        return None

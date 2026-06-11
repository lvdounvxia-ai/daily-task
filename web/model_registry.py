from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

from project_paths import project_path

CATEGORY_MAP = {
    "text": "text_model",
    "image": "image_model",
    "video": "video_model",
}


class ModelRegistry:
    def __init__(
        self,
        models_config: Optional[Path] = None,
        tasks_config: Optional[Path] = None,
    ) -> None:
        self.models_config = models_config or project_path("config", "benchmark_models.yaml")
        self.tasks_config = tasks_config or project_path("config", "tasks.yaml")
        self._models_cfg = self._load_yaml(self.models_config)
        self._tasks_cfg = self._load_yaml(self.tasks_config)

    @staticmethod
    def _load_yaml(path: Path) -> Dict[str, Any]:
        return yaml.safe_load(path.read_text(encoding="utf-8")) or {}

    def reload(self) -> None:
        self._models_cfg = self._load_yaml(self.models_config)
        self._tasks_cfg = self._load_yaml(self.tasks_config)

    def list_models(self, category: str) -> List[Dict[str, Any]]:
        key = CATEGORY_MAP.get(category, category)
        models = self._models_cfg.get("generation_models", {}).get(key, [])
        out = []
        for m in models:
            if not m.get("enabled", True):
                continue
            out.append({
                "id": m.get("id"),
                "display_name": m.get("display_name") or m.get("id"),
                "model": m.get("model"),
                "provider": m.get("provider"),
                "platform": m.get("platform", ""),
                "api_method": m.get("api_method", ""),
            })
        return out

    def get_model(self, category: str, model_id: str) -> Optional[Dict[str, Any]]:
        for m in self.list_models(category):
            if m["id"] == model_id:
                key = CATEGORY_MAP.get(category, category)
                for raw in self._models_cfg.get("generation_models", {}).get(key, []):
                    if raw.get("id") == model_id:
                        return raw
        return None

    def list_tasks(self, category: str) -> List[Dict[str, Any]]:
        key = CATEGORY_MAP.get(category, category)
        tasks = self._tasks_cfg.get("tasks") or []
        out = []
        for t in tasks:
            if not t.get("enabled", True):
                continue
            if t.get("category") != key:
                continue
            out.append({
                "id": t.get("id"),
                "name": t.get("name"),
                "instruction": (t.get("instruction") or "").strip(),
            })
        return out

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        for t in self._tasks_cfg.get("tasks") or []:
            if t.get("id") == task_id:
                return t
        return None

    @property
    def models_config_data(self) -> Dict[str, Any]:
        return self._models_cfg

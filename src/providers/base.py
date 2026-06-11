from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, Optional


class GenerationProvider(ABC):
    """生成模型 API 抽象接口，便于切换平台与调用方式。"""

    provider_id: str = "base"

    @abstractmethod
    def generate_text_from_image(
        self,
        image_path: str,
        instruction: str,
        *,
        task_id: str = "",
        extra: Optional[Dict[str, Any]] = None,
    ) -> str:
        """图片 + 指令 → 文本"""

    @abstractmethod
    def generate_image_from_prompt(
        self,
        prompt: str,
        output_path: Path,
        *,
        extra: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """纯文本提示词 → 图片（images.generate）"""

    @abstractmethod
    def edit_image_from_prompt(
        self,
        image_path: str,
        prompt: str,
        output_path: Path,
        *,
        extra: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """图片 + 指令 → 图片（images.edit，平台不支持时可由子类降级）"""

    def generate_image_for_task(
        self,
        image_path: str,
        instruction: str,
        output_path: Path,
        *,
        api_method: str = "auto",
        extra: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        统一图片任务入口。
        api_method: auto | images_edit | images_generate | http_multipart
        """
        method = api_method or "auto"
        if method == "auto":
            method = "images_edit" if image_path and Path(image_path).exists() else "images_generate"

        if method == "images_edit":
            return self.edit_image_from_prompt(image_path, instruction, output_path, extra=extra)
        if method == "images_generate":
            return self.generate_image_from_prompt(instruction, output_path, extra=extra)
        raise ValueError(f"unsupported api_method for image task: {method}")

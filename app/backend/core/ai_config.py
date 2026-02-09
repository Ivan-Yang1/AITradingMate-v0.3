"""
预配置的AI模型配置
存储系统内置的大模型API配置
"""

import os
from typing import Optional
from pydantic import BaseModel


class AIModelConfig(BaseModel):
    """AI模型配置"""
    id: str
    name: str
    description: str
    base_url: str
    api_key: Optional[str] = None
    model_name: str
    is_builtin: bool = True
    recommended: bool = False


# 预配置的AI模型
BUILTIN_AI_MODELS: dict[str, AIModelConfig] = {
    "deepseek-v3.2": AIModelConfig(
        id="deepseek-v3.2",
        name="DeepSeek V3.2",
        description="高性能通用模型，推理能力强，性价比高",
        base_url="https://api.deepseek.com/v1",
        api_key=os.environ.get("DEEPSEEK_API_KEY"),
        model_name="deepseek-chat",
        is_builtin=True,
        recommended=True,
    ),
    "kimi-k2": AIModelConfig(
        id="kimi-k2",
        name="Kimi K2",
        description="月之暗面最新模型，长文本处理优秀，推理能力强",
        base_url="https://api.moonshot.cn/v1",
        api_key=os.environ.get("KIMI_API_KEY"),
        model_name="moonshot-v1-128k",
        is_builtin=True,
        recommended=True,
    ),
}


def get_builtin_model(model_id: str) -> Optional[AIModelConfig]:
    """获取内置模型配置"""
    return BUILTIN_AI_MODELS.get(model_id)


def get_all_builtin_models() -> list[AIModelConfig]:
    """获取所有内置模型"""
    return list(BUILTIN_AI_MODELS.values())
"""
内置AI模型路由 - 提供预配置的大模型服务
支持SSE流式传输，包含思考过程和工具调用提示
实现逐字输出效果
"""

import logging
import json
import asyncio
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from core.database import get_db
from core.ai_config import get_builtin_model, get_all_builtin_models, AIModelConfig
from dependencies.auth import get_current_user, get_optional_user
from schemas.auth import UserResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/builtin-ai", tags=["builtin-ai"])

# 逐字输出的延迟时间（秒）- 调整为更明显的打字效果
CHAR_DELAY = 0.025  # 25ms per character，更明显的打字效果
BATCH_SIZE = 1  # 每次发送的字符数


class ModelInfo(BaseModel):
    """模型信息"""
    id: str
    name: str
    description: str
    is_builtin: bool
    recommended: bool


class ChatMessage(BaseModel):
    """聊天消息"""
    role: str
    content: str


class ChatRequest(BaseModel):
    """聊天请求"""
    model_id: str
    message: str
    history: Optional[List[ChatMessage]] = None
    system_prompt: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 2048
    stream: bool = True
    # 股票分析相关
    stock_code: Optional[str] = None
    stock_name: Optional[str] = None
    stock_context: Optional[str] = None  # 股票数据上下文
    analysis_type: Optional[str] = None  # technical, fundamental, sentiment, flow
    # 投资风格
    investment_style: Optional[str] = None  # value, technical, news, balanced
    # 逐字输出控制
    char_by_char: bool = True  # 是否逐字输出
    char_delay: Optional[float] = None  # 自定义字符延迟（毫秒）


class ChatResponse(BaseModel):
    """聊天响应"""
    success: bool
    content: str
    model: str
    error: Optional[str] = None


# 投资风格配置
INVESTMENT_STYLES = {
    "value": {
        "name": "长线价值投资",
        "description": "关注企业基本面、财务健康、长期增长潜力",
        "focus": ["PE/PB估值", "ROE/ROA", "营收利润增长", "行业地位", "护城河", "分红派息"],
        "time_horizon": "中长期（1年以上）",
        "risk_preference": "稳健",
    },
    "technical": {
        "name": "短线技术分析",
        "description": "关注K线形态、技术指标、量价关系",
        "focus": ["K线形态", "MACD/KDJ/RSI", "均线系统", "支撑压力位", "成交量", "筹码分布"],
        "time_horizon": "短期（日内至数周）",
        "risk_preference": "激进",
    },
    "news": {
        "name": "消息面新闻投资",
        "description": "关注政策动向、行业新闻、市场情绪",
        "focus": ["政策利好/利空", "行业新闻", "公司公告", "机构动向", "北向资金", "市场热点"],
        "time_horizon": "事件驱动",
        "risk_preference": "机会型",
    },
    "balanced": {
        "name": "综合分析",
        "description": "结合技术面、基本面和消息面综合分析",
        "focus": ["技术指标", "基本面数据", "消息面动态", "资金流向"],
        "time_horizon": "灵活",
        "risk_preference": "平衡",
    },
}


@router.get("/models", response_model=list[ModelInfo])
async def list_builtin_models():
    """获取所有可用的内置AI模型"""
    models = get_all_builtin_models()
    return [
        ModelInfo(
            id=m.id,
            name=m.name,
            description=m.description,
            is_builtin=m.is_builtin,
            recommended=m.recommended,
        )
        for m in models
    ]


@router.get("/investment-styles")
async def get_investment_styles():
    """获取所有投资风格配置"""
    return INVESTMENT_STYLES


@router.post("/chat", response_model=ChatResponse)
async def builtin_chat(
    request: ChatRequest,
    current_user: Optional[UserResponse] = Depends(get_optional_user),
):
    """使用内置AI模型进行对话（非流式）"""
    model_config = get_builtin_model(request.model_id)
    if not model_config:
        raise HTTPException(status_code=400, detail=f"未找到模型: {request.model_id}")
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            headers = {
                "Authorization": f"Bearer {model_config.api_key}",
                "Content-Type": "application/json"
            }
            
            # 构建消息
            messages = []
            
            # 系统提示词（根据投资风格定制）
            system_content = request.system_prompt or _get_styled_system_prompt(request)
            if system_content:
                messages.append({"role": "system", "content": system_content})
            
            # 添加历史消息
            if request.history:
                for msg in request.history:
                    messages.append({"role": msg.role, "content": msg.content})
            
            messages.append({"role": "user", "content": request.message})
            
            chat_payload = {
                "model": model_config.model_name,
                "messages": messages,
                "max_tokens": request.max_tokens,
                "temperature": request.temperature,
                "stream": False
            }
            
            response = await client.post(
                f"{model_config.base_url}/chat/completions",
                headers=headers,
                json=chat_payload
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                return ChatResponse(
                    success=True,
                    content=content,
                    model=model_config.name
                )
            else:
                error_msg = response.text[:500]
                logger.error(f"Builtin AI chat failed: {error_msg}")
                return ChatResponse(
                    success=False,
                    content="",
                    model=model_config.name,
                    error=f"API调用失败: {response.status_code}"
                )
                
    except httpx.TimeoutException:
        return ChatResponse(
            success=False,
            content="",
            model=model_config.name,
            error="请求超时，请稍后重试"
        )
    except Exception as e:
        logger.error(f"Builtin AI chat error: {e}")
        return ChatResponse(
            success=False,
            content="",
            model=model_config.name,
            error=str(e)
        )


@router.post("/chat/stream")
async def builtin_chat_stream(
    request: ChatRequest,
    current_user: Optional[UserResponse] = Depends(get_optional_user),
):
    """使用内置AI模型进行流式对话，支持思考过程和工具调用提示，逐字输出"""
    model_config = get_builtin_model(request.model_id)
    if not model_config:
        raise HTTPException(status_code=400, detail=f"未找到模型: {request.model_id}")
    
    char_by_char = request.char_by_char
    # 支持自定义延迟，默认25ms，确保打字效果明显
    char_delay = (request.char_delay / 1000) if request.char_delay else CHAR_DELAY
    
    async def generate():
        try:
            # 1. 发送思考开始事件
            thinking_msg = _get_thinking_message(request)
            yield "data: " + json.dumps({"type": "thinking", "content": thinking_msg}, ensure_ascii=False) + "\n\n"
            await asyncio.sleep(0.1)
            
            # 2. 如果有股票代码，发送数据获取事件
            if request.stock_code:
                stock_display = request.stock_name or request.stock_code
                tool_msg = "正在获取 " + stock_display + " 的市场数据..."
                yield "data: " + json.dumps({"type": "tool_call", "tool": "fetch_stock_data", "content": tool_msg}, ensure_ascii=False) + "\n\n"
                await asyncio.sleep(0.3)
                yield "data: " + json.dumps({"type": "tool_result", "tool": "fetch_stock_data", "content": "数据获取完成"}, ensure_ascii=False) + "\n\n"
                await asyncio.sleep(0.1)
            
            # 3. 根据投资风格发送分析类型提示
            style = request.investment_style or "balanced"
            style_info = INVESTMENT_STYLES.get(style, INVESTMENT_STYLES["balanced"])
            style_name = style_info["name"]
            focus_list = style_info["focus"][:3]
            focus_str = ", ".join(focus_list)
            analysis_msg = "启用" + style_name + "模式，关注: " + focus_str + "..."
            yield "data: " + json.dumps({"type": "tool_call", "tool": "analysis_mode", "content": analysis_msg}, ensure_ascii=False) + "\n\n"
            await asyncio.sleep(0.2)
            
            # 4. 开始AI响应
            yield "data: " + json.dumps({"type": "thinking_end", "content": "分析完成，正在生成回答..."}, ensure_ascii=False) + "\n\n"
            await asyncio.sleep(0.1)
            
            async with httpx.AsyncClient(timeout=120.0) as client:
                headers = {
                    "Authorization": f"Bearer {model_config.api_key}",
                    "Content-Type": "application/json"
                }
                
                # 构建消息
                messages = []
                
                # 系统提示词（根据投资风格定制）
                system_content = request.system_prompt or _get_styled_system_prompt(request)
                if system_content:
                    messages.append({"role": "system", "content": system_content})
                
                # 添加历史消息
                if request.history:
                    for msg in request.history:
                        messages.append({"role": msg.role, "content": msg.content})
                
                messages.append({"role": "user", "content": request.message})
                
                chat_payload = {
                    "model": model_config.model_name,
                    "messages": messages,
                    "max_tokens": request.max_tokens,
                    "temperature": request.temperature,
                    "stream": True
                }
                
                async with client.stream(
                    "POST",
                    f"{model_config.base_url}/chat/completions",
                    headers=headers,
                    json=chat_payload
                ) as response:
                    if response.status_code != 200:
                        error_text = await response.aread()
                        error_content = error_text.decode()[:500]
                        yield "data: " + json.dumps({"type": "error", "content": error_content}, ensure_ascii=False) + "\n\n"
                        return
                    
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data = line[6:]
                            if data.strip() == "[DONE]":
                                yield "data: " + json.dumps({"type": "done"}, ensure_ascii=False) + "\n\n"
                                break
                            try:
                                chunk = json.loads(data)
                                content = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                                if content:
                                    if char_by_char:
                                        # 逐字符输出 - 每个字符单独发送
                                        for char in content:
                                            yield "data: " + json.dumps({"type": "content", "content": char}, ensure_ascii=False) + "\n\n"
                                            await asyncio.sleep(char_delay)
                                    else:
                                        # 按chunk输出
                                        yield "data: " + json.dumps({"type": "content", "content": content}, ensure_ascii=False) + "\n\n"
                            except json.JSONDecodeError:
                                continue
                                
        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield "data: " + json.dumps({"type": "error", "content": str(e)}, ensure_ascii=False) + "\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Content-Type": "text/event-stream; charset=utf-8",
        }
    )


@router.post("/analyze-stock")
async def analyze_stock(
    request: ChatRequest,
    current_user: Optional[UserResponse] = Depends(get_optional_user),
):
    """使用内置AI模型分析股票（流式响应，逐字输出）"""
    if not request.stock_code:
        raise HTTPException(status_code=400, detail="请提供股票代码")
    
    model_config = get_builtin_model(request.model_id)
    if not model_config:
        raise HTTPException(status_code=400, detail=f"未找到模型: {request.model_id}")
    
    char_by_char = request.char_by_char
    char_delay = (request.char_delay / 1000) if request.char_delay else CHAR_DELAY
    
    # 构建股票分析提示词
    analysis_prompt = _build_stock_analysis_prompt(
        stock_code=request.stock_code,
        stock_name=request.stock_name or request.stock_code,
        stock_context=request.stock_context,
        analysis_type=request.analysis_type,
        investment_style=request.investment_style,
        user_message=request.message
    )
    
    async def generate():
        try:
            # 发送分析开始事件
            style = request.investment_style or "balanced"
            style_info = INVESTMENT_STYLES.get(style, INVESTMENT_STYLES["balanced"])
            style_name = style_info["name"]
            stock_display = request.stock_name or request.stock_code
            
            thinking_msg = "正在以" + style_name + "视角分析 " + stock_display + "..."
            yield "data: " + json.dumps({"type": "thinking", "content": thinking_msg}, ensure_ascii=False) + "\n\n"
            await asyncio.sleep(0.2)
            
            # 工具调用提示
            yield "data: " + json.dumps({"type": "tool_call", "tool": "technical_analysis", "content": "计算技术指标（MA/MACD/RSI/KDJ）..."}, ensure_ascii=False) + "\n\n"
            await asyncio.sleep(0.3)
            
            if style in ["value", "balanced"]:
                yield "data: " + json.dumps({"type": "tool_call", "tool": "fundamental_analysis", "content": "分析基本面数据（PE/PB/ROE）..."}, ensure_ascii=False) + "\n\n"
                await asyncio.sleep(0.2)
            
            if style in ["news", "balanced"]:
                yield "data: " + json.dumps({"type": "tool_call", "tool": "news_analysis", "content": "扫描相关新闻和公告..."}, ensure_ascii=False) + "\n\n"
                await asyncio.sleep(0.2)
            
            yield "data: " + json.dumps({"type": "thinking_end", "content": "数据分析完成，生成报告..."}, ensure_ascii=False) + "\n\n"
            await asyncio.sleep(0.1)
            
            async with httpx.AsyncClient(timeout=120.0) as client:
                headers = {
                    "Authorization": f"Bearer {model_config.api_key}",
                    "Content-Type": "application/json"
                }
                
                messages = [
                    {"role": "system", "content": _get_stock_analysis_system_prompt(request.investment_style)},
                    {"role": "user", "content": analysis_prompt}
                ]
                
                chat_payload = {
                    "model": model_config.model_name,
                    "messages": messages,
                    "max_tokens": request.max_tokens,
                    "temperature": request.temperature,
                    "stream": True
                }
                
                async with client.stream(
                    "POST",
                    f"{model_config.base_url}/chat/completions",
                    headers=headers,
                    json=chat_payload
                ) as response:
                    if response.status_code != 200:
                        error_text = await response.aread()
                        error_content = error_text.decode()[:500]
                        yield "data: " + json.dumps({"type": "error", "content": error_content}, ensure_ascii=False) + "\n\n"
                        return
                    
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data = line[6:]
                            if data.strip() == "[DONE]":
                                yield "data: " + json.dumps({"type": "done"}, ensure_ascii=False) + "\n\n"
                                break
                            try:
                                chunk = json.loads(data)
                                content = chunk.get("choices", [{}])[0].get("delta", {}).get("content", "")
                                if content:
                                    if char_by_char:
                                        # 逐字符输出
                                        for char in content:
                                            yield "data: " + json.dumps({"type": "content", "content": char}, ensure_ascii=False) + "\n\n"
                                            await asyncio.sleep(char_delay)
                                    else:
                                        # 按chunk输出
                                        yield "data: " + json.dumps({"type": "content", "content": content}, ensure_ascii=False) + "\n\n"
                            except json.JSONDecodeError:
                                continue
                                
        except Exception as e:
            logger.error(f"Stock analysis stream error: {e}")
            yield "data: " + json.dumps({"type": "error", "content": str(e)}, ensure_ascii=False) + "\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Content-Type": "text/event-stream; charset=utf-8",
        }
    )


def _get_thinking_message(request: ChatRequest) -> str:
    """获取思考提示消息"""
    if request.stock_code:
        stock_display = request.stock_name or request.stock_code
        return "正在分析 " + stock_display + " 的相关问题..."
    return "正在思考您的问题..."


def _get_styled_system_prompt(request: ChatRequest) -> str:
    """根据投资风格获取系统提示词"""
    style = request.investment_style or "balanced"
    style_info = INVESTMENT_STYLES.get(style, INVESTMENT_STYLES["balanced"])
    
    focus_str = ", ".join(style_info["focus"])
    
    base_prompt = """你是一位专业的A股市场分析师助手，名叫"小金"。

当前分析模式：""" + style_info["name"] + """
分析特点：""" + style_info["description"] + """
重点关注：""" + focus_str + """
投资周期：""" + style_info["time_horizon"] + """
风险偏好：""" + style_info["risk_preference"] + """

"""
    
    if style == "value":
        base_prompt += """作为价值投资分析师，你应该：
1. 重点关注企业的内在价值和长期增长潜力
2. 分析财务报表，关注ROE、净利润增长、现金流等指标
3. 评估行业地位和竞争优势（护城河）
4. 考虑估值水平（PE、PB）是否合理
5. 关注分红派息历史和股东回报
6. 给出中长期投资建议，强调安全边际

"""
    elif style == "technical":
        base_prompt += """作为技术分析师，你应该：
1. 重点分析K线形态和技术指标
2. 识别支撑位、压力位和趋势线
3. 解读MACD、KDJ、RSI等指标信号
4. 分析成交量和量价关系
5. 关注均线系统的多空排列
6. 给出短期操作建议和止损止盈位

"""
    elif style == "news":
        base_prompt += """作为消息面分析师，你应该：
1. 关注最新的政策动向和行业新闻
2. 分析公司公告和重大事件影响
3. 跟踪机构动向和北向资金流向
4. 评估市场情绪和热点板块
5. 识别潜在的利好利空因素
6. 给出基于消息面的操作建议

"""
    else:  # balanced
        base_prompt += """作为综合分析师，你应该：
1. 结合技术面、基本面和消息面进行全方位分析
2. 平衡短期机会和长期价值
3. 综合考虑各类指标和信息
4. 给出风险收益比合理的建议

"""
    
    base_prompt += """请注意：
- 所有分析仅供参考，不构成投资建议
- 股市有风险，投资需谨慎
- 请用中文回答，保持专业性
- 回答要有条理，使用适当的格式"""
    
    # 添加股票上下文
    if request.stock_context:
        base_prompt += "\n\n当前股票数据：\n" + request.stock_context
    
    return base_prompt


def _get_stock_analysis_system_prompt(investment_style: Optional[str] = None) -> str:
    """获取股票分析系统提示词"""
    style = investment_style or "balanced"
    style_info = INVESTMENT_STYLES.get(style, INVESTMENT_STYLES["balanced"])
    
    focus_str = ", ".join(style_info["focus"])
    
    return """你是一位专业的A股市场分析师，采用""" + style_info["name"] + """策略。

分析特点：""" + style_info["description"] + """
重点关注：""" + focus_str + """
投资周期：""" + style_info["time_horizon"] + """

你的分析应该：
1. 客观、专业、有数据支撑
2. 符合""" + style_info["name"] + """的分析框架
3. 给出明确的风险提示
4. 使用清晰的格式和结构

请注意：
- 所有分析仅供参考，不构成投资建议
- 股市有风险，投资需谨慎
- 请用中文回答，保持专业性"""


def _build_stock_analysis_prompt(
    stock_code: str,
    stock_name: str,
    stock_context: Optional[str],
    analysis_type: Optional[str],
    investment_style: Optional[str],
    user_message: str
) -> str:
    """构建股票分析提示词"""
    style = investment_style or "balanced"
    style_info = INVESTMENT_STYLES.get(style, INVESTMENT_STYLES["balanced"])
    
    analysis_focus = ""
    if analysis_type:
        focus_map = {
            "technical": "技术面分析（K线形态、技术指标、支撑压力位等）",
            "fundamental": "基本面分析（财务数据、估值水平、行业地位等）",
            "sentiment": "市场情绪分析（消息面、热度、投资者情绪等）",
            "flow": "资金流向分析（主力资金、北向资金、融资融券等）",
        }
        analysis_focus = focus_map.get(analysis_type, "")
    
    focus_str = ", ".join(style_info["focus"])
    focus_0 = style_info["focus"][0] if len(style_info["focus"]) > 0 else "技术"
    focus_1 = style_info["focus"][1] if len(style_info["focus"]) > 1 else "趋势"
    
    prompt = "请以" + style_info["name"] + "的视角分析股票 " + stock_name + "（" + stock_code + "）。\n\n"
    
    if analysis_focus:
        prompt += "分析重点：" + analysis_focus + "\n\n"
    else:
        prompt += "分析重点：" + focus_str + "\n\n"
    
    if stock_context:
        prompt += "当前股票数据：\n" + stock_context + "\n\n"
    
    prompt += "用户问题：" + user_message + "\n\n"
    prompt += """请提供详细的分析报告，包括：
1. 当前市场表现概述
2. """ + focus_0 + """分析
3. """ + focus_1 + """分析
4. 风险提示
5. """ + style_info["time_horizon"] + """投资建议（仅供参考）"""
    
    return prompt
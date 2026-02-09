"""
金融AI助手API路由
"""

import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.fin_agent_service import fin_agent_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/fin-agent", tags=["fin-agent"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = None
    ts_code: Optional[str] = None


class ChatResponse(BaseModel):
    success: bool
    content: str
    error: Optional[str] = None


class AnalyzeRequest(BaseModel):
    ts_code: str


class SignalItem(BaseModel):
    type: str
    indicator: str
    message: str


class IndicatorsData(BaseModel):
    ma5: Optional[float] = None
    ma10: Optional[float] = None
    ma20: Optional[float] = None
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    macd_histogram: Optional[float] = None
    rsi: Optional[float] = None
    kdj_k: Optional[float] = None
    kdj_d: Optional[float] = None
    kdj_j: Optional[float] = None
    boll_upper: Optional[float] = None
    boll_middle: Optional[float] = None
    boll_lower: Optional[float] = None


class StockInfo(BaseModel):
    ts_code: Optional[str] = None
    symbol: Optional[str] = None
    name: Optional[str] = None
    area: Optional[str] = None
    industry: Optional[str] = None
    market: Optional[str] = None
    list_date: Optional[str] = None


class AnalysisData(BaseModel):
    stock_info: StockInfo
    latest_price: float
    pct_change: float
    indicators: IndicatorsData
    signals: List[SignalItem]


class AnalyzeResponse(BaseModel):
    success: bool
    data: Optional[AnalysisData] = None
    message: Optional[str] = None


class HotStock(BaseModel):
    ts_code: str
    name: str
    price: float
    pct_chg: float


class MarketOverviewResponse(BaseModel):
    hot_stocks: List[HotStock]
    market_sentiment: str
    update_time: str


@router.post("/chat", response_model=ChatResponse)
async def chat_with_agent(request: ChatRequest):
    """与金融AI助手对话"""
    try:
        history = None
        if request.history:
            history = [{"role": h.role, "content": h.content} for h in request.history]
        
        content = await fin_agent_service.chat(
            message=request.message,
            history=history,
            ts_code=request.ts_code
        )
        
        return ChatResponse(success=True, content=content)
    except Exception as e:
        logger.error(f"Chat error: {e}")
        return ChatResponse(success=False, content="", error=str(e))


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_stock(request: AnalyzeRequest):
    """分析股票"""
    try:
        result = await fin_agent_service.analyze_stock(request.ts_code)
        
        if result["success"]:
            data = result["data"]
            return AnalyzeResponse(
                success=True,
                data=AnalysisData(
                    stock_info=StockInfo(**data["stock_info"]),
                    latest_price=data["latest_price"],
                    pct_change=data["pct_change"],
                    indicators=IndicatorsData(**data["indicators"]),
                    signals=[SignalItem(**s) for s in data["signals"]]
                )
            )
        else:
            return AnalyzeResponse(success=False, message=result.get("message", "分析失败"))
    except Exception as e:
        logger.error(f"Analyze error: {e}")
        return AnalyzeResponse(success=False, message=str(e))


@router.get("/market-overview", response_model=MarketOverviewResponse)
async def get_market_overview():
    """获取市场概览"""
    try:
        overview = await fin_agent_service.get_market_overview()
        return MarketOverviewResponse(
            hot_stocks=[HotStock(**s) for s in overview["hot_stocks"]],
            market_sentiment=overview["market_sentiment"],
            update_time=overview["update_time"]
        )
    except Exception as e:
        logger.error(f"Market overview error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
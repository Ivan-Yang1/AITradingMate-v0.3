"""Tushare数据API路由"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from services.tushare_service import tushare_service
from services.stock_search_service import stock_search_service

router = APIRouter(prefix="/api/v1/tushare", tags=["tushare"])

class StockItem(BaseModel):
    ts_code: str
    symbol: str
    name: str
    area: Optional[str] = None
    industry: Optional[str] = None
    market: Optional[str] = None

class KLineItem(BaseModel):
    trade_date: str
    open: float
    high: float
    low: float
    close: float
    vol: float
    amount: float
    pct_chg: float

class RealtimeQuoteItem(BaseModel):
    ts_code: str
    name: str
    close: float
    change: float
    pct_chg: float
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    vol: Optional[float] = None

class StockListResponse(BaseModel):
    stocks: List[StockItem]

class KLineResponse(BaseModel):
    ts_code: str
    name: str
    data: List[KLineItem]

class RealtimeQuoteResponse(BaseModel):
    items: List[RealtimeQuoteItem]

class StockInfoResponse(BaseModel):
    ts_code: str
    symbol: str
    name: str
    area: Optional[str] = None
    industry: Optional[str] = None
    market: Optional[str] = None
    list_date: Optional[str] = None

@router.get("/stocks", response_model=StockListResponse)
async def search_stocks(
    keyword: str = Query(default="", description="搜索关键词(代码或名称)"),
    limit: int = Query(default=50, description="返回数量限制", ge=1, le=100)
):
    """搜索股票列表 - 支持全市场搜索
    
    支持按股票代码或名称搜索，返回匹配的股票列表。
    如果不提供关键词，返回热门股票列表。
    """
    try:
        # 使用新的搜索服务
        stocks = await stock_search_service.search_stocks(keyword, limit)
        return StockListResponse(stocks=[StockItem(**s) for s in stocks])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stocks/hot", response_model=StockListResponse)
async def get_hot_stocks(
    limit: int = Query(default=20, description="返回数量限制", ge=1, le=100)
):
    """获取热门股票列表（按涨幅排序）"""
    try:
        stocks = await stock_search_service.get_hot_stocks(limit)
        return StockListResponse(stocks=[StockItem(**s) for s in stocks])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/kline", response_model=KLineResponse)
async def get_kline(
    ts_code: str = Query(..., description="股票代码"),
    freq: str = Query(default="D", description="周期: D/W/M"),
    start_date: Optional[str] = Query(default=None, description="开始日期 YYYYMMDD"),
    end_date: Optional[str] = Query(default=None, description="结束日期 YYYYMMDD")
):
    """获取K线数据"""
    try:
        # 映射周期参数
        period_map = {
            "D": "daily",
            "W": "weekly", 
            "M": "monthly"
        }
        period = period_map.get(freq, "daily")
        
        # 获取股票信息
        stock_info = await tushare_service.get_stock_info(ts_code)
        name = stock_info.get("name", ts_code)
        
        # 获取K线数据
        klines = await tushare_service.get_daily_kline(
            ts_code=ts_code,
            period=period,
            start_date=start_date,
            end_date=end_date
        )
        
        # 转换字段名以匹配前端期望的格式
        formatted_klines = []
        for k in klines:
            formatted_klines.append(KLineItem(
                trade_date=k.get("date", ""),
                open=k.get("open", 0),
                high=k.get("high", 0),
                low=k.get("low", 0),
                close=k.get("close", 0),
                vol=k.get("volume", 0),
                amount=k.get("amount", 0),
                pct_chg=k.get("pct_chg", 0)
            ))
        
        return KLineResponse(
            ts_code=ts_code,
            name=name,
            data=formatted_klines
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/kline/{ts_code}", response_model=KLineResponse)
async def get_kline_by_path(
    ts_code: str,
    period: str = Query(default="daily", description="周期: daily/weekly/monthly"),
    start_date: Optional[str] = Query(default=None, description="开始日期 YYYYMMDD"),
    end_date: Optional[str] = Query(default=None, description="结束日期 YYYYMMDD")
):
    """获取K线数据 (路径参数版本)"""
    try:
        # 获取股票信息
        stock_info = await tushare_service.get_stock_info(ts_code)
        name = stock_info.get("name", ts_code)
        
        # 获取K线数据
        klines = await tushare_service.get_daily_kline(
            ts_code=ts_code,
            period=period,
            start_date=start_date,
            end_date=end_date
        )
        
        # 转换字段名
        formatted_klines = []
        for k in klines:
            formatted_klines.append(KLineItem(
                trade_date=k.get("date", ""),
                open=k.get("open", 0),
                high=k.get("high", 0),
                low=k.get("low", 0),
                close=k.get("close", 0),
                vol=k.get("volume", 0),
                amount=k.get("amount", 0),
                pct_chg=k.get("pct_chg", 0)
            ))
        
        return KLineResponse(
            ts_code=ts_code,
            name=name,
            data=formatted_klines
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stock/{ts_code}", response_model=StockInfoResponse)
async def get_stock_info(ts_code: str):
    """获取股票基本信息"""
    try:
        info = await tushare_service.get_stock_info(ts_code)
        if not info:
            raise HTTPException(status_code=404, detail="股票不存在")
        return StockInfoResponse(**info)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/realtime", response_model=RealtimeQuoteResponse)
async def get_realtime_quotes(
    ts_codes: str = Query(..., description="股票代码列表，逗号分隔")
):
    """获取多只股票的实时行情数据"""
    try:
        codes = [code.strip() for code in ts_codes.split(",") if code.strip()]
        if not codes:
            return RealtimeQuoteResponse(items=[])
        
        items = []
        for ts_code in codes:
            try:
                quote = await tushare_service.get_realtime_quote(ts_code)
                if quote:
                    items.append(RealtimeQuoteItem(
                        ts_code=quote.get("ts_code", ts_code),
                        name=quote.get("name", ""),
                        close=quote.get("close", 0),
                        change=quote.get("change", 0),
                        pct_chg=quote.get("pct_chg", 0),
                        open=quote.get("open"),
                        high=quote.get("high"),
                        low=quote.get("low"),
                        vol=quote.get("vol"),
                    ))
            except Exception as e:
                print(f"Failed to get quote for {ts_code}: {e}")
                continue
        
        return RealtimeQuoteResponse(items=items)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
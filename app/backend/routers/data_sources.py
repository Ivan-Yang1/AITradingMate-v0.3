"""统一数据源API路由 - 支持多数据源切换"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Any
from services.data_source_manager import data_source_manager, DataSource

router = APIRouter(prefix="/api/v1/data", tags=["data-sources"])


class KLineItem(BaseModel):
    """统一K线数据格式"""
    trade_date: str  # 统一使用trade_date
    date: str        # 保留date字段兼容
    open: float
    high: float
    low: float
    close: float
    vol: float       # 统一使用vol
    volume: float    # 保留volume字段兼容
    amount: float
    pct_chg: float
    source: Optional[str] = None  # 数据来源标识


class UnifiedKLineResponse(BaseModel):
    ts_code: str
    name: Optional[str] = None
    source: str
    period: str
    data: List[KLineItem]
    from_cache: Optional[bool] = None
    error: Optional[str] = None


class StockItem(BaseModel):
    ts_code: str
    symbol: str
    name: str
    area: Optional[str] = None
    industry: Optional[str] = None
    market: Optional[str] = None


class StockListResponse(BaseModel):
    stocks: List[StockItem]
    source: str


class RealtimeQuoteItem(BaseModel):
    ts_code: str
    name: str
    close: float
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    pre_close: Optional[float] = None
    change: float
    pct_chg: float
    vol: Optional[float] = None
    amount: Optional[float] = None
    source: Optional[str] = None


class RealtimeQuoteResponse(BaseModel):
    item: RealtimeQuoteItem
    source: str


class DataSourceItem(BaseModel):
    id: str
    name: str
    description: str
    features: List[str]
    periods: List[str]
    recommended: Optional[bool] = False


class DataSourcesResponse(BaseModel):
    sources: List[DataSourceItem]
    default: str


class IndexItem(BaseModel):
    ts_code: str
    name: str
    close: float
    change: float
    pct_chg: float


class MarketOverviewResponse(BaseModel):
    indices: List[IndexItem]


class CacheStatsResponse(BaseModel):
    status: str
    backend: Optional[str] = None
    keys: Optional[int] = None
    memory: Optional[str] = None
    message: Optional[str] = None


@router.get("/sources", response_model=DataSourcesResponse)
async def get_data_sources():
    """获取所有可用的数据源"""
    sources = data_source_manager.get_available_sources()
    return DataSourcesResponse(
        sources=[DataSourceItem(**s) for s in sources],
        default=data_source_manager._default_source.value
    )


@router.get("/stocks", response_model=StockListResponse)
async def get_stock_list(
    keyword: str = Query(default="", description="搜索关键词"),
    source: Optional[str] = Query(default=None, description="数据源: tushare/eastmoney")
):
    """获取股票列表（自动选择最佳数据源）"""
    try:
        src = DataSource(source) if source else None
        stocks = await data_source_manager.get_stock_list(keyword, src)
        
        # 标准化返回格式
        formatted_stocks = []
        for s in stocks:
            formatted_stocks.append(StockItem(
                ts_code=s.get("ts_code", ""),
                symbol=s.get("symbol", s.get("ts_code", "").split(".")[0]),
                name=s.get("name", ""),
                area=s.get("area"),
                industry=s.get("industry"),
                market=s.get("market"),
            ))
        
        return StockListResponse(
            stocks=formatted_stocks,
            source=source or data_source_manager._default_source.value
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/kline", response_model=UnifiedKLineResponse)
async def get_kline(
    ts_code: str = Query(..., description="股票代码"),
    period: str = Query(default="daily", description="周期: 1/5/15/30/60/daily/weekly/monthly"),
    start_date: Optional[str] = Query(default=None, description="开始日期 YYYYMMDD"),
    end_date: Optional[str] = Query(default=None, description="结束日期 YYYYMMDD"),
    source: Optional[str] = Query(default=None, description="数据源: tushare/eastmoney/sina"),
    limit: int = Query(default=500, description="数据条数")
):
    """获取K线数据（自动选择最佳数据源，带缓存优化）
    
    特点：
    - 自动故障转移：如果主数据源失败，自动切换到备用数据源
    - 智能选择：分钟K线自动使用东方财富数据源
    - 统一格式：不同数据源返回统一的数据格式
    - 缓存优化：自动缓存历史数据，减少重复查询
    """
    try:
        # 使用存储服务获取数据（带缓存）
        from services.kline_storage import kline_storage
        
        result = await kline_storage.get_kline_with_storage(
            ts_code=ts_code,
            period=period,
            start_date=start_date,
            end_date=end_date,
            source=source or data_source_manager._default_source.value,
            limit=limit
        )
        
        # 获取股票名称
        stock_info = await data_source_manager.get_stock_info(ts_code)
        name = stock_info.get("name", ts_code)
        
        # 格式化K线数据（统一格式）
        formatted_data = []
        for k in result.get("data", []):
            # 获取日期字段
            date_value = k.get("trade_date") or k.get("date", "")
            # 获取成交量字段
            vol_value = k.get("vol") or k.get("volume", 0)
            
            formatted_data.append(KLineItem(
                trade_date=date_value,
                date=date_value,
                open=float(k.get("open", 0)),
                high=float(k.get("high", 0)),
                low=float(k.get("low", 0)),
                close=float(k.get("close", 0)),
                vol=float(vol_value),
                volume=float(vol_value),
                amount=float(k.get("amount", 0)),
                pct_chg=float(k.get("pct_chg", 0)),
                source=k.get("source"),
            ))
        
        return UnifiedKLineResponse(
            ts_code=ts_code,
            name=name,
            source=result.get("source", "unknown"),
            period=period,
            data=formatted_data,
            from_cache=result.get("from_cache"),
            error=result.get("error")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/kline/{ts_code}", response_model=UnifiedKLineResponse)
async def get_kline_by_path(
    ts_code: str,
    period: str = Query(default="daily", description="周期"),
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    source: Optional[str] = Query(default=None),
    limit: int = Query(default=500)
):
    """获取K线数据（路径参数版本）"""
    return await get_kline(ts_code, period, start_date, end_date, source, limit)


@router.get("/realtime", response_model=RealtimeQuoteResponse)
async def get_realtime_quote(
    ts_code: str = Query(..., description="股票代码"),
    source: Optional[str] = Query(default=None, description="数据源")
):
    """获取实时行情（自动选择最佳数据源）"""
    try:
        src = DataSource(source) if source else None
        quote = await data_source_manager.get_realtime_quote(ts_code, src)
        
        if not quote:
            raise HTTPException(status_code=404, detail="未找到行情数据")
        
        return RealtimeQuoteResponse(
            item=RealtimeQuoteItem(
                ts_code=quote.get("ts_code", ts_code),
                name=quote.get("name", ts_code),
                close=float(quote.get("close", 0)),
                open=quote.get("open"),
                high=quote.get("high"),
                low=quote.get("low"),
                pre_close=quote.get("pre_close"),
                change=float(quote.get("change", 0)),
                pct_chg=float(quote.get("pct_chg", 0)),
                vol=quote.get("vol"),
                amount=quote.get("amount"),
                source=quote.get("source"),
            ),
            source=source or data_source_manager._default_source.value
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/market/overview", response_model=MarketOverviewResponse)
async def get_market_overview():
    """获取市场概览（主要指数行情）"""
    try:
        data = await data_source_manager.get_market_overview()
        indices = []
        for idx in data.get("indices", []):
            indices.append(IndexItem(
                ts_code=idx.get("ts_code", ""),
                name=idx.get("name", ""),
                close=float(idx.get("close", 0)),
                change=float(idx.get("change", 0)),
                pct_chg=float(idx.get("pct_chg", 0)),
            ))
        return MarketOverviewResponse(indices=indices)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/intraday/{ts_code}", response_model=UnifiedKLineResponse)
async def get_intraday_kline(
    ts_code: str,
    period: str = Query(default="5", description="分钟周期: 1/5/15/30/60"),
    limit: int = Query(default=240, description="数据条数")
):
    """获取分时/分钟K线数据
    
    分钟K线只能使用东方财富数据源
    """
    return await get_kline(ts_code, period, None, None, "eastmoney", limit)


@router.post("/source/default")
async def set_default_source(
    source: str = Query(..., description="默认数据源: tushare/eastmoney/sina")
):
    """设置默认数据源"""
    try:
        src = DataSource(source)
        data_source_manager.set_default_source(src)
        return {"message": f"默认数据源已设置为: {source}"}
    except ValueError:
        raise HTTPException(status_code=400, detail=f"无效的数据源: {source}")


@router.get("/cache/stats", response_model=CacheStatsResponse)
async def get_cache_stats():
    """获取缓存统计信息"""
    try:
        from services.kline_storage import kline_storage
        stats = await kline_storage.get_cache_stats()
        return CacheStatsResponse(**stats)
    except Exception as e:
        return CacheStatsResponse(status="error", message=str(e))


@router.post("/cache/clear")
async def clear_cache(
    ts_code: Optional[str] = Query(default=None, description="股票代码，为空则清除所有")
):
    """清除K线缓存"""
    try:
        from services.kline_storage import kline_storage
        success = await kline_storage.clear_kline_cache(ts_code)
        if success:
            return {"message": f"缓存已清除: {ts_code or '全部'}"}
        else:
            return {"message": "缓存服务不可用"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/batch/kline")
async def batch_get_kline(
    ts_codes: str = Query(..., description="股票代码列表，逗号分隔"),
    period: str = Query(default="daily", description="周期"),
    source: Optional[str] = Query(default=None, description="数据源"),
    limit: int = Query(default=100, description="每只股票的数据条数")
):
    """批量获取多只股票的K线数据"""
    try:
        from services.kline_storage import kline_storage
        
        codes = [c.strip() for c in ts_codes.split(",") if c.strip()]
        if not codes:
            raise HTTPException(status_code=400, detail="请提供股票代码")
        
        if len(codes) > 20:
            raise HTTPException(status_code=400, detail="最多支持20只股票")
        
        results = await kline_storage.batch_get_kline(
            ts_codes=codes,
            period=period,
            source=source or data_source_manager._default_source.value,
            limit=limit
        )
        
        return {
            "source": source or data_source_manager._default_source.value,
            "period": period,
            "data": results
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
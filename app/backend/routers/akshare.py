"""AKShare数据API路由 - 补充数据源"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from services.akshare_service import akshare_service

router = APIRouter(prefix="/api/v1/akshare", tags=["akshare"])


class KLineItem(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float
    amount: float
    pct_chg: float


class KLineResponse(BaseModel):
    ts_code: str
    source: str
    period: str
    data: List[KLineItem]


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
    turnover: Optional[float] = None


class RealtimeQuoteResponse(BaseModel):
    item: RealtimeQuoteItem


class StockItem(BaseModel):
    ts_code: str
    symbol: str
    name: str
    market: Optional[str] = None
    price: Optional[float] = None
    pct_chg: Optional[float] = None


class StockListResponse(BaseModel):
    stocks: List[StockItem]
    source: str


class IndexItem(BaseModel):
    ts_code: str
    name: str
    close: float
    change: float
    pct_chg: float
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None


class MarketOverviewResponse(BaseModel):
    indices: List[IndexItem]


class DataSourceInfo(BaseModel):
    name: str
    description: str
    status: str
    features: List[str]


class DataSourcesResponse(BaseModel):
    sources: List[DataSourceInfo]


@router.get("/stocks", response_model=StockListResponse)
async def get_stock_list(
    keyword: str = Query(default="", description="搜索关键词")
):
    """从东方财富获取股票列表"""
    try:
        stocks = await akshare_service.get_stock_list_eastmoney(keyword)
        return StockListResponse(
            stocks=[StockItem(**s) for s in stocks],
            source="eastmoney"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/kline", response_model=KLineResponse)
async def get_kline(
    ts_code: str = Query(..., description="股票代码，如 000001.SZ"),
    period: str = Query(default="daily", description="周期: daily/weekly/monthly/60/30/15/5/1"),
    start_date: Optional[str] = Query(default=None, description="开始日期 YYYYMMDD"),
    end_date: Optional[str] = Query(default=None, description="结束日期 YYYYMMDD"),
    limit: int = Query(default=500, description="数据条数限制"),
    source: str = Query(default="eastmoney", description="数据源: eastmoney/sina")
):
    """获取K线数据
    
    支持多个数据源:
    - eastmoney: 东方财富（默认，数据最全）
    - sina: 新浪财经（备用）
    """
    try:
        if source == "sina":
            klines = await akshare_service.get_kline_sina(ts_code, period, limit)
        else:
            klines = await akshare_service.get_kline_eastmoney(
                ts_code, period, start_date, end_date, limit
            )
        
        # 日期过滤
        if start_date:
            klines = [k for k in klines if k["date"] >= start_date]
        if end_date:
            klines = [k for k in klines if k["date"] <= end_date]
        
        return KLineResponse(
            ts_code=ts_code,
            source=source,
            period=period,
            data=[KLineItem(**k) for k in klines]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/kline/{ts_code}", response_model=KLineResponse)
async def get_kline_by_path(
    ts_code: str,
    period: str = Query(default="daily", description="周期"),
    start_date: Optional[str] = Query(default=None, description="开始日期"),
    end_date: Optional[str] = Query(default=None, description="结束日期"),
    limit: int = Query(default=500, description="数据条数"),
    source: str = Query(default="eastmoney", description="数据源")
):
    """获取K线数据（路径参数版本）"""
    return await get_kline(ts_code, period, start_date, end_date, limit, source)


@router.get("/realtime", response_model=RealtimeQuoteResponse)
async def get_realtime_quote(
    ts_code: str = Query(..., description="股票代码"),
    source: str = Query(default="eastmoney", description="数据源: eastmoney/sina")
):
    """获取实时行情
    
    支持多个数据源:
    - eastmoney: 东方财富（默认）
    - sina: 新浪财经（备用）
    """
    try:
        if source == "sina":
            quote = await akshare_service.get_realtime_quote_sina(ts_code)
        else:
            quote = await akshare_service.get_realtime_quote_eastmoney(ts_code)
        
        if not quote:
            raise HTTPException(status_code=404, detail="未找到行情数据")
        
        return RealtimeQuoteResponse(item=RealtimeQuoteItem(**quote))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/index/kline", response_model=KLineResponse)
async def get_index_kline(
    index_code: str = Query(..., description="指数代码，如 000001.SH"),
    period: str = Query(default="daily", description="周期: daily/weekly/monthly"),
    limit: int = Query(default=500, description="数据条数")
):
    """获取指数K线数据"""
    try:
        klines = await akshare_service.get_index_kline(index_code, period, limit)
        return KLineResponse(
            ts_code=index_code,
            source="eastmoney",
            period=period,
            data=[KLineItem(**k) for k in klines]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/market/overview", response_model=MarketOverviewResponse)
async def get_market_overview():
    """获取市场概览（主要指数行情）"""
    try:
        data = await akshare_service.get_market_overview()
        return MarketOverviewResponse(
            indices=[IndexItem(**idx) for idx in data.get("indices", [])]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sources", response_model=DataSourcesResponse)
async def get_data_sources():
    """获取可用的数据源列表"""
    sources = [
        DataSourceInfo(
            name="tushare",
            description="Tushare Pro - 专业金融数据接口",
            status="active",
            features=["股票列表", "日/周/月K线", "实时行情", "股票基本信息"]
        ),
        DataSourceInfo(
            name="eastmoney",
            description="东方财富 - 免费公开数据",
            status="active",
            features=["股票列表", "多周期K线(1/5/15/30/60分钟/日/周/月)", "实时行情", "指数数据", "市场概览"]
        ),
        DataSourceInfo(
            name="sina",
            description="新浪财经 - 免费公开数据（备用）",
            status="active",
            features=["K线数据", "实时行情"]
        ),
    ]
    return DataSourcesResponse(sources=sources)


@router.get("/intraday/{ts_code}", response_model=KLineResponse)
async def get_intraday_kline(
    ts_code: str,
    period: str = Query(default="5", description="分钟周期: 1/5/15/30/60"),
    limit: int = Query(default=240, description="数据条数")
):
    """获取分时/分钟K线数据
    
    这是AKShare相比Tushare的优势之一：支持分钟级别K线
    """
    try:
        klines = await akshare_service.get_kline_eastmoney(
            ts_code, period, limit=limit
        )
        return KLineResponse(
            ts_code=ts_code,
            source="eastmoney",
            period=f"{period}min",
            data=[KLineItem(**k) for k in klines]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
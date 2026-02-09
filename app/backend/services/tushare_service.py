"""Tushare数据服务 - 获取A股市场真实数据"""
import os
import httpx
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
import logging

logger = logging.getLogger(__name__)

TUSHARE_API_URL = "http://api.tushare.pro"

# Tushare API Token - 仅通过环境变量设置

# 热门股票列表（用于搜索和展示）
HOT_STOCKS = [
    {"ts_code": "000001.SZ", "symbol": "000001", "name": "平安银行", "area": "深圳", "industry": "银行", "market": "主板"},
    {"ts_code": "600519.SH", "symbol": "600519", "name": "贵州茅台", "area": "贵州", "industry": "白酒", "market": "主板"},
    {"ts_code": "300750.SZ", "symbol": "300750", "name": "宁德时代", "area": "福建", "industry": "电池", "market": "创业板"},
    {"ts_code": "601318.SH", "symbol": "601318", "name": "中国平安", "area": "深圳", "industry": "保险", "market": "主板"},
    {"ts_code": "000858.SZ", "symbol": "000858", "name": "五粮液", "area": "四川", "industry": "白酒", "market": "主板"},
    {"ts_code": "600036.SH", "symbol": "600036", "name": "招商银行", "area": "深圳", "industry": "银行", "market": "主板"},
    {"ts_code": "000333.SZ", "symbol": "000333", "name": "美的集团", "area": "广东", "industry": "家电", "market": "主板"},
    {"ts_code": "601012.SH", "symbol": "601012", "name": "隆基绿能", "area": "陕西", "industry": "光伏", "market": "主板"},
    {"ts_code": "002594.SZ", "symbol": "002594", "name": "比亚迪", "area": "广东", "industry": "汽车", "market": "中小板"},
    {"ts_code": "600900.SH", "symbol": "600900", "name": "长江电力", "area": "湖北", "industry": "电力", "market": "主板"},
    {"ts_code": "601166.SH", "symbol": "601166", "name": "兴业银行", "area": "福建", "industry": "银行", "market": "主板"},
    {"ts_code": "000651.SZ", "symbol": "000651", "name": "格力电器", "area": "广东", "industry": "家电", "market": "主板"},
    {"ts_code": "600276.SH", "symbol": "600276", "name": "恒瑞医药", "area": "江苏", "industry": "医药", "market": "主板"},
    {"ts_code": "002415.SZ", "symbol": "002415", "name": "海康威视", "area": "浙江", "industry": "安防", "market": "中小板"},
    {"ts_code": "601888.SH", "symbol": "601888", "name": "中国中免", "area": "北京", "industry": "零售", "market": "主板"},
]

# 保留MOCK_STOCKS以兼容其他模块
MOCK_STOCKS = HOT_STOCKS


def normalize_kline_data(kline: Dict, source: str = "tushare") -> Dict:
    """统一K线数据格式
    
    统一输出格式:
    {
        "trade_date": "20260203",  # 统一使用trade_date
        "date": "20260203",        # 保留date字段兼容
        "open": 10.89,
        "high": 10.90,
        "low": 10.77,
        "close": 10.84,
        "vol": 806628.0,           # 统一使用vol
        "volume": 806628.0,        # 保留volume字段兼容
        "amount": 872562155.41,
        "pct_chg": -0.18,
        "source": "tushare"        # 数据来源标识
    }
    """
    # 获取日期字段
    date_value = kline.get("trade_date") or kline.get("date") or ""
    # 确保日期格式为YYYYMMDD
    if "-" in str(date_value):
        date_value = str(date_value).replace("-", "")
    
    # 获取成交量字段
    vol_value = kline.get("vol") or kline.get("volume") or 0
    
    return {
        "trade_date": date_value,
        "date": date_value,
        "open": float(kline.get("open", 0) or 0),
        "high": float(kline.get("high", 0) or 0),
        "low": float(kline.get("low", 0) or 0),
        "close": float(kline.get("close", 0) or 0),
        "vol": float(vol_value),
        "volume": float(vol_value),
        "amount": float(kline.get("amount", 0) or 0),
        "pct_chg": float(kline.get("pct_chg", 0) or 0),
        "source": source
    }


class TushareService:
    """Tushare数据服务 - 使用真实API获取A股数据"""
    
    # 缓存时间配置（秒）
    CACHE_TTL_STOCK_LIST = 3600 * 24    # 股票列表：24小时
    CACHE_TTL_STOCK_INFO = 3600 * 24    # 股票信息：24小时
    CACHE_TTL_KLINE_DAILY = 3600 * 6    # 日K线：6小时
    CACHE_TTL_KLINE_WEEKLY = 3600 * 24  # 周K线：24小时
    CACHE_TTL_KLINE_MONTHLY = 3600 * 24 # 月K线：24小时
    CACHE_TTL_REALTIME = 30             # 实时行情：30秒
    
    def __init__(self):
        # 仅使用环境变量中的Token
        self.token = os.environ.get("TUSHARE_TOKEN")
        self._cache = None
        
        if self.token:
            logger.info(f"TushareService initialized with token: {self.token[:8]}...")
        else:
            logger.warning("TUSHARE_TOKEN not found, API calls may fail")
    
    @property
    def cache(self):
        """延迟加载缓存服务"""
        if self._cache is None:
            try:
                from core.cache import cache_service
                self._cache = cache_service
            except ImportError:
                logger.warning("Cache service not available")
                self._cache = False
        return self._cache if self._cache else None
    
    def _get_cache_ttl(self, period: str) -> int:
        """根据周期获取缓存时间"""
        if period == "weekly":
            return self.CACHE_TTL_KLINE_WEEKLY
        elif period == "monthly":
            return self.CACHE_TTL_KLINE_MONTHLY
        else:
            return self.CACHE_TTL_KLINE_DAILY
    
    async def _get_from_cache(self, cache_key: str) -> Optional[Any]:
        """从缓存获取数据"""
        if not self.cache:
            return None
        try:
            cached = await self.cache.get_json(cache_key)
            if cached:
                logger.debug(f"Cache hit: {cache_key}")
                return cached
        except Exception as e:
            logger.warning(f"Cache get failed: {e}")
        return None
    
    async def _set_to_cache(self, cache_key: str, data: Any, ttl: int) -> bool:
        """存入缓存"""
        if not self.cache or not data:
            return False
        try:
            await self.cache.set_json(cache_key, data, ttl=ttl)
            logger.debug(f"Cache set: {cache_key}, ttl={ttl}s")
            return True
        except Exception as e:
            logger.warning(f"Cache set failed: {e}")
            return False
    
    async def _request(self, api_name: str, params: dict = None, fields: str = "") -> dict:
        """发送Tushare API请求"""
        if not self.token:
            logger.error("No Tushare token available")
            return {}
            
        payload = {
            "api_name": api_name,
            "token": self.token,
            "params": params or {},
            "fields": fields
        }
        
        logger.info(f"Tushare API request: {api_name}, params: {params}")
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(TUSHARE_API_URL, json=payload)
                result = response.json()
                
                if result.get("code") != 0:
                    error_msg = result.get("msg", "Tushare API请求失败")
                    logger.error(f"Tushare API error: {error_msg}")
                    raise Exception(error_msg)
                
                logger.info(f"Tushare API success: {api_name}")
                return result.get("data", {})
        except httpx.TimeoutException:
            logger.error(f"Tushare API timeout: {api_name}")
            raise Exception("API请求超时")
        except Exception as e:
            logger.error(f"Tushare API exception: {e}")
            raise
    
    async def get_stock_list(self, keyword: str = "") -> list:
        """获取股票列表，支持代码或名称搜索"""
        cache_key = f"tushare_stock_list:{keyword or 'all'}"
        
        # 尝试从缓存获取
        cached = await self._get_from_cache(cache_key)
        if cached:
            return cached
        
        try:
            # 从Tushare获取股票列表
            data = await self._request(
                "stock_basic",
                params={"exchange": "", "list_status": "L"},
                fields="ts_code,symbol,name,area,industry,market"
            )
            
            items = data.get("items", [])
            fields_list = data.get("fields", [])
            
            stocks = []
            for item in items:
                stock = dict(zip(fields_list, item))
                # 搜索过滤
                if keyword:
                    keyword_lower = keyword.lower()
                    if (keyword_lower in stock.get("ts_code", "").lower() or
                        keyword_lower in stock.get("symbol", "").lower() or
                        keyword in stock.get("name", "")):
                        stocks.append(stock)
                else:
                    stocks.append(stock)
                
                # 限制返回数量
                if len(stocks) >= 50:
                    break
            
            # 存入缓存
            if stocks:
                await self._set_to_cache(cache_key, stocks, self.CACHE_TTL_STOCK_LIST)
            
            return stocks if stocks else self._get_fallback_stock_list(keyword)
            
        except Exception as e:
            logger.error(f"获取股票列表失败: {e}")
            return self._get_fallback_stock_list(keyword)
    
    def _get_fallback_stock_list(self, keyword: str = "") -> list:
        """获取备用股票列表（仅用于API完全不可用时）"""
        if not keyword:
            return HOT_STOCKS[:10]
        keyword_lower = keyword.lower()
        return [s for s in HOT_STOCKS if keyword_lower in s["ts_code"].lower() or keyword in s["name"]][:10]
    
    async def get_daily_kline(
        self,
        ts_code: str,
        period: str = "daily",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> list:
        """获取K线数据
        
        Args:
            ts_code: 股票代码，如 000001.SZ
            period: 周期类型 daily/weekly/monthly
            start_date: 开始日期 YYYYMMDD
            end_date: 结束日期 YYYYMMDD
            
        Returns:
            统一格式的K线数据列表
        """
        # 生成缓存key
        cache_key = f"tushare_kline:{ts_code}:{period}:{start_date or ''}:{end_date or ''}"
        
        # 尝试从缓存获取
        cached = await self._get_from_cache(cache_key)
        if cached:
            logger.info(f"Tushare K线缓存命中: {ts_code} {period}")
            return cached
        
        try:
            # 默认获取最近一年数据
            if not end_date:
                end_date = datetime.now().strftime("%Y%m%d")
            if not start_date:
                start_date = (datetime.now() - timedelta(days=365)).strftime("%Y%m%d")
            
            # 根据周期选择API
            api_map = {
                "daily": "daily",
                "weekly": "weekly",
                "monthly": "monthly"
            }
            api_name = api_map.get(period, "daily")
            
            logger.info(f"Tushare获取K线: {ts_code}, period={period}, {start_date} to {end_date}")
            
            data = await self._request(
                api_name,
                params={
                    "ts_code": ts_code,
                    "start_date": start_date,
                    "end_date": end_date
                },
                fields="trade_date,open,high,low,close,vol,amount,pct_chg"
            )
            
            items = data.get("items", [])
            fields_list = data.get("fields", [])
            
            klines = []
            for item in items:
                raw_kline = dict(zip(fields_list, item))
                # 统一格式
                klines.append(normalize_kline_data(raw_kline, "tushare"))
            
            # 按日期升序排列
            klines.sort(key=lambda x: x["trade_date"])
            
            logger.info(f"Tushare获取 {len(klines)} 条K线: {ts_code}")
            
            # 存入缓存
            if klines:
                ttl = self._get_cache_ttl(period)
                await self._set_to_cache(cache_key, klines, ttl)
            
            # 如果没有数据，返回空列表而不是mock数据
            return klines
            
        except Exception as e:
            logger.error(f"Tushare获取K线数据失败: {e}")
            # 失败时返回空列表，让上层调用者尝试其他数据源
            return []
    
    def _aggregate_to_weekly(self, daily_klines: list) -> list:
        """将日K聚合为周K"""
        if not daily_klines:
            return []
        
        weekly = []
        current_week = []
        
        for kline in daily_klines:
            date = datetime.strptime(kline["trade_date"], "%Y%m%d")
            
            if not current_week:
                current_week.append(kline)
            elif date.weekday() < datetime.strptime(current_week[-1]["trade_date"], "%Y%m%d").weekday():
                weekly.append(self._aggregate_klines(current_week))
                current_week = [kline]
            else:
                current_week.append(kline)
        
        if current_week:
            weekly.append(self._aggregate_klines(current_week))
        
        return weekly
    
    def _aggregate_to_monthly(self, daily_klines: list) -> list:
        """将日K聚合为月K"""
        if not daily_klines:
            return []
        
        monthly = []
        current_month = []
        current_month_num = None
        
        for kline in daily_klines:
            date = datetime.strptime(kline["trade_date"], "%Y%m%d")
            month_num = date.month
            
            if current_month_num is None:
                current_month_num = month_num
                current_month.append(kline)
            elif month_num != current_month_num:
                monthly.append(self._aggregate_klines(current_month))
                current_month = [kline]
                current_month_num = month_num
            else:
                current_month.append(kline)
        
        if current_month:
            monthly.append(self._aggregate_klines(current_month))
        
        return monthly
    
    def _aggregate_klines(self, klines: list) -> dict:
        """聚合多条K线为一条"""
        if not klines:
            return {}
        
        date_value = klines[-1]["trade_date"]
        vol_value = sum(k["vol"] for k in klines)
        
        return {
            "trade_date": date_value,
            "date": date_value,
            "open": klines[0]["open"],
            "high": max(k["high"] for k in klines),
            "low": min(k["low"] for k in klines),
            "close": klines[-1]["close"],
            "vol": vol_value,
            "volume": vol_value,
            "amount": sum(k["amount"] for k in klines),
            "pct_chg": round((klines[-1]["close"] - klines[0]["open"]) / klines[0]["open"] * 100, 2) if klines[0]["open"] > 0 else 0,
            "source": "tushare"
        }
    
    async def get_stock_info(self, ts_code: str) -> dict:
        """获取股票基本信息"""
        cache_key = f"tushare_stock_info:{ts_code}"
        
        # 尝试从缓存获取
        cached = await self._get_from_cache(cache_key)
        if cached:
            return cached
        
        try:
            data = await self._request(
                "stock_basic",
                params={"ts_code": ts_code},
                fields="ts_code,symbol,name,area,industry,market,list_date"
            )
            
            items = data.get("items", [])
            fields_list = data.get("fields", [])
            
            if items:
                result = dict(zip(fields_list, items[0]))
                # 存入缓存
                await self._set_to_cache(cache_key, result, self.CACHE_TTL_STOCK_INFO)
                return result
            
            return self._get_fallback_stock_info(ts_code)
            
        except Exception as e:
            logger.error(f"获取股票信息失败: {e}")
            return self._get_fallback_stock_info(ts_code)
    
    def _get_fallback_stock_info(self, ts_code: str) -> dict:
        """获取备用股票信息"""
        for stock in HOT_STOCKS:
            if stock["ts_code"] == ts_code:
                return {**stock, "list_date": "20100101"}
        return {"ts_code": ts_code, "symbol": ts_code.split(".")[0], "name": ts_code, "list_date": "20100101"}

    async def get_realtime_quote(self, ts_code: str) -> dict:
        """获取股票实时行情
        
        Args:
            ts_code: 股票代码，如 000001.SZ
            
        Returns:
            dict: 包含实时行情数据的字典
        """
        cache_key = f"tushare_realtime:{ts_code}"
        
        # 尝试从缓存获取
        cached = await self._get_from_cache(cache_key)
        if cached:
            return cached
        
        # 获取股票信息
        stock_info = await self.get_stock_info(ts_code)
        name = stock_info.get("name", ts_code)
        
        try:
            # 使用Tushare的daily接口获取最新数据
            end_date = datetime.now().strftime("%Y%m%d")
            start_date = (datetime.now() - timedelta(days=7)).strftime("%Y%m%d")
            
            data = await self._request(
                "daily",
                params={
                    "ts_code": ts_code,
                    "start_date": start_date,
                    "end_date": end_date
                },
                fields="trade_date,open,high,low,close,vol,amount,pct_chg,change"
            )
            
            items = data.get("items", [])
            fields_list = data.get("fields", [])
            
            if items:
                # 获取最新一条数据
                latest = dict(zip(fields_list, items[0]))
                result = {
                    "ts_code": ts_code,
                    "name": name,
                    "close": float(latest.get("close", 0) or 0),
                    "change": float(latest.get("change", 0) or 0),
                    "pct_chg": float(latest.get("pct_chg", 0) or 0),
                    "open": float(latest.get("open", 0) or 0),
                    "high": float(latest.get("high", 0) or 0),
                    "low": float(latest.get("low", 0) or 0),
                    "vol": float(latest.get("vol", 0) or 0),
                    "source": "tushare"
                }
                
                # 存入缓存
                await self._set_to_cache(cache_key, result, self.CACHE_TTL_REALTIME)
                
                return result
            
            # 没有数据时返回空字典
            return {}
            
        except Exception as e:
            logger.error(f"获取实时行情失败: {e}")
            return {}


# 创建服务实例
tushare_service = TushareService()
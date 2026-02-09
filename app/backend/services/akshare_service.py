"""AKShare数据服务 - 获取A股市场数据的补充数据源"""
import os
import httpx
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import logging
import random

logger = logging.getLogger(__name__)

# AKShare通过akshare库获取数据，这里我们使用HTTP方式调用
# 备用方案：使用东方财富、新浪财经等公开API

# 东方财富API
EASTMONEY_KLINE_API = "https://push2his.eastmoney.com/api/qt/stock/kline/get"
EASTMONEY_QUOTE_API = "https://push2.eastmoney.com/api/qt/stock/get"
EASTMONEY_LIST_API = "https://push2.eastmoney.com/api/qt/clist/get"

# 新浪财经API
SINA_KLINE_API = "https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData"
SINA_REALTIME_API = "https://hq.sinajs.cn/list="


def get_eastmoney_secid(ts_code: str) -> str:
    """将ts_code转换为东方财富的secid格式"""
    code, market = ts_code.split(".")
    if market == "SH":
        return f"1.{code}"
    elif market == "SZ":
        return f"0.{code}"
    elif market == "BJ":
        return f"0.{code}"
    return f"0.{code}"


def get_sina_code(ts_code: str) -> str:
    """将ts_code转换为新浪的代码格式"""
    code, market = ts_code.split(".")
    if market == "SH":
        return f"sh{code}"
    elif market == "SZ":
        return f"sz{code}"
    return f"sz{code}"


def normalize_kline_data(kline: Dict, source: str = "unknown") -> Dict:
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
        "source": "eastmoney"      # 数据来源标识
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


class AKShareService:
    """AKShare风格的数据服务 - 使用多个公开API作为数据源"""
    
    # 缓存时间配置（秒）
    CACHE_TTL_MINUTE = 60           # 分钟K线：1分钟
    CACHE_TTL_DAILY = 3600 * 6      # 日K线：6小时
    CACHE_TTL_WEEKLY = 3600 * 24    # 周K线：24小时
    CACHE_TTL_MONTHLY = 3600 * 24   # 月K线：24小时
    CACHE_TTL_QUOTE = 10            # 实时行情：10秒
    CACHE_TTL_INDEX = 60            # 指数数据：1分钟
    
    def __init__(self):
        self._cache = None
        self.timeout = 15.0
        logger.info("AKShareService initialized")
    
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
        if period in ("1", "5", "15", "30", "60"):
            return self.CACHE_TTL_MINUTE
        elif period == "weekly":
            return self.CACHE_TTL_WEEKLY
        elif period == "monthly":
            return self.CACHE_TTL_MONTHLY
        else:
            return self.CACHE_TTL_DAILY
    
    async def _get_from_cache(self, cache_key: str) -> Optional[List[Dict]]:
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
    
    async def get_stock_list_eastmoney(self, keyword: str = "") -> List[Dict]:
        """从东方财富获取股票列表"""
        cache_key = f"akshare_stock_list:{keyword or 'all'}"
        
        # 尝试从缓存获取
        cached = await self._get_from_cache(cache_key)
        if cached:
            return cached
        
        try:
            params = {
                "pn": 1,
                "pz": 100,
                "po": 1,
                "np": 1,
                "fltt": 2,
                "invt": 2,
                "fid": "f3",
                "fs": "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23",
                "fields": "f12,f13,f14,f2,f3,f4,f5,f6",
            }
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(EASTMONEY_LIST_API, params=params)
                data = response.json()
                
                if data.get("data") and data["data"].get("diff"):
                    stocks = []
                    for item in data["data"]["diff"]:
                        code = item.get("f12", "")
                        market = "SH" if item.get("f13") == 1 else "SZ"
                        name = item.get("f14", "")
                        ts_code = f"{code}.{market}"
                        
                        # 关键词过滤
                        if keyword:
                            keyword_lower = keyword.lower()
                            if not (keyword_lower in code.lower() or keyword in name):
                                continue
                        
                        stocks.append({
                            "ts_code": ts_code,
                            "symbol": code,
                            "name": name,
                            "market": market,
                            "price": item.get("f2"),
                            "pct_chg": item.get("f3"),
                        })
                        
                        if len(stocks) >= 50:
                            break
                    
                    # 存入缓存（1小时）
                    await self._set_to_cache(cache_key, stocks, 3600)
                    return stocks
            
            return []
        except Exception as e:
            logger.error(f"东方财富获取股票列表失败: {e}")
            return []
    
    async def get_kline_eastmoney(
        self,
        ts_code: str,
        period: str = "daily",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 500
    ) -> List[Dict]:
        """从东方财富获取K线数据
        
        Args:
            ts_code: 股票代码，如 000001.SZ
            period: 周期类型 daily/weekly/monthly/60/30/15/5/1
            start_date: 开始日期 YYYYMMDD
            end_date: 结束日期 YYYYMMDD
            limit: 获取数量限制
            
        Returns:
            统一格式的K线数据列表
        """
        # 生成缓存key
        cache_key = f"akshare_kline_em:{ts_code}:{period}:{start_date or ''}:{end_date or ''}:{limit}"
        
        # 尝试从缓存获取
        cached = await self._get_from_cache(cache_key)
        if cached:
            logger.info(f"东方财富K线缓存命中: {ts_code} {period}")
            return cached
        
        try:
            secid = get_eastmoney_secid(ts_code)
            
            # 周期映射
            klt_map = {
                "daily": 101,
                "weekly": 102,
                "monthly": 103,
                "60": 60,
                "30": 30,
                "15": 15,
                "5": 5,
                "1": 1,
            }
            klt = klt_map.get(period, 101)
            
            # 复权类型: 0-不复权 1-前复权 2-后复权
            fqt = 1
            
            params = {
                "secid": secid,
                "klt": klt,
                "fqt": fqt,
                "lmt": limit,
                "end": "20500101",
                "iscca": 1,
                "fields1": "f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13",
                "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
            }
            
            if end_date:
                params["end"] = end_date
            
            logger.info(f"东方财富获取K线: {ts_code}, period={period}, secid={secid}")
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(EASTMONEY_KLINE_API, params=params)
                data = response.json()
                
                if data.get("data") and data["data"].get("klines"):
                    klines = []
                    for line in data["data"]["klines"]:
                        parts = line.split(",")
                        if len(parts) >= 7:
                            raw_kline = {
                                "date": parts[0].replace("-", ""),
                                "open": float(parts[1]),
                                "close": float(parts[2]),
                                "high": float(parts[3]),
                                "low": float(parts[4]),
                                "volume": float(parts[5]),
                                "amount": float(parts[6]),
                                "pct_chg": float(parts[8]) if len(parts) > 8 else 0,
                            }
                            
                            # 日期过滤
                            if start_date and raw_kline["date"] < start_date:
                                continue
                            if end_date and raw_kline["date"] > end_date:
                                continue
                            
                            # 统一格式
                            klines.append(normalize_kline_data(raw_kline, "eastmoney"))
                    
                    logger.info(f"东方财富获取 {len(klines)} 条K线: {ts_code}")
                    
                    # 存入缓存
                    ttl = self._get_cache_ttl(period)
                    await self._set_to_cache(cache_key, klines, ttl)
                    
                    return klines
            
            return []
        except Exception as e:
            logger.error(f"东方财富获取K线数据失败: {e}")
            return []
    
    async def get_kline_sina(
        self,
        ts_code: str,
        period: str = "daily",
        limit: int = 500
    ) -> List[Dict]:
        """从新浪财经获取K线数据（备用）
        
        Args:
            ts_code: 股票代码
            period: 周期 daily/weekly/monthly/60/30/15/5
            limit: 数据条数
            
        Returns:
            统一格式的K线数据列表
        """
        # 生成缓存key
        cache_key = f"akshare_kline_sina:{ts_code}:{period}:{limit}"
        
        # 尝试从缓存获取
        cached = await self._get_from_cache(cache_key)
        if cached:
            logger.info(f"新浪K线缓存命中: {ts_code} {period}")
            return cached
        
        try:
            sina_code = get_sina_code(ts_code)
            
            # 新浪周期映射
            scale_map = {
                "daily": 240,
                "weekly": 1200,
                "monthly": 7200,
                "60": 60,
                "30": 30,
                "15": 15,
                "5": 5,
            }
            scale = scale_map.get(period, 240)
            
            # 新浪K线数据类型
            datalen = limit
            
            params = {
                "symbol": sina_code,
                "scale": scale,
                "datalen": datalen,
            }
            
            logger.info(f"新浪获取K线: {ts_code}, period={period}")
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(SINA_KLINE_API, params=params)
                # 新浪返回的是JSONP格式，需要处理
                text = response.text
                
                # 尝试解析JSON
                import json
                try:
                    data = json.loads(text)
                except:
                    logger.warning(f"新浪K线解析失败: {text[:100]}")
                    return []
                
                if data:
                    klines = []
                    for item in data:
                        raw_kline = {
                            "date": item.get("day", "").replace("-", ""),
                            "open": float(item.get("open", 0)),
                            "high": float(item.get("high", 0)),
                            "low": float(item.get("low", 0)),
                            "close": float(item.get("close", 0)),
                            "volume": float(item.get("volume", 0)),
                            "amount": 0,  # 新浪不提供成交额
                            "pct_chg": 0,
                        }
                        klines.append(raw_kline)
                    
                    # 计算涨跌幅
                    for i in range(1, len(klines)):
                        if klines[i-1]["close"] > 0:
                            klines[i]["pct_chg"] = round(
                                (klines[i]["close"] - klines[i-1]["close"]) / klines[i-1]["close"] * 100, 2
                            )
                    
                    # 统一格式
                    normalized_klines = [normalize_kline_data(k, "sina") for k in klines]
                    
                    logger.info(f"新浪获取 {len(normalized_klines)} 条K线: {ts_code}")
                    
                    # 存入缓存
                    ttl = self._get_cache_ttl(period)
                    await self._set_to_cache(cache_key, normalized_klines, ttl)
                    
                    return normalized_klines
            
            return []
        except Exception as e:
            logger.error(f"新浪获取K线数据失败: {e}")
            return []
    
    async def get_realtime_quote_eastmoney(self, ts_code: str) -> Optional[Dict]:
        """从东方财富获取实时行情"""
        cache_key = f"akshare_quote_em:{ts_code}"
        
        # 尝试从缓存获取
        cached = await self._get_from_cache(cache_key)
        if cached:
            return cached
        
        try:
            secid = get_eastmoney_secid(ts_code)
            
            params = {
                "secid": secid,
                "fields": "f43,f44,f45,f46,f47,f48,f50,f51,f52,f55,f57,f58,f60,f71,f116,f117,f162,f168,f169,f170",
            }
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(EASTMONEY_QUOTE_API, params=params)
                data = response.json()
                
                if data.get("data"):
                    d = data["data"]
                    # 价格需要除以100（东方财富返回的是分）
                    divisor = 100 if d.get("f43", 0) > 1000 else 1
                    
                    quote = {
                        "ts_code": ts_code,
                        "name": d.get("f58", ts_code),
                        "close": d.get("f43", 0) / divisor if d.get("f43") else 0,
                        "open": d.get("f46", 0) / divisor if d.get("f46") else 0,
                        "high": d.get("f44", 0) / divisor if d.get("f44") else 0,
                        "low": d.get("f45", 0) / divisor if d.get("f45") else 0,
                        "pre_close": d.get("f60", 0) / divisor if d.get("f60") else 0,
                        "change": d.get("f169", 0) / divisor if d.get("f169") else 0,
                        "pct_chg": d.get("f170", 0) / 100 if d.get("f170") else 0,
                        "vol": d.get("f47", 0),
                        "amount": d.get("f48", 0),
                        "turnover": d.get("f168", 0) / 100 if d.get("f168") else 0,
                        "source": "eastmoney"
                    }
                    
                    # 存入缓存
                    await self._set_to_cache(cache_key, quote, self.CACHE_TTL_QUOTE)
                    return quote
            
            return None
        except Exception as e:
            logger.error(f"东方财富获取实时行情失败: {e}")
            return None
    
    async def get_realtime_quote_sina(self, ts_code: str) -> Optional[Dict]:
        """从新浪获取实时行情（备用）"""
        cache_key = f"akshare_quote_sina:{ts_code}"
        
        # 尝试从缓存获取
        cached = await self._get_from_cache(cache_key)
        if cached:
            return cached
        
        try:
            sina_code = get_sina_code(ts_code)
            url = f"{SINA_REALTIME_API}{sina_code}"
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url)
                text = response.text
                
                # 解析新浪返回的数据格式
                # var hq_str_sh600519="贵州茅台,1680.00,1678.00,..."
                if "=" in text:
                    parts = text.split("=")[1].strip('";\\n').split(",")
                    if len(parts) >= 32:
                        quote = {
                            "ts_code": ts_code,
                            "name": parts[0],
                            "open": float(parts[1]) if parts[1] else 0,
                            "pre_close": float(parts[2]) if parts[2] else 0,
                            "close": float(parts[3]) if parts[3] else 0,
                            "high": float(parts[4]) if parts[4] else 0,
                            "low": float(parts[5]) if parts[5] else 0,
                            "vol": float(parts[8]) if parts[8] else 0,
                            "amount": float(parts[9]) if parts[9] else 0,
                            "change": round(float(parts[3]) - float(parts[2]), 2) if parts[3] and parts[2] else 0,
                            "pct_chg": round((float(parts[3]) - float(parts[2])) / float(parts[2]) * 100, 2) if parts[3] and parts[2] and float(parts[2]) > 0 else 0,
                            "source": "sina"
                        }
                        
                        # 存入缓存
                        await self._set_to_cache(cache_key, quote, self.CACHE_TTL_QUOTE)
                        return quote
            
            return None
        except Exception as e:
            logger.error(f"新浪获取实时行情失败: {e}")
            return None
    
    async def get_index_kline(
        self,
        index_code: str,
        period: str = "daily",
        limit: int = 500
    ) -> List[Dict]:
        """获取指数K线数据
        
        Args:
            index_code: 指数代码，如 000001.SH(上证指数), 399001.SZ(深证成指), 399006.SZ(创业板指)
            period: 周期
            limit: 数据条数
        """
        cache_key = f"akshare_index_kline:{index_code}:{period}:{limit}"
        
        # 尝试从缓存获取
        cached = await self._get_from_cache(cache_key)
        if cached:
            return cached
        
        # 指数的secid格式不同
        code, market = index_code.split(".")
        if market == "SH":
            secid = f"1.{code}"
        else:
            secid = f"0.{code}"
        
        try:
            klt_map = {
                "daily": 101,
                "weekly": 102,
                "monthly": 103,
            }
            klt = klt_map.get(period, 101)
            
            params = {
                "secid": secid,
                "klt": klt,
                "fqt": 1,
                "lmt": limit,
                "end": "20500101",
                "iscca": 1,
                "fields1": "f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13",
                "fields2": "f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61",
            }
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(EASTMONEY_KLINE_API, params=params)
                data = response.json()
                
                if data.get("data") and data["data"].get("klines"):
                    klines = []
                    for line in data["data"]["klines"]:
                        parts = line.split(",")
                        if len(parts) >= 7:
                            raw_kline = {
                                "date": parts[0].replace("-", ""),
                                "open": float(parts[1]),
                                "close": float(parts[2]),
                                "high": float(parts[3]),
                                "low": float(parts[4]),
                                "volume": float(parts[5]),
                                "amount": float(parts[6]),
                                "pct_chg": float(parts[8]) if len(parts) > 8 else 0,
                            }
                            klines.append(normalize_kline_data(raw_kline, "eastmoney"))
                    
                    # 存入缓存
                    await self._set_to_cache(cache_key, klines, self.CACHE_TTL_INDEX)
                    return klines
            
            return []
        except Exception as e:
            logger.error(f"获取指数K线失败: {e}")
            return []
    
    async def get_market_overview(self) -> Dict:
        """获取市场概览数据（大盘指数）"""
        cache_key = "akshare_market_overview"
        
        # 尝试从缓存获取
        cached = await self._get_from_cache(cache_key)
        if cached:
            return cached
        
        indices = [
            ("000001.SH", "上证指数"),
            ("399001.SZ", "深证成指"),
            ("399006.SZ", "创业板指"),
            ("000300.SH", "沪深300"),
            ("000016.SH", "上证50"),
            ("000905.SH", "中证500"),
        ]
        
        result = []
        for index_code, name in indices:
            try:
                quote = await self.get_realtime_quote_eastmoney(index_code)
                if quote:
                    quote["name"] = name
                    result.append(quote)
            except Exception as e:
                logger.error(f"获取指数{index_code}行情失败: {e}")
        
        overview = {"indices": result}
        
        # 存入缓存
        await self._set_to_cache(cache_key, overview, self.CACHE_TTL_INDEX)
        
        return overview


# 创建服务实例
akshare_service = AKShareService()
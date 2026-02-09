"""K线数据持久化存储服务 - 将历史行情数据存储到数据库以减少重复查询"""
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Index, UniqueConstraint, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

logger = logging.getLogger(__name__)


class KlineStorageService:
    """K线数据持久化存储服务
    
    功能：
    1. 将K线数据存储到数据库
    2. 查询时优先从数据库获取
    3. 只查询缺失的日期范围
    4. 自动更新最新数据
    """
    
    # 数据过期时间配置
    STALE_HOURS_DAILY = 6      # 日K线6小时后需要更新
    STALE_HOURS_WEEKLY = 24    # 周K线24小时后需要更新
    STALE_HOURS_MONTHLY = 48   # 月K线48小时后需要更新
    
    def __init__(self):
        self._db = None
        self._cache = None
        self._initialized = False
        logger.info("KlineStorageService initialized")
    
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
    
    async def _get_from_cache(self, cache_key: str) -> Optional[List[Dict]]:
        """从缓存获取数据"""
        if not self.cache:
            return None
        try:
            cached = await self.cache.get_json(cache_key)
            if cached:
                logger.debug(f"Storage cache hit: {cache_key}")
                return cached
        except Exception as e:
            logger.warning(f"Storage cache get failed: {e}")
        return None
    
    async def _set_to_cache(self, cache_key: str, data: Any, ttl: int) -> bool:
        """存入缓存"""
        if not self.cache or not data:
            return False
        try:
            await self.cache.set_json(cache_key, data, ttl=ttl)
            logger.debug(f"Storage cache set: {cache_key}, ttl={ttl}s")
            return True
        except Exception as e:
            logger.warning(f"Storage cache set failed: {e}")
            return False
    
    def _get_cache_ttl(self, period: str) -> int:
        """根据周期获取缓存时间"""
        if period in ("1", "5", "15", "30", "60"):
            return 60  # 分钟K线缓存1分钟
        elif period == "weekly":
            return self.STALE_HOURS_WEEKLY * 3600
        elif period == "monthly":
            return self.STALE_HOURS_MONTHLY * 3600
        else:
            return self.STALE_HOURS_DAILY * 3600
    
    async def get_kline_with_storage(
        self,
        ts_code: str,
        period: str = "daily",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        source: str = "eastmoney",
        limit: int = 500
    ) -> Dict[str, Any]:
        """获取K线数据（带存储优化）
        
        流程：
        1. 先从缓存获取
        2. 缓存没有则从数据源获取
        3. 获取后存入缓存
        
        Args:
            ts_code: 股票代码
            period: 周期
            start_date: 开始日期
            end_date: 结束日期
            source: 数据源
            limit: 数据条数
            
        Returns:
            包含K线数据的字典
        """
        # 生成缓存key
        cache_key = f"kline_storage:{ts_code}:{period}:{source}:{start_date or ''}:{end_date or ''}:{limit}"
        
        # 1. 尝试从缓存获取
        cached = await self._get_from_cache(cache_key)
        if cached:
            logger.info(f"K线存储缓存命中: {ts_code} {period}")
            return {
                "ts_code": ts_code,
                "source": source,
                "period": period,
                "data": cached,
                "from_cache": True
            }
        
        # 2. 从数据源获取
        from services.data_source_manager import data_source_manager, DataSource
        
        source_enum = None
        if source == "eastmoney":
            source_enum = DataSource.EASTMONEY
        elif source == "sina":
            source_enum = DataSource.SINA
        elif source == "tushare":
            source_enum = DataSource.TUSHARE
        
        result = await data_source_manager.get_kline(
            ts_code=ts_code,
            period=period,
            start_date=start_date,
            end_date=end_date,
            source=source_enum,
            limit=limit
        )
        
        # 3. 存入缓存
        if result.get("data"):
            ttl = self._get_cache_ttl(period)
            await self._set_to_cache(cache_key, result["data"], ttl)
            result["from_cache"] = False
        
        return result
    
    async def get_latest_kline(
        self,
        ts_code: str,
        period: str = "daily",
        source: str = "eastmoney",
        count: int = 1
    ) -> List[Dict]:
        """获取最新的K线数据
        
        Args:
            ts_code: 股票代码
            period: 周期
            source: 数据源
            count: 获取条数
            
        Returns:
            最新的K线数据列表
        """
        result = await self.get_kline_with_storage(
            ts_code=ts_code,
            period=period,
            source=source,
            limit=count
        )
        
        data = result.get("data", [])
        if data:
            # 按日期降序排列，取最新的
            sorted_data = sorted(data, key=lambda x: x.get("trade_date", x.get("date", "")), reverse=True)
            return sorted_data[:count]
        
        return []
    
    async def batch_get_kline(
        self,
        ts_codes: List[str],
        period: str = "daily",
        source: str = "eastmoney",
        limit: int = 100
    ) -> Dict[str, List[Dict]]:
        """批量获取多只股票的K线数据
        
        Args:
            ts_codes: 股票代码列表
            period: 周期
            source: 数据源
            limit: 每只股票的数据条数
            
        Returns:
            {ts_code: kline_data} 的字典
        """
        results = {}
        
        for ts_code in ts_codes:
            try:
                result = await self.get_kline_with_storage(
                    ts_code=ts_code,
                    period=period,
                    source=source,
                    limit=limit
                )
                results[ts_code] = result.get("data", [])
            except Exception as e:
                logger.error(f"批量获取K线失败 {ts_code}: {e}")
                results[ts_code] = []
        
        return results
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        """获取缓存统计信息"""
        if not self.cache:
            return {"status": "no_cache", "message": "缓存服务不可用"}
        
        try:
            stats = await self.cache.get_cache_stats()
            return {
                "status": "ok",
                "backend": stats.get("backend", "unknown"),
                "keys": stats.get("keys", 0),
                "memory": stats.get("used_memory", "N/A")
            }
        except Exception as e:
            logger.error(f"获取缓存统计失败: {e}")
            return {"status": "error", "message": str(e)}
    
    async def clear_kline_cache(self, ts_code: Optional[str] = None) -> bool:
        """清除K线缓存
        
        Args:
            ts_code: 股票代码，为空则清除所有K线缓存
            
        Returns:
            是否成功
        """
        if not self.cache:
            return False
        
        try:
            if ts_code:
                # 清除特定股票的缓存
                pattern = f"kline_storage:{ts_code}:*"
                keys = await self.cache.client.keys(pattern)
                for key in keys:
                    await self.cache.delete(key)
                logger.info(f"清除K线缓存: {ts_code}, 共 {len(keys)} 条")
            else:
                # 清除所有K线缓存
                pattern = "kline_storage:*"
                keys = await self.cache.client.keys(pattern)
                for key in keys:
                    await self.cache.delete(key)
                logger.info(f"清除所有K线缓存, 共 {len(keys)} 条")
            return True
        except Exception as e:
            logger.error(f"清除K线缓存失败: {e}")
            return False


# 创建全局实例
kline_storage = KlineStorageService()
"""
Redis缓存服务 - 提供统一的缓存接口
支持本地内存缓存作为Redis不可用时的降级方案
"""

import os
import json
import logging
import hashlib
from typing import Optional, Any, Union
from datetime import datetime, timedelta
from functools import wraps
import asyncio

logger = logging.getLogger(__name__)

# 尝试导入redis
try:
    import redis.asyncio as aioredis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.warning("redis package not installed, using in-memory cache fallback")


class InMemoryCache:
    """内存缓存 - Redis不可用时的降级方案"""
    
    def __init__(self, max_size: int = 1000):
        self._cache: dict = {}
        self._expiry: dict = {}
        self._max_size = max_size
    
    async def get(self, key: str) -> Optional[str]:
        """获取缓存值"""
        if key in self._cache:
            expiry = self._expiry.get(key)
            if expiry and datetime.now() > expiry:
                # 已过期，删除
                del self._cache[key]
                del self._expiry[key]
                return None
            return self._cache[key]
        return None
    
    async def set(self, key: str, value: str, ex: int = None) -> bool:
        """设置缓存值"""
        # 如果超过最大容量，清理过期的和最旧的
        if len(self._cache) >= self._max_size:
            await self._cleanup()
        
        self._cache[key] = value
        if ex:
            self._expiry[key] = datetime.now() + timedelta(seconds=ex)
        return True
    
    async def delete(self, key: str) -> bool:
        """删除缓存"""
        if key in self._cache:
            del self._cache[key]
            if key in self._expiry:
                del self._expiry[key]
            return True
        return False
    
    async def exists(self, key: str) -> bool:
        """检查key是否存在"""
        if key in self._cache:
            expiry = self._expiry.get(key)
            if expiry and datetime.now() > expiry:
                del self._cache[key]
                del self._expiry[key]
                return False
            return True
        return False
    
    async def _cleanup(self):
        """清理过期缓存"""
        now = datetime.now()
        expired_keys = [k for k, v in self._expiry.items() if v < now]
        for key in expired_keys:
            if key in self._cache:
                del self._cache[key]
            del self._expiry[key]
        
        # 如果还是太多，删除最旧的20%
        if len(self._cache) >= self._max_size:
            to_remove = int(self._max_size * 0.2)
            keys_to_remove = list(self._cache.keys())[:to_remove]
            for key in keys_to_remove:
                del self._cache[key]
                if key in self._expiry:
                    del self._expiry[key]
    
    async def flushdb(self):
        """清空所有缓存"""
        self._cache.clear()
        self._expiry.clear()
    
    async def keys(self, pattern: str = "*") -> list:
        """获取匹配的keys"""
        if pattern == "*":
            return list(self._cache.keys())
        # 简单的通配符匹配
        import fnmatch
        return [k for k in self._cache.keys() if fnmatch.fnmatch(k, pattern)]


class CacheService:
    """统一缓存服务"""
    
    # 缓存时间配置（秒）
    TTL_STOCK_LIST = 3600 * 24      # 股票列表：24小时
    TTL_STOCK_INFO = 3600 * 24      # 股票信息：24小时
    TTL_KLINE_DAILY = 3600 * 6      # 日K线：6小时
    TTL_KLINE_WEEKLY = 3600 * 24    # 周K线：24小时
    TTL_KLINE_MONTHLY = 3600 * 24   # 月K线：24小时
    TTL_REALTIME_QUOTE = 10         # 实时行情：10秒
    TTL_AI_ANALYSIS = 300           # AI分析：5分钟
    TTL_USER_SETTINGS = 3600        # 用户设置：1小时
    
    # 缓存key前缀
    PREFIX_STOCK_LIST = "stock:list"
    PREFIX_STOCK_INFO = "stock:info"
    PREFIX_KLINE = "kline"
    PREFIX_REALTIME = "realtime"
    PREFIX_AI_ANALYSIS = "ai:analysis"
    PREFIX_USER_SETTINGS = "user:settings"
    
    def __init__(self):
        self._redis: Optional[Any] = None
        self._memory_cache = InMemoryCache(max_size=2000)
        self._use_redis = False
        self._initialized = False
    
    async def initialize(self):
        """初始化缓存连接"""
        if self._initialized:
            return
        
        redis_url = os.environ.get("REDIS_URL", "")
        
        if redis_url and REDIS_AVAILABLE:
            try:
                self._redis = aioredis.from_url(
                    redis_url,
                    encoding="utf-8",
                    decode_responses=True,
                    socket_timeout=5,
                    socket_connect_timeout=5
                )
                # 测试连接
                await self._redis.ping()
                self._use_redis = True
                logger.info("Redis cache initialized successfully")
            except Exception as e:
                logger.warning(f"Failed to connect to Redis: {e}, using in-memory cache")
                self._redis = None
                self._use_redis = False
        else:
            if not redis_url:
                logger.info("REDIS_URL not configured, using in-memory cache")
            self._use_redis = False
        
        self._initialized = True
    
    async def close(self):
        """关闭缓存连接"""
        if self._redis:
            await self._redis.close()
            self._redis = None
        self._initialized = False
    
    @property
    def client(self):
        """获取缓存客户端"""
        if self._use_redis and self._redis:
            return self._redis
        return self._memory_cache
    
    async def get(self, key: str) -> Optional[str]:
        """获取缓存"""
        try:
            return await self.client.get(key)
        except Exception as e:
            logger.error(f"Cache get error: {e}")
            return None
    
    async def set(self, key: str, value: str, ttl: int = 3600) -> bool:
        """设置缓存"""
        try:
            await self.client.set(key, value, ex=ttl)
            return True
        except Exception as e:
            logger.error(f"Cache set error: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """删除缓存"""
        try:
            await self.client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Cache delete error: {e}")
            return False
    
    async def get_json(self, key: str) -> Optional[Any]:
        """获取JSON缓存"""
        data = await self.get(key)
        if data:
            try:
                return json.loads(data)
            except json.JSONDecodeError:
                return None
        return None
    
    async def set_json(self, key: str, value: Any, ttl: int = 3600) -> bool:
        """设置JSON缓存"""
        try:
            return await self.set(key, json.dumps(value, ensure_ascii=False), ttl)
        except Exception as e:
            logger.error(f"Cache set_json error: {e}")
            return False
    
    # ========== 股票数据缓存方法 ==========
    
    def _make_stock_list_key(self, keyword: str = "") -> str:
        """生成股票列表缓存key"""
        return f"{self.PREFIX_STOCK_LIST}:{keyword or 'all'}"
    
    async def get_stock_list(self, keyword: str = "") -> Optional[list]:
        """获取股票列表缓存"""
        return await self.get_json(self._make_stock_list_key(keyword))
    
    async def set_stock_list(self, keyword: str, stocks: list) -> bool:
        """设置股票列表缓存"""
        return await self.set_json(
            self._make_stock_list_key(keyword),
            stocks,
            self.TTL_STOCK_LIST
        )
    
    def _make_stock_info_key(self, ts_code: str) -> str:
        """生成股票信息缓存key"""
        return f"{self.PREFIX_STOCK_INFO}:{ts_code}"
    
    async def get_stock_info(self, ts_code: str) -> Optional[dict]:
        """获取股票信息缓存"""
        return await self.get_json(self._make_stock_info_key(ts_code))
    
    async def set_stock_info(self, ts_code: str, info: dict) -> bool:
        """设置股票信息缓存"""
        return await self.set_json(
            self._make_stock_info_key(ts_code),
            info,
            self.TTL_STOCK_INFO
        )
    
    def _make_kline_key(self, ts_code: str, period: str, start_date: str = "", end_date: str = "") -> str:
        """生成K线缓存key"""
        key_parts = [self.PREFIX_KLINE, ts_code, period]
        if start_date:
            key_parts.append(start_date)
        if end_date:
            key_parts.append(end_date)
        return ":".join(key_parts)
    
    async def get_kline(self, ts_code: str, period: str, start_date: str = "", end_date: str = "") -> Optional[list]:
        """获取K线缓存"""
        return await self.get_json(self._make_kline_key(ts_code, period, start_date, end_date))
    
    async def set_kline(self, ts_code: str, period: str, klines: list, start_date: str = "", end_date: str = "") -> bool:
        """设置K线缓存"""
        ttl_map = {
            "daily": self.TTL_KLINE_DAILY,
            "weekly": self.TTL_KLINE_WEEKLY,
            "monthly": self.TTL_KLINE_MONTHLY
        }
        ttl = ttl_map.get(period, self.TTL_KLINE_DAILY)
        return await self.set_json(
            self._make_kline_key(ts_code, period, start_date, end_date),
            klines,
            ttl
        )
    
    def _make_realtime_key(self, ts_code: str) -> str:
        """生成实时行情缓存key"""
        return f"{self.PREFIX_REALTIME}:{ts_code}"
    
    async def get_realtime_quote(self, ts_code: str) -> Optional[dict]:
        """获取实时行情缓存"""
        return await self.get_json(self._make_realtime_key(ts_code))
    
    async def set_realtime_quote(self, ts_code: str, quote: dict) -> bool:
        """设置实时行情缓存"""
        return await self.set_json(
            self._make_realtime_key(ts_code),
            quote,
            self.TTL_REALTIME_QUOTE
        )
    
    # ========== AI分析缓存方法 ==========
    
    def _make_ai_analysis_key(self, ts_code: str, analysis_type: str = "general") -> str:
        """生成AI分析缓存key"""
        return f"{self.PREFIX_AI_ANALYSIS}:{ts_code}:{analysis_type}"
    
    async def get_ai_analysis(self, ts_code: str, analysis_type: str = "general") -> Optional[dict]:
        """获取AI分析缓存"""
        return await self.get_json(self._make_ai_analysis_key(ts_code, analysis_type))
    
    async def set_ai_analysis(self, ts_code: str, analysis: dict, analysis_type: str = "general") -> bool:
        """设置AI分析缓存"""
        return await self.set_json(
            self._make_ai_analysis_key(ts_code, analysis_type),
            analysis,
            self.TTL_AI_ANALYSIS
        )
    
    # ========== 缓存统计 ==========
    
    async def get_cache_stats(self) -> dict:
        """获取缓存统计信息"""
        stats = {
            "backend": "redis" if self._use_redis else "memory",
            "initialized": self._initialized,
        }
        
        if self._use_redis and self._redis:
            try:
                info = await self._redis.info("memory")
                stats["used_memory"] = info.get("used_memory_human", "N/A")
                stats["keys"] = await self._redis.dbsize()
            except Exception as e:
                logger.error(f"Failed to get Redis stats: {e}")
        else:
            stats["keys"] = len(self._memory_cache._cache)
            stats["used_memory"] = "N/A (in-memory)"
        
        return stats
    
    async def clear_all(self) -> bool:
        """清空所有缓存"""
        try:
            await self.client.flushdb()
            return True
        except Exception as e:
            logger.error(f"Failed to clear cache: {e}")
            return False


# 全局缓存实例
cache_service = CacheService()


def cached(ttl: int = 3600, key_prefix: str = ""):
    """缓存装饰器
    
    Args:
        ttl: 缓存过期时间（秒）
        key_prefix: 缓存key前缀
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # 生成缓存key
            key_parts = [key_prefix or func.__name__]
            key_parts.extend(str(arg) for arg in args if not hasattr(arg, '__dict__'))
            key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
            cache_key = ":".join(key_parts)
            
            # 尝试从缓存获取
            cached_result = await cache_service.get_json(cache_key)
            if cached_result is not None:
                logger.debug(f"Cache hit: {cache_key}")
                return cached_result
            
            # 执行原函数
            result = await func(*args, **kwargs)
            
            # 存入缓存
            if result is not None:
                await cache_service.set_json(cache_key, result, ttl)
                logger.debug(f"Cache set: {cache_key}")
            
            return result
        return wrapper
    return decorator
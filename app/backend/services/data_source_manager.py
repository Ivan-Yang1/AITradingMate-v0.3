"""数据源管理服务 - 统一管理多个K线数据源"""
import logging
from typing import Optional, List, Dict, Any
from enum import Enum

logger = logging.getLogger(__name__)


class DataSource(str, Enum):
    """可用的数据源 - 按优先级排序"""
    EASTMONEY = "eastmoney"  # AKShare东方财富 - 默认首选
    SINA = "sina"            # AKShare新浪财经 - 第二选择
    TUSHARE = "tushare"      # Tushare Pro - 最后选择


class DataSourceManager:
    """数据源管理器 - 统一接口访问多个数据源"""
    
    # 数据源优先级顺序：东方财富 > 新浪财经 > Tushare
    SOURCE_PRIORITY = [DataSource.EASTMONEY, DataSource.SINA, DataSource.TUSHARE]
    
    def __init__(self):
        self._tushare_service = None
        self._akshare_service = None
        self._default_source = DataSource.EASTMONEY  # 默认使用东方财富(AKShare)
        logger.info("DataSourceManager initialized with default source: eastmoney (AKShare)")
    
    @property
    def tushare(self):
        """延迟加载Tushare服务"""
        if self._tushare_service is None:
            from services.tushare_service import tushare_service
            self._tushare_service = tushare_service
        return self._tushare_service
    
    @property
    def akshare(self):
        """延迟加载AKShare服务"""
        if self._akshare_service is None:
            from services.akshare_service import akshare_service
            self._akshare_service = akshare_service
        return self._akshare_service
    
    def set_default_source(self, source: DataSource):
        """设置默认数据源"""
        self._default_source = source
        logger.info(f"Default data source set to: {source}")
    
    def _get_fallback_sources(self, current_source: DataSource) -> List[DataSource]:
        """获取备用数据源列表（按优先级排序，排除当前源）"""
        return [s for s in self.SOURCE_PRIORITY if s != current_source]
    
    async def get_stock_list(
        self,
        keyword: str = "",
        source: Optional[DataSource] = None
    ) -> List[Dict]:
        """获取股票列表
        
        Args:
            keyword: 搜索关键词
            source: 数据源，默认使用东方财富(AKShare)
        """
        source = source or self._default_source
        fallback_sources = self._get_fallback_sources(source)
        
        # 尝试主数据源
        try:
            if source in (DataSource.EASTMONEY, DataSource.SINA):
                result = await self.akshare.get_stock_list_eastmoney(keyword)
                if result:
                    return result
            elif source == DataSource.TUSHARE:
                result = await self.tushare.get_stock_list(keyword)
                if result:
                    return result
        except Exception as e:
            logger.warning(f"获取股票列表失败 (source={source}): {e}")
        
        # 尝试备用数据源
        for fallback in fallback_sources:
            try:
                logger.info(f"尝试备用数据源: {fallback}")
                if fallback in (DataSource.EASTMONEY, DataSource.SINA):
                    result = await self.akshare.get_stock_list_eastmoney(keyword)
                    if result:
                        return result
                elif fallback == DataSource.TUSHARE:
                    result = await self.tushare.get_stock_list(keyword)
                    if result:
                        return result
            except Exception as e:
                logger.warning(f"备用数据源失败 (source={fallback}): {e}")
                continue
        
        logger.error("所有数据源都失败了")
        return []
    
    async def get_kline(
        self,
        ts_code: str,
        period: str = "daily",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        source: Optional[DataSource] = None,
        limit: int = 500
    ) -> Dict[str, Any]:
        """获取K线数据
        
        Args:
            ts_code: 股票代码
            period: 周期 daily/weekly/monthly/60/30/15/5/1
            start_date: 开始日期
            end_date: 结束日期
            source: 数据源
            limit: 数据条数限制
            
        Returns:
            包含K线数据和元信息的字典
        """
        source = source or self._default_source
        
        # 分钟级别K线只能用东方财富
        if period in ("1", "5", "15", "30", "60"):
            source = DataSource.EASTMONEY
        
        fallback_sources = self._get_fallback_sources(source)
        
        # 尝试主数据源
        try:
            klines = await self._fetch_kline_from_source(
                source, ts_code, period, start_date, end_date, limit
            )
            if klines:
                return {
                    "ts_code": ts_code,
                    "source": source.value,
                    "period": period,
                    "data": klines
                }
        except Exception as e:
            logger.warning(f"获取K线失败 (source={source}): {e}")
        
        # 尝试备用数据源
        for fallback in fallback_sources:
            try:
                logger.info(f"尝试备用数据源获取K线: {fallback}")
                klines = await self._fetch_kline_from_source(
                    fallback, ts_code, period, start_date, end_date, limit
                )
                if klines:
                    return {
                        "ts_code": ts_code,
                        "source": fallback.value,
                        "period": period,
                        "data": klines
                    }
            except Exception as e:
                logger.warning(f"备用数据源K线获取失败 (source={fallback}): {e}")
                continue
        
        # 所有数据源都失败
        logger.error(f"所有数据源都无法获取K线数据: {ts_code}")
        return {
            "ts_code": ts_code,
            "source": source.value,
            "period": period,
            "data": [],
            "error": "所有数据源都无法获取数据"
        }
    
    async def _fetch_kline_from_source(
        self,
        source: DataSource,
        ts_code: str,
        period: str,
        start_date: Optional[str],
        end_date: Optional[str],
        limit: int
    ) -> List[Dict]:
        """从指定数据源获取K线数据"""
        if source == DataSource.EASTMONEY:
            return await self.akshare.get_kline_eastmoney(
                ts_code, period, start_date, end_date, limit
            )
        elif source == DataSource.SINA:
            return await self.akshare.get_kline_sina(ts_code, period, limit)
        elif source == DataSource.TUSHARE:
            return await self.tushare.get_daily_kline(
                ts_code, period, start_date, end_date
            )
        return []
    
    async def get_realtime_quote(
        self,
        ts_code: str,
        source: Optional[DataSource] = None
    ) -> Optional[Dict]:
        """获取实时行情
        
        Args:
            ts_code: 股票代码
            source: 数据源
        """
        source = source or self._default_source
        fallback_sources = self._get_fallback_sources(source)
        
        # 尝试主数据源
        try:
            quote = await self._fetch_quote_from_source(source, ts_code)
            if quote:
                return quote
        except Exception as e:
            logger.warning(f"获取实时行情失败 (source={source}): {e}")
        
        # 尝试备用数据源
        for fallback in fallback_sources:
            try:
                logger.info(f"尝试备用数据源获取行情: {fallback}")
                quote = await self._fetch_quote_from_source(fallback, ts_code)
                if quote:
                    return quote
            except Exception as e:
                logger.warning(f"备用数据源行情获取失败 (source={fallback}): {e}")
                continue
        
        return None
    
    async def _fetch_quote_from_source(
        self,
        source: DataSource,
        ts_code: str
    ) -> Optional[Dict]:
        """从指定数据源获取实时行情"""
        if source == DataSource.EASTMONEY:
            return await self.akshare.get_realtime_quote_eastmoney(ts_code)
        elif source == DataSource.SINA:
            return await self.akshare.get_realtime_quote_sina(ts_code)
        elif source == DataSource.TUSHARE:
            return await self.tushare.get_realtime_quote(ts_code)
        return None
    
    async def get_stock_info(
        self,
        ts_code: str,
        source: Optional[DataSource] = None
    ) -> Dict:
        """获取股票基本信息"""
        source = source or self._default_source
        
        try:
            # 优先使用Tushare获取股票信息（信息更全面）
            return await self.tushare.get_stock_info(ts_code)
        except Exception as e:
            logger.error(f"获取股票信息失败: {e}")
            return {"ts_code": ts_code, "name": ts_code}
    
    async def get_market_overview(self) -> Dict:
        """获取市场概览（大盘指数）"""
        try:
            return await self.akshare.get_market_overview()
        except Exception as e:
            logger.error(f"获取市场概览失败: {e}")
            return {"indices": []}
    
    async def get_index_kline(
        self,
        index_code: str,
        period: str = "daily",
        limit: int = 500
    ) -> List[Dict]:
        """获取指数K线"""
        try:
            return await self.akshare.get_index_kline(index_code, period, limit)
        except Exception as e:
            logger.error(f"获取指数K线失败: {e}")
            return []
    
    def get_available_sources(self) -> List[Dict]:
        """获取可用的数据源列表 - 按优先级排序"""
        return [
            {
                "id": DataSource.EASTMONEY.value,
                "name": "东方财富",
                "description": "AKShare免费数据，支持分钟K线（推荐）",
                "features": ["股票列表", "多周期K线", "实时行情", "指数数据", "市场概览"],
                "periods": ["1", "5", "15", "30", "60", "daily", "weekly", "monthly"],
                "recommended": True,
            },
            {
                "id": DataSource.SINA.value,
                "name": "新浪财经",
                "description": "AKShare免费数据（备用）",
                "features": ["K线数据", "实时行情"],
                "periods": ["5", "15", "30", "60", "daily", "weekly", "monthly"],
                "recommended": False,
            },
            {
                "id": DataSource.TUSHARE.value,
                "name": "Tushare Pro",
                "description": "专业金融数据接口，需要Token",
                "features": ["股票列表", "日/周/月K线", "实时行情", "股票基本信息"],
                "periods": ["daily", "weekly", "monthly"],
                "recommended": False,
            },
        ]
    
    def get_default_source(self) -> str:
        """获取默认数据源"""
        return self._default_source.value


# 创建全局实例
data_source_manager = DataSourceManager()
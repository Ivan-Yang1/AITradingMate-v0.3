"""股票搜索服务 - 支持全市场股票搜索"""
import httpx
from typing import List, Dict, Optional
import logging
import os

logger = logging.getLogger(__name__)

# 东方财富搜索API
EASTMONEY_SEARCH_API = "https://searchapi.eastmoney.com/api/suggest/get"
# 东方财富股票列表API
EASTMONEY_LIST_API = "https://push2delay.eastmoney.com/api/qt/clist/get"


class StockSearchService:
    """股票搜索服务 - 使用东方财富API实现全市场搜索"""
    
    # 完整的A股列表（用于本地搜索）
    FULL_STOCK_LIST = [
        # 沪市主板热门
        {"ts_code": "600519.SH", "symbol": "600519", "name": "贵州茅台", "market": "沪市主板"},
        {"ts_code": "601318.SH", "symbol": "601318", "name": "中国平安", "market": "沪市主板"},
        {"ts_code": "600036.SH", "symbol": "600036", "name": "招商银行", "market": "沪市主板"},
        {"ts_code": "601012.SH", "symbol": "601012", "name": "隆基绿能", "market": "沪市主板"},
        {"ts_code": "600900.SH", "symbol": "600900", "name": "长江电力", "market": "沪市主板"},
        {"ts_code": "601166.SH", "symbol": "601166", "name": "兴业银行", "market": "沪市主板"},
        {"ts_code": "600276.SH", "symbol": "600276", "name": "恒瑞医药", "market": "沪市主板"},
        {"ts_code": "601888.SH", "symbol": "601888", "name": "中国中免", "market": "沪市主板"},
        {"ts_code": "600030.SH", "symbol": "600030", "name": "中信证券", "market": "沪市主板"},
        {"ts_code": "600809.SH", "symbol": "600809", "name": "山西汾酒", "market": "沪市主板"},
        {"ts_code": "600887.SH", "symbol": "600887", "name": "伊利股份", "market": "沪市主板"},
        {"ts_code": "601398.SH", "symbol": "601398", "name": "工商银行", "market": "沪市主板"},
        {"ts_code": "601288.SH", "symbol": "601288", "name": "农业银行", "market": "沪市主板"},
        {"ts_code": "601939.SH", "symbol": "601939", "name": "建设银行", "market": "沪市主板"},
        {"ts_code": "601988.SH", "symbol": "601988", "name": "中国银行", "market": "沪市主板"},
        {"ts_code": "600000.SH", "symbol": "600000", "name": "浦发银行", "market": "沪市主板"},
        {"ts_code": "600016.SH", "symbol": "600016", "name": "民生银行", "market": "沪市主板"},
        {"ts_code": "600015.SH", "symbol": "600015", "name": "华夏银行", "market": "沪市主板"},
        {"ts_code": "601628.SH", "symbol": "601628", "name": "中国人寿", "market": "沪市主板"},
        {"ts_code": "601601.SH", "symbol": "601601", "name": "中国太保", "market": "沪市主板"},
        {"ts_code": "600048.SH", "symbol": "600048", "name": "保利发展", "market": "沪市主板"},
        {"ts_code": "600028.SH", "symbol": "600028", "name": "中国石化", "market": "沪市主板"},
        {"ts_code": "601857.SH", "symbol": "601857", "name": "中国石油", "market": "沪市主板"},
        {"ts_code": "600585.SH", "symbol": "600585", "name": "海螺水泥", "market": "沪市主板"},
        {"ts_code": "600690.SH", "symbol": "600690", "name": "海尔智家", "market": "沪市主板"},
        # 深市主板热门
        {"ts_code": "000001.SZ", "symbol": "000001", "name": "平安银行", "market": "深市主板"},
        {"ts_code": "000858.SZ", "symbol": "000858", "name": "五粮液", "market": "深市主板"},
        {"ts_code": "000333.SZ", "symbol": "000333", "name": "美的集团", "market": "深市主板"},
        {"ts_code": "000651.SZ", "symbol": "000651", "name": "格力电器", "market": "深市主板"},
        {"ts_code": "000568.SZ", "symbol": "000568", "name": "泸州老窖", "market": "深市主板"},
        {"ts_code": "000725.SZ", "symbol": "000725", "name": "京东方A", "market": "深市主板"},
        {"ts_code": "000002.SZ", "symbol": "000002", "name": "万科A", "market": "深市主板"},
        {"ts_code": "000063.SZ", "symbol": "000063", "name": "中兴通讯", "market": "深市主板"},
        {"ts_code": "000100.SZ", "symbol": "000100", "name": "TCL科技", "market": "深市主板"},
        {"ts_code": "000776.SZ", "symbol": "000776", "name": "广发证券", "market": "深市主板"},
        # 中小板热门
        {"ts_code": "002594.SZ", "symbol": "002594", "name": "比亚迪", "market": "中小板"},
        {"ts_code": "002415.SZ", "symbol": "002415", "name": "海康威视", "market": "中小板"},
        {"ts_code": "002352.SZ", "symbol": "002352", "name": "顺丰控股", "market": "中小板"},
        {"ts_code": "002475.SZ", "symbol": "002475", "name": "立讯精密", "market": "中小板"},
        {"ts_code": "002714.SZ", "symbol": "002714", "name": "牧原股份", "market": "中小板"},
        {"ts_code": "002304.SZ", "symbol": "002304", "name": "洋河股份", "market": "中小板"},
        {"ts_code": "002142.SZ", "symbol": "002142", "name": "宁波银行", "market": "中小板"},
        {"ts_code": "002230.SZ", "symbol": "002230", "name": "科大讯飞", "market": "中小板"},
        {"ts_code": "002027.SZ", "symbol": "002027", "name": "分众传媒", "market": "中小板"},
        {"ts_code": "002050.SZ", "symbol": "002050", "name": "三花智控", "market": "中小板"},
        # 创业板热门
        {"ts_code": "300750.SZ", "symbol": "300750", "name": "宁德时代", "market": "创业板"},
        {"ts_code": "300059.SZ", "symbol": "300059", "name": "东方财富", "market": "创业板"},
        {"ts_code": "300760.SZ", "symbol": "300760", "name": "迈瑞医疗", "market": "创业板"},
        {"ts_code": "300124.SZ", "symbol": "300124", "name": "汇川技术", "market": "创业板"},
        {"ts_code": "300274.SZ", "symbol": "300274", "name": "阳光电源", "market": "创业板"},
        {"ts_code": "300015.SZ", "symbol": "300015", "name": "爱尔眼科", "market": "创业板"},
        {"ts_code": "300014.SZ", "symbol": "300014", "name": "亿纬锂能", "market": "创业板"},
        {"ts_code": "300122.SZ", "symbol": "300122", "name": "智飞生物", "market": "创业板"},
        {"ts_code": "300033.SZ", "symbol": "300033", "name": "同花顺", "market": "创业板"},
        {"ts_code": "300413.SZ", "symbol": "300413", "name": "芒果超媒", "market": "创业板"},
        {"ts_code": "300142.SZ", "symbol": "300142", "name": "沃森生物", "market": "创业板"},
        {"ts_code": "300498.SZ", "symbol": "300498", "name": "温氏股份", "market": "创业板"},
        {"ts_code": "300308.SZ", "symbol": "300308", "name": "中际旭创", "market": "创业板"},
        {"ts_code": "300782.SZ", "symbol": "300782", "name": "卓胜微", "market": "创业板"},
        {"ts_code": "300999.SZ", "symbol": "300999", "name": "金龙鱼", "market": "创业板"},
        # 科创板热门
        {"ts_code": "688981.SH", "symbol": "688981", "name": "中芯国际", "market": "科创板"},
        {"ts_code": "688111.SH", "symbol": "688111", "name": "金山办公", "market": "科创板"},
        {"ts_code": "688036.SH", "symbol": "688036", "name": "传音控股", "market": "科创板"},
        {"ts_code": "688012.SH", "symbol": "688012", "name": "中微公司", "market": "科创板"},
        {"ts_code": "688009.SH", "symbol": "688009", "name": "中国通号", "market": "科创板"},
        {"ts_code": "688005.SH", "symbol": "688005", "name": "容百科技", "market": "科创板"},
        {"ts_code": "688169.SH", "symbol": "688169", "name": "石头科技", "market": "科创板"},
        {"ts_code": "688185.SH", "symbol": "688185", "name": "康希诺", "market": "科创板"},
        {"ts_code": "688256.SH", "symbol": "688256", "name": "寒武纪", "market": "科创板"},
        {"ts_code": "688396.SH", "symbol": "688396", "name": "华润微", "market": "科创板"},
    ]
    
    def __init__(self):
        self._cache = None
        self._all_stocks_cache = None
        self.timeout = 15.0
        logger.info("StockSearchService initialized")
    
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
                logger.debug(f"Cache hit: {cache_key}")
                return cached
        except Exception as e:
            logger.warning(f"Cache get failed: {e}")
        return None
    
    async def _set_to_cache(self, cache_key: str, data: List[Dict], ttl: int = 300) -> bool:
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
    
    def _convert_to_ts_code(self, code: str, market: int) -> str:
        """将东方财富的代码格式转换为ts_code格式"""
        if market == 1:
            return f"{code}.SH"
        else:
            return f"{code}.SZ"
    
    def _get_market_name(self, code: str, market: int) -> str:
        """获取市场名称"""
        if market == 1:
            if code.startswith("688"):
                return "科创板"
            return "沪市主板"
        else:
            if code.startswith("300") or code.startswith("301"):
                return "创业板"
            elif code.startswith("002"):
                return "中小板"
            return "深市主板"
    
    def _calculate_match_score(self, stock: Dict, keyword: str) -> int:
        """计算匹配分数，分数越高匹配度越高
        
        匹配优先级：
        1. 名称完全匹配 (100分)
        2. 代码完全匹配 (90分)
        3. 名称以关键词开头 (80分)
        4. 代码以关键词开头 (70分)
        5. 名称包含关键词 (60分)
        6. 代码包含关键词 (50分)
        """
        name = stock.get("name", "")
        code = stock.get("symbol", "")
        ts_code = stock.get("ts_code", "")
        keyword_lower = keyword.lower()
        
        # 完全匹配
        if name == keyword:
            return 100
        if code == keyword or ts_code.upper() == keyword.upper():
            return 90
        
        # 开头匹配
        if name.startswith(keyword):
            return 80
        if code.startswith(keyword) or ts_code.upper().startswith(keyword.upper()):
            return 70
        
        # 包含匹配
        if keyword in name:
            return 60
        if keyword_lower in code.lower() or keyword_lower in ts_code.lower():
            return 50
        
        return 0
    
    async def search_stocks(self, keyword: str, limit: int = 50) -> List[Dict]:
        """搜索股票"""
        if not keyword or not keyword.strip():
            return await self.get_hot_stocks(limit)
        
        keyword = keyword.strip()
        cache_key = f"stock_search:{keyword}:{limit}"
        
        # 尝试从缓存获取
        cached = await self._get_from_cache(cache_key)
        if cached:
            return cached
        
        all_results = []
        existing_codes = set()
        
        # 方法1: 先从本地列表搜索（保证基础股票能搜到）
        local_results = self._search_local(keyword, limit * 2)
        for s in local_results:
            if s['ts_code'] not in existing_codes:
                s['_score'] = self._calculate_match_score(s, keyword)
                all_results.append(s)
                existing_codes.add(s['ts_code'])
        
        # 方法2: 使用东方财富搜索API补充
        try:
            api_results = await self._search_eastmoney(keyword, limit * 2)
            for s in api_results:
                if s['ts_code'] not in existing_codes:
                    s['_score'] = self._calculate_match_score(s, keyword)
                    all_results.append(s)
                    existing_codes.add(s['ts_code'])
        except Exception as e:
            logger.error(f"东方财富搜索失败: {e}")
        
        # 方法3: 从全量列表补充搜索
        if len(all_results) < limit:
            try:
                all_stocks = await self._get_all_stocks()
                for s in all_stocks:
                    if s['ts_code'] in existing_codes:
                        continue
                    score = self._calculate_match_score(s, keyword)
                    if score > 0:
                        s_copy = s.copy()
                        s_copy['_score'] = score
                        all_results.append(s_copy)
                        existing_codes.add(s['ts_code'])
            except Exception as e:
                logger.error(f"全量列表搜索失败: {e}")
        
        # 按匹配分数排序，分数高的排前面
        all_results.sort(key=lambda x: x.get('_score', 0), reverse=True)
        
        # 移除临时的分数字段
        for s in all_results:
            s.pop('_score', None)
        
        # 取前limit个结果
        stocks = all_results[:limit]
        
        # 缓存结果
        if stocks:
            await self._set_to_cache(cache_key, stocks, ttl=300)
        
        logger.info(f"搜索 '{keyword}' 返回 {len(stocks)} 条结果")
        return stocks
    
    def _search_local(self, keyword: str, limit: int = 50) -> List[Dict]:
        """从本地列表搜索"""
        keyword_lower = keyword.lower()
        matched = []
        
        for stock in self.FULL_STOCK_LIST:
            code = stock.get("symbol", "")
            name = stock.get("name", "")
            ts_code = stock.get("ts_code", "")
            
            # 检查是否匹配
            if (keyword_lower in code.lower() or 
                keyword_lower in ts_code.lower() or 
                keyword in name or
                name == keyword or  # 精确匹配名称
                code == keyword):   # 精确匹配代码
                matched.append(stock.copy())
                if len(matched) >= limit:
                    break
        
        return matched
    
    async def _search_eastmoney(self, keyword: str, limit: int = 50) -> List[Dict]:
        """使用东方财富搜索API搜索股票"""
        try:
            params = {
                "input": keyword,
                "type": "14",
                "token": os.environ.get("EASTMONEY_TOKEN", "D43BF722C8E33BDC906FB84D85E326E8"),
                "count": str(min(limit * 2, 100))
            }
            
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                response = await client.get(EASTMONEY_SEARCH_API, params=params)
                data = response.json()
                
                stocks = []
                if data.get("QuotationCodeTable") and data["QuotationCodeTable"].get("Data"):
                    for item in data["QuotationCodeTable"]["Data"]:
                        code = item.get("Code", "")
                        name = item.get("Name", "")
                        market_type = item.get("MktNum", "")
                        security_type = item.get("SecurityType", "")
                        
                        if security_type not in ("1", 1):
                            continue
                        
                        if not self._is_a_stock(code):
                            continue
                        
                        if market_type in ("SH", "1", 1):
                            market = 1
                        elif market_type in ("SZ", "0", 0):
                            market = 0
                        else:
                            market = self._guess_market(code)
                        
                        ts_code = self._convert_to_ts_code(code, market)
                        market_name = self._get_market_name(code, market)
                        
                        stocks.append({
                            "ts_code": ts_code,
                            "symbol": code,
                            "name": name,
                            "market": market_name,
                            "industry": item.get("Industry", ""),
                        })
                        
                        if len(stocks) >= limit:
                            break
                
                return stocks
                
        except Exception as e:
            logger.error(f"东方财富搜索API失败: {e}")
            return []
    
    async def _get_all_stocks(self) -> List[Dict]:
        """获取所有A股列表"""
        if self._all_stocks_cache:
            return self._all_stocks_cache
        
        cache_key = "all_a_stocks"
        cached = await self._get_from_cache(cache_key)
        if cached:
            self._all_stocks_cache = cached
            return cached
        
        stocks = []
        
        try:
            # 分别获取沪深两市股票
            for fs in ["m:1+t:2,m:1+t:23", "m:0+t:6,m:0+t:80,m:0+t:81"]:
                params = {
                    "pn": 1,
                    "pz": 3000,
                    "po": 1,
                    "np": 1,
                    "fltt": 2,
                    "invt": 2,
                    "fid": "f12",
                    "fs": fs,
                    "fields": "f12,f13,f14",
                }
                
                async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                    response = await client.get(EASTMONEY_LIST_API, params=params)
                    data = response.json()
                    
                    if data.get("data") and data["data"].get("diff"):
                        for item in data["data"]["diff"]:
                            code = str(item.get("f12", ""))
                            market = item.get("f13", 0)
                            name = item.get("f14", "")
                            
                            if not code or not name or len(code) != 6:
                                continue
                            
                            # 过滤非A股代码
                            if not self._is_a_stock(code):
                                continue
                            
                            ts_code = self._convert_to_ts_code(code, market)
                            market_name = self._get_market_name(code, market)
                            
                            stocks.append({
                                "ts_code": ts_code,
                                "symbol": code,
                                "name": name,
                                "market": market_name,
                            })
            
            logger.info(f"获取到 {len(stocks)} 只A股")
            
            if stocks:
                self._all_stocks_cache = stocks
                await self._set_to_cache(cache_key, stocks, ttl=86400)
            
            return stocks
            
        except Exception as e:
            logger.error(f"获取A股列表失败: {e}")
            return self.FULL_STOCK_LIST
    
    async def get_hot_stocks(self, limit: int = 20) -> List[Dict]:
        """获取热门股票"""
        cache_key = f"hot_stocks:{limit}"
        
        cached = await self._get_from_cache(cache_key)
        if cached:
            return cached
        
        try:
            params = {
                "pn": 1,
                "pz": limit + 10,
                "po": 1,
                "np": 1,
                "fltt": 2,
                "invt": 2,
                "fid": "f3",
                "fs": "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23",
                "fields": "f12,f13,f14,f2,f3",
            }
            
            async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
                response = await client.get(EASTMONEY_LIST_API, params=params)
                data = response.json()
                
                stocks = []
                if data.get("data") and data["data"].get("diff"):
                    for item in data["data"]["diff"]:
                        code = str(item.get("f12", ""))
                        market = item.get("f13", 0)
                        name = item.get("f14", "")
                        
                        if not code or not name or len(code) != 6:
                            continue
                        
                        if not self._is_a_stock(code):
                            continue
                        
                        ts_code = self._convert_to_ts_code(code, market)
                        market_name = self._get_market_name(code, market)
                        
                        stocks.append({
                            "ts_code": ts_code,
                            "symbol": code,
                            "name": name,
                            "market": market_name,
                            "price": item.get("f2"),
                            "pct_chg": item.get("f3"),
                        })
                        
                        if len(stocks) >= limit:
                            break
                
                if stocks:
                    await self._set_to_cache(cache_key, stocks, ttl=300)
                    return stocks
                
        except Exception as e:
            logger.error(f"获取热门股票失败: {e}")
        
        return self.FULL_STOCK_LIST[:limit]
    
    def _is_a_stock(self, code: str) -> bool:
        """判断是否为A股代码"""
        if not code or len(code) != 6:
            return False
        
        prefixes = ('600', '601', '603', '605', '688', '689', 
                   '000', '001', '002', '003', '300', '301')
        return code.startswith(prefixes)
    
    def _guess_market(self, code: str) -> int:
        """根据代码猜测市场"""
        if code.startswith(('600', '601', '603', '605', '688', '689')):
            return 1
        return 0


# 创建服务实例
stock_search_service = StockSearchService()
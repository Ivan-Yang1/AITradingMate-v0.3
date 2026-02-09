import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Star, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { client } from '@/lib/api';
import { StockSearchSkeleton } from '@/components/Skeleton';

interface Stock {
  ts_code: string;
  symbol?: string;
  name: string;
  industry?: string;
  market?: string;
}

interface StockSearchProps {
  onSelectStock: (stock: Stock) => void;
  onAddToWatchList?: (stock: Stock) => void;
  onRemoveFromWatchList?: (tsCode: string) => void;
  selectedStock?: Stock | null;
  watchList?: Stock[];
  placeholder?: string;
}

// 本地搜索缓存
const searchCache = new Map<string, { data: Stock[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

// 热门股票列表（扩展版，用于快速显示和本地搜索）
const HOT_STOCKS: Stock[] = [
  { ts_code: "600519.SH", name: "贵州茅台", market: "沪市主板" },
  { ts_code: "000001.SZ", name: "平安银行", market: "深市主板" },
  { ts_code: "300750.SZ", name: "宁德时代", market: "创业板" },
  { ts_code: "601318.SH", name: "中国平安", market: "沪市主板" },
  { ts_code: "000858.SZ", name: "五粮液", market: "深市主板" },
  { ts_code: "002594.SZ", name: "比亚迪", market: "中小板" },
  { ts_code: "600036.SH", name: "招商银行", market: "沪市主板" },
  { ts_code: "000333.SZ", name: "美的集团", market: "深市主板" },
  { ts_code: "601012.SH", name: "隆基绿能", market: "沪市主板" },
  { ts_code: "600900.SH", name: "长江电力", market: "沪市主板" },
  { ts_code: "000651.SZ", name: "格力电器", market: "深市主板" },
  { ts_code: "600276.SH", name: "恒瑞医药", market: "沪市主板" },
  { ts_code: "601888.SH", name: "中国中免", market: "沪市主板" },
  { ts_code: "600030.SH", name: "中信证券", market: "沪市主板" },
  { ts_code: "300059.SZ", name: "东方财富", market: "创业板" },
  { ts_code: "002415.SZ", name: "海康威视", market: "中小板" },
  { ts_code: "688981.SH", name: "中芯国际", market: "科创板" },
  { ts_code: "000568.SZ", name: "泸州老窖", market: "深市主板" },
  { ts_code: "600809.SH", name: "山西汾酒", market: "沪市主板" },
  { ts_code: "300760.SZ", name: "迈瑞医疗", market: "创业板" },
];

// 计算匹配分数
const calculateMatchScore = (stock: Stock, keyword: string): number => {
  const name = stock.name || "";
  const code = stock.ts_code.split('.')[0] || "";
  const tsCode = stock.ts_code || "";
  const keywordLower = keyword.toLowerCase();
  
  // 完全匹配
  if (name === keyword) return 100;
  if (code === keyword || tsCode.toUpperCase() === keyword.toUpperCase()) return 90;
  
  // 开头匹配
  if (name.startsWith(keyword)) return 80;
  if (code.startsWith(keyword) || tsCode.toUpperCase().startsWith(keyword.toUpperCase())) return 70;
  
  // 包含匹配
  if (name.includes(keyword)) return 60;
  if (code.toLowerCase().includes(keywordLower) || tsCode.toLowerCase().includes(keywordLower)) return 50;
  
  return 0;
};

export default function StockSearch({ 
  onSelectStock, 
  onAddToWatchList,
  onRemoveFromWatchList,
  selectedStock,
  watchList = [],
  placeholder = "搜索股票代码或名称..." 
}: StockSearchProps) {
  const [keyword, setKeyword] = useState('');
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showHotStocks, setShowHotStocks] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check if a stock is in watchlist
  const isInWatchList = useCallback((tsCode: string) => {
    return watchList.some(s => s.ts_code === tsCode);
  }, [watchList]);

  // 本地过滤搜索（快速响应，带排序）
  const localSearch = useCallback((query: string): Stock[] => {
    if (!query.trim()) return [];
    
    const results: Array<Stock & { _score: number }> = [];
    
    for (const stock of HOT_STOCKS) {
      const score = calculateMatchScore(stock, query);
      if (score > 0) {
        results.push({ ...stock, _score: score });
      }
    }
    
    // 按分数排序
    results.sort((a, b) => b._score - a._score);
    
    // 移除分数字段并返回
    return results.map(({ _score, ...stock }) => stock);
  }, []);

  // 从缓存获取
  const getFromCache = useCallback((key: string): Stock[] | null => {
    const cached = searchCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    return null;
  }, []);

  // 存入缓存
  const setToCache = useCallback((key: string, data: Stock[]) => {
    searchCache.set(key, { data, timestamp: Date.now() });
    // 限制缓存大小
    if (searchCache.size > 100) {
      const firstKey = searchCache.keys().next().value;
      if (firstKey) searchCache.delete(firstKey);
    }
  }, []);

  useEffect(() => {
    const searchStocks = async () => {
      const trimmedKeyword = keyword.trim();
      
      if (!trimmedKeyword) {
        setStocks([]);
        return;
      }

      // 1. 先显示本地搜索结果（即时响应）
      const localResults = localSearch(trimmedKeyword);
      if (localResults.length > 0) {
        setStocks(localResults);
      }

      // 2. 检查缓存
      const cacheKey = `search:${trimmedKeyword}`;
      const cachedResults = getFromCache(cacheKey);
      if (cachedResults) {
        setStocks(cachedResults);
        return;
      }

      // 3. 取消之前的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setLoading(true);
      try {
        const response = await client.apiCall.invoke({
          url: '/api/v1/tushare/stocks',
          method: 'GET',
          data: { keyword: trimmedKeyword }
        });
        
        const results = response.data?.stocks || [];
        setStocks(results);
        
        // 存入缓存
        if (results.length > 0) {
          setToCache(cacheKey, results);
        }
      } catch (error) {
        // 如果是取消的请求，不处理
        if ((error as Error).name === 'AbortError') return;
        console.error('搜索股票失败:', error);
        // 保留本地搜索结果
        if (localResults.length === 0) {
          setStocks([]);
        }
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchStocks, 200); // 减少防抖时间
    return () => {
      clearTimeout(debounce);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [keyword, localSearch, getFromCache, setToCache]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setShowHotStocks(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback((stock: Stock) => {
    onSelectStock(stock);
    setKeyword('');
    setShowDropdown(false);
    setShowHotStocks(false);
  }, [onSelectStock]);

  const handleToggleWatchList = useCallback((e: React.MouseEvent, stock: Stock) => {
    e.stopPropagation();
    if (isInWatchList(stock.ts_code)) {
      onRemoveFromWatchList?.(stock.ts_code);
    } else {
      onAddToWatchList?.(stock);
    }
  }, [isInWatchList, onAddToWatchList, onRemoveFromWatchList]);

  // Handle toggle for selected stock display
  const handleToggleSelectedStock = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedStock) return;
    
    if (isInWatchList(selectedStock.ts_code)) {
      onRemoveFromWatchList?.(selectedStock.ts_code);
    } else {
      onAddToWatchList?.(selectedStock);
    }
  }, [selectedStock, isInWatchList, onAddToWatchList, onRemoveFromWatchList]);

  const handleFocus = useCallback(() => {
    setShowDropdown(true);
    if (!keyword.trim()) {
      setShowHotStocks(true);
    }
  }, [keyword]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setKeyword(e.target.value);
    setShowDropdown(true);
    setShowHotStocks(!e.target.value.trim());
  }, []);

  const handleClear = useCallback(() => {
    setKeyword('');
    setStocks([]);
    setShowHotStocks(true);
  }, []);

  // 渲染股票列表项
  const renderStockItem = useCallback((stock: Stock) => {
    const inWatchList = isInWatchList(stock.ts_code);
    return (
      <li
        key={stock.ts_code}
        onClick={() => handleSelect(stock)}
        className="px-4 py-3 hover:bg-[#2D2D3A] cursor-pointer border-b border-[#2D2D3A] last:border-b-0 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => handleToggleWatchList(e, stock)}
              className={`h-7 w-7 p-0 transition-colors ${
                inWatchList
                  ? 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10'
                  : 'text-gray-500 hover:text-yellow-400 hover:bg-yellow-400/10'
              }`}
              title={inWatchList ? '从自选中移除' : '加入自选'}
            >
              <Star 
                className="h-4 w-4" 
                fill={inWatchList ? 'currentColor' : 'none'}
              />
            </Button>
            <span className="text-white font-medium">{stock.name}</span>
            <span className="text-[#00D4AA] text-sm font-mono">{stock.ts_code}</span>
          </div>
          <span className="text-gray-500 text-xs">{stock.industry || stock.market}</span>
        </div>
      </li>
    );
  }, [isInWatchList, handleSelect, handleToggleWatchList]);

  return (
    <div className="bg-[#1A1A2E] rounded-xl p-4 border border-[#2D2D3A]">
      <div className="flex items-center gap-4">
        {/* Current Stock Display */}
        {selectedStock && (
          <div className="flex items-center gap-2 px-4 py-2 bg-[#0A0A0F] rounded-lg border border-[#2D2D3A]">
            <button
              onClick={handleToggleSelectedStock}
              className={`transition-colors ${
                isInWatchList(selectedStock.ts_code)
                  ? 'text-yellow-400 hover:text-yellow-300'
                  : 'text-gray-500 hover:text-yellow-400'
              }`}
              title={isInWatchList(selectedStock.ts_code) ? '从自选中移除' : '加入自选'}
            >
              <Star 
                className="h-4 w-4" 
                fill={isInWatchList(selectedStock.ts_code) ? 'currentColor' : 'none'}
              />
            </button>
            <span className="text-white font-medium">{selectedStock.name}</span>
            <span className="text-[#00D4AA] text-sm font-mono">{selectedStock.ts_code}</span>
          </div>
        )}

        {/* Search Input */}
        <div className="relative flex-1" ref={dropdownRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              value={keyword}
              onChange={handleInputChange}
              onFocus={handleFocus}
              placeholder={placeholder}
              className="pl-10 pr-10 bg-[#0A0A0F] border-[#2D2D3A] text-white placeholder:text-gray-500 focus:border-[#00D4AA] focus:ring-[#00D4AA]/20"
            />
            {keyword ? (
              <button
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            ) : loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#00D4AA] animate-spin" />
            )}
          </div>

          {showDropdown && (keyword || showHotStocks) && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#1A1A2E] border border-[#2D2D3A] rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
              {loading && stocks.length === 0 ? (
                <StockSearchSkeleton />
              ) : stocks.length > 0 ? (
                <ul>
                  {stocks.map(renderStockItem)}
                </ul>
              ) : showHotStocks && !keyword ? (
                <div>
                  <div className="px-4 py-2 text-xs text-gray-500 border-b border-[#2D2D3A]">
                    热门股票
                  </div>
                  <ul>
                    {HOT_STOCKS.slice(0, 8).map(renderStockItem)}
                  </ul>
                </div>
              ) : keyword ? (
                <div className="p-4 text-center text-gray-400">
                  <p>未找到相关股票</p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
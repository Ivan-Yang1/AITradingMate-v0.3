import { useState, useEffect, lazy, Suspense, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import StockSearch from '@/components/StockSearch';
import ComponentLoading from '@/components/ComponentLoading';
import DataSourceSelector, { DEFAULT_SOURCE } from '@/components/DataSourceSelector';
import { client } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useTradingState } from '@/contexts/TradingStateContext';
import { useToast } from '@/hooks/use-toast';
import { Brain, Search, TrendingUp } from 'lucide-react';
import { syncWatchlistAdd } from '@/components/WatchList';

// 懒加载大型组件
const KLineChart = lazy(() => import('@/components/KLineChart'));
const LeftSidebar = lazy(() => import('@/components/LeftSidebar'));
const AIChatSidebar = lazy(() => import('@/components/AIChatSidebar'));
const ScriptMonitorPanel = lazy(() => import('@/components/ScriptMonitorPanel'));

interface StockInfo {
  ts_code: string;
  name: string;
}

interface KLineData {
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
  amount: number;
  pct_chg: number;
}

interface MarketIndex {
  ts_code: string;
  name: string;
  close: number;
  change: number;
  pct_chg: number;
}

// 数据源名称映射
const DATA_SOURCE_NAMES: Record<string, string> = {
  eastmoney: '东方财富',
  sina: '新浪财经',
  tushare: 'Tushare Pro',
};

// 热门股票列表 - 移到组件外避免重复创建
const POPULAR_STOCKS = [
  { ts_code: '000001.SZ', name: '平安银行' },
  { ts_code: '600519.SH', name: '贵州茅台' },
  { ts_code: '300750.SZ', name: '宁德时代' },
  { ts_code: '601318.SH', name: '中国平安' },
  { ts_code: '000858.SZ', name: '五粮液' },
];

// 监控关键词列表
const MONITOR_KEYWORDS = ['通知', '提醒', '监控', '告警', '预警', '金叉', '死叉', '突破', '超买', '超卖'];

export default function Trading() {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  
  // 使用持久化状态
  const {
    state: tradingState,
    setSelectedStock,
    setKlineData,
    setPeriod,
    setDataSource,
    setAiSidebarOpen,
    setShowScriptPanel,
    setLatestUserInput,
  } = useTradingState();

  // 从持久化状态中获取值
  const selectedStock = tradingState.selectedStock;
  const klineData = tradingState.klineData as KLineData[];
  const period = tradingState.period;
  const dataSource = tradingState.dataSource || DEFAULT_SOURCE;
  const aiSidebarOpen = tradingState.aiSidebarOpen;
  const showScriptPanel = tradingState.showScriptPanel;
  const latestUserInput = tradingState.latestUserInput;

  // 本地状态（不需要持久化）
  const [loading, setLoading] = useState(false);
  const [watchList, setWatchList] = useState<StockInfo[]>([]);
  const [marketIndices, setMarketIndices] = useState<MarketIndex[]>([]);

  // Load watchlist from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('watchList');
    if (saved) {
      try {
        setWatchList(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse watchlist:', e);
      }
    }
    // Fetch market overview
    fetchMarketOverview();
  }, []);

  // Save watchlist to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('watchList', JSON.stringify(watchList));
  }, [watchList]);

  // Fetch K-line data when stock, period, or data source changes
  useEffect(() => {
    if (selectedStock) {
      fetchKLineData(selectedStock.ts_code, period);
    }
  }, [selectedStock, period, dataSource]);

  // 检测用户输入是否包含监控意图
  useEffect(() => {
    const hasMonitorIntent = MONITOR_KEYWORDS.some(kw => latestUserInput.includes(kw));
    
    if (hasMonitorIntent && selectedStock) {
      setShowScriptPanel(true);
    }
  }, [latestUserInput, selectedStock, setShowScriptPanel]);

  const fetchMarketOverview = useCallback(async () => {
    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/data/market/overview',
        method: 'GET',
      });
      if (response.data?.indices) {
        setMarketIndices(response.data.indices);
      }
    } catch (error) {
      console.error('Failed to fetch market overview:', error);
    }
  }, []);

  const fetchKLineData = useCallback(async (tsCode: string, freq: string) => {
    setLoading(true);
    setKlineData([]); // Clear previous data
    try {
      // 根据数据源选择不同的API
      const periodMap: Record<string, string> = {
        'D': 'daily',
        'W': 'weekly',
        'M': 'monthly',
      };
      
      const response = await client.apiCall.invoke({
        url: '/api/v1/data/kline',
        method: 'GET',
        data: { 
          ts_code: tsCode, 
          period: periodMap[freq] || 'daily',
          source: dataSource,
          limit: 500
        }
      });
      
      // Handle response data - 统一数据格式
      if (response.data?.data && Array.isArray(response.data.data)) {
        // 转换为前端期望的格式
        const formattedData = response.data.data.map((item: any) => ({
          trade_date: item.date || item.trade_date,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
          vol: item.volume || item.vol,
          amount: item.amount,
          pct_chg: item.pct_chg,
        }));
        setKlineData(formattedData);
        
        // 显示数据源信息（如果自动切换了数据源）
        if (response.data.source && response.data.source !== dataSource) {
          const sourceName = DATA_SOURCE_NAMES[response.data.source] || response.data.source;
          toast({
            title: '数据源自动切换',
            description: `已自动切换到 ${sourceName} 获取数据`,
          });
        }
      } else {
        console.error('Invalid K-line data format:', response.data);
        setKlineData([]);
        // 显示错误信息
        if (response.data?.error) {
          toast({
            title: '获取数据失败',
            description: response.data.error,
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch K-line data:', error);
      setKlineData([]);
      toast({
        title: '获取数据失败',
        description: '请稍后重试或切换数据源',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [dataSource, setKlineData, toast]);

  const handleStockSelect = useCallback((stock: StockInfo) => {
    setSelectedStock(stock);
  }, [setSelectedStock]);

  const handleAddToWatchList = useCallback(async (stock: StockInfo) => {
    if (!watchList.find(s => s.ts_code === stock.ts_code)) {
      setWatchList(prev => [...prev, stock]);
      // Sync to cloud if authenticated
      await syncWatchlistAdd(stock, isAuthenticated);
      toast({
        title: '已添加',
        description: `${stock.name} 已加入自选股`,
      });
    }
  }, [watchList, isAuthenticated, toast]);

  const handleRemoveFromWatchList = useCallback(async (tsCode: string) => {
    const stock = watchList.find(s => s.ts_code === tsCode);
    setWatchList(prev => prev.filter(s => s.ts_code !== tsCode));
    
    // Sync remove from cloud if authenticated
    if (isAuthenticated) {
      try {
        const response = await client.entities.watchlists.query({
          query: { ts_code: tsCode },
          limit: 1,
        });
        if (response?.data?.items?.[0]) {
          await client.entities.watchlists.delete({
            id: response.data.items[0].id,
          });
        }
      } catch (error) {
        console.error('Failed to sync remove from cloud:', error);
      }
    }
    
    if (stock) {
      toast({
        title: '已移除',
        description: `${stock.name} 已从自选股移除`,
      });
    }
  }, [watchList, isAuthenticated, toast]);

  const handleWatchListChange = useCallback((newWatchList: StockInfo[]) => {
    setWatchList(newWatchList);
  }, []);

  const handleDataSourceChange = useCallback((source: string) => {
    setDataSource(source);
    const sourceName = DATA_SOURCE_NAMES[source] || source;
    toast({
      title: '数据源已切换',
      description: `当前使用: ${sourceName}`,
    });
  }, [setDataSource, toast]);

  const handlePeriodChange = useCallback((newPeriod: 'D' | 'W' | 'M') => {
    setPeriod(newPeriod);
  }, [setPeriod]);

  // 处理AI对话中的用户输入
  const handleUserInput = useCallback((input: string) => {
    setLatestUserInput(input);
  }, [setLatestUserInput]);

  const handleToggleAiSidebar = useCallback(() => {
    setAiSidebarOpen(!aiSidebarOpen);
  }, [aiSidebarOpen, setAiSidebarOpen]);

  const handleCloseScriptPanel = useCallback(() => {
    setShowScriptPanel(false);
  }, [setShowScriptPanel]);

  // 使用useMemo缓存市场指数显示
  const marketOverviewBar = useMemo(() => {
    if (marketIndices.length === 0) return null;
    
    return (
      <div className="mb-4 p-3 bg-[#1A1A2E] rounded-lg border border-[#2D2D3A] flex items-center gap-6 overflow-x-auto">
        <div className="flex items-center gap-2 text-gray-400">
          <TrendingUp className="w-4 h-4" />
          <span className="text-sm font-medium">大盘指数</span>
        </div>
        {marketIndices.slice(0, 6).map((index) => (
          <div key={index.ts_code} className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-gray-300 text-sm">{index.name}</span>
            <span className={`text-sm font-medium ${index.pct_chg >= 0 ? 'text-[#00D4AA]' : 'text-red-500'}`}>
              {index.close.toFixed(2)}
            </span>
            <span className={`text-xs ${index.pct_chg >= 0 ? 'text-[#00D4AA]' : 'text-red-500'}`}>
              {index.pct_chg >= 0 ? '+' : ''}{index.pct_chg.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    );
  }, [marketIndices]);

  // 空状态页面
  const emptyState = useMemo(() => (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <div className="p-6 bg-[#1A1A2E] rounded-2xl border border-[#2D2D3A] mb-6">
        <Search className="w-16 h-16 text-[#00D4AA] mx-auto" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">开始搜索股票</h2>
      <p className="text-gray-400 max-w-md mb-6">
        在上方搜索框中输入股票代码或名称，开始您的AI智能分析之旅
      </p>
      
      {/* Data Source Info */}
      <div className="mb-6 p-4 bg-[#1A1A2E] rounded-lg border border-[#2D2D3A] max-w-lg">
        <p className="text-sm text-gray-400">
          当前数据源: <span className="text-[#00D4AA] font-medium">
            {DATA_SOURCE_NAMES[dataSource] || dataSource}
          </span>
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {dataSource === 'eastmoney' 
            ? '支持分钟级K线数据（推荐）' 
            : dataSource === 'sina'
            ? '支持分钟级K线数据'
            : '支持日/周/月K线数据'}
        </p>
      </div>
      
      {/* Quick Select Popular Stocks */}
      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
        {POPULAR_STOCKS.map((stock) => (
          <button
            key={stock.ts_code}
            onClick={() => handleStockSelect(stock)}
            className="px-4 py-2 bg-[#1A1A2E] border border-[#2D2D3A] rounded-lg text-gray-300 hover:border-[#00D4AA]/50 hover:text-white transition-colors"
          >
            {stock.name}
          </button>
        ))}
      </div>
    </div>
  ), [dataSource, handleStockSelect]);

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Header />
      
      <div className="pt-20 px-4 pb-8">
        <div className={`max-w-[1800px] mx-auto transition-all duration-300 ${aiSidebarOpen ? 'mr-96' : ''}`}>
          {/* Market Overview Bar */}
          {marketOverviewBar}

          <div className="flex gap-6">
            {/* Left Sidebar - Watch List & Tech Indicators */}
            <div className="hidden lg:block">
              <Suspense fallback={<ComponentLoading text="加载侧边栏..." className="w-72 h-96 bg-[#1A1A2E] rounded-xl" />}>
                <LeftSidebar
                  watchList={watchList}
                  selectedStock={selectedStock}
                  klineData={klineData}
                  onSelectStock={handleStockSelect}
                  onRemoveStock={handleRemoveFromWatchList}
                  onWatchListChange={handleWatchListChange}
                />
              </Suspense>
            </div>

            {/* Main Content */}
            <div className="flex-1 space-y-6">
              {/* Search Bar with Data Source Selector */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <StockSearch
                    onSelectStock={handleStockSelect}
                    onAddToWatchList={handleAddToWatchList}
                    onRemoveFromWatchList={handleRemoveFromWatchList}
                    selectedStock={selectedStock}
                    watchList={watchList}
                  />
                </div>
                <DataSourceSelector
                  value={dataSource}
                  onChange={handleDataSourceChange}
                  showLabel={true}
                />
              </div>

              {selectedStock ? (
                <>
                  {/* K-Line Chart */}
                  <Suspense fallback={<ComponentLoading text="加载K线图..." className="h-[500px] bg-[#1A1A2E] rounded-xl" />}>
                    <KLineChart
                      data={klineData}
                      stockInfo={selectedStock}
                      loading={loading}
                      period={period}
                      onPeriodChange={handlePeriodChange}
                    />
                  </Suspense>

                  {/* Script Monitor Panel - K线图下方仅保留AI脚本监控 */}
                  {showScriptPanel && (
                    <Suspense fallback={<ComponentLoading text="加载监控面板..." className="h-64 bg-[#1A1A2E] rounded-xl" />}>
                      <ScriptMonitorPanel
                        stockInfo={selectedStock}
                        klineData={klineData}
                        userInput={latestUserInput}
                        onClose={handleCloseScriptPanel}
                      />
                    </Suspense>
                  )}
                </>
              ) : emptyState}
            </div>
          </div>
        </div>
      </div>

      {/* AI Chat Sidebar */}
      <Suspense fallback={null}>
        <AIChatSidebar
          isOpen={aiSidebarOpen}
          onToggle={handleToggleAiSidebar}
          stockInfo={selectedStock}
          klineData={klineData}
          onUserInput={handleUserInput}
        />
      </Suspense>

      {/* AI Toggle Button when sidebar is closed */}
      {!aiSidebarOpen && (
        <button
          onClick={handleToggleAiSidebar}
          className="fixed right-4 bottom-4 p-4 bg-gradient-to-r from-[#00D4AA] to-[#00B894] rounded-full shadow-lg shadow-[#00D4AA]/30 hover:scale-110 transition-transform z-40"
        >
          <Brain className="h-6 w-6 text-black" />
        </button>
      )}
    </div>
  );
}
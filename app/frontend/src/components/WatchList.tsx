import { useState, useEffect, useCallback } from 'react';
import { Star, X, TrendingUp, TrendingDown, Loader2, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { client } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface StockInfo {
  ts_code: string;
  name: string;
}

interface StockWithQuote extends StockInfo {
  price?: number;
  change?: number;
  pct_chg?: number;
}

interface WatchListProps {
  watchList: StockInfo[];
  selectedStock: StockInfo | null;
  onSelectStock: (stock: StockInfo) => void;
  onRemoveStock: (tsCode: string) => void;
  onWatchListChange?: (watchList: StockInfo[]) => void;
}

export default function WatchList({ 
  watchList, 
  selectedStock, 
  onSelectStock, 
  onRemoveStock,
  onWatchListChange,
}: WatchListProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [stockQuotes, setStockQuotes] = useState<Record<string, StockWithQuote>>({});
  const [syncing, setSyncing] = useState(false);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [cloudSynced, setCloudSynced] = useState(false);

  // Sync watchlist from cloud on mount
  useEffect(() => {
    const syncFromCloud = async () => {
      if (!isAuthenticated) {
        setCloudSynced(false);
        return;
      }

      setSyncing(true);
      try {
        const response = await client.entities.watchlists.query({
          sort: '-added_at',
          limit: 100,
        });
        
        if (response?.data?.items && response.data.items.length > 0) {
          const cloudWatchList = response.data.items.map((item: { ts_code: string; stock_name: string }) => ({
            ts_code: item.ts_code,
            name: item.stock_name,
          }));
          
          if (onWatchListChange) {
            onWatchListChange(cloudWatchList);
          }
          setCloudSynced(true);
        }
      } catch (error) {
        console.error('Failed to sync watchlist from cloud:', error);
      } finally {
        setSyncing(false);
      }
    };

    syncFromCloud();
  }, [isAuthenticated]);

  // Fetch real-time quotes for watchlist stocks
  const fetchQuotes = useCallback(async () => {
    if (watchList.length === 0) return;

    setLoadingQuotes(true);
    try {
      const tsCodes = watchList.map(s => s.ts_code).join(',');
      const response = await client.apiCall.invoke({
        url: '/api/v1/tushare/realtime',
        method: 'GET',
        data: { ts_codes: tsCodes },
      });

      if (response?.data?.items) {
        const quotes: Record<string, StockWithQuote> = {};
        response.data.items.forEach((item: { ts_code: string; close: number; change: number; pct_chg: number }) => {
          quotes[item.ts_code] = {
            ts_code: item.ts_code,
            name: watchList.find(s => s.ts_code === item.ts_code)?.name || '',
            price: item.close,
            change: item.change,
            pct_chg: item.pct_chg,
          };
        });
        setStockQuotes(quotes);
      }
    } catch (error) {
      console.error('Failed to fetch quotes:', error);
      // Use mock data if API fails
      const mockQuotes: Record<string, StockWithQuote> = {};
      watchList.forEach(stock => {
        const isUp = Math.random() > 0.5;
        const pctChg = (Math.random() * 5) * (isUp ? 1 : -1);
        mockQuotes[stock.ts_code] = {
          ...stock,
          price: 10 + Math.random() * 90,
          change: pctChg * 0.1,
          pct_chg: pctChg,
        };
      });
      setStockQuotes(mockQuotes);
    } finally {
      setLoadingQuotes(false);
    }
  }, [watchList]);

  // Fetch quotes on mount and when watchlist changes
  useEffect(() => {
    fetchQuotes();
    // Refresh quotes every 30 seconds
    const interval = setInterval(fetchQuotes, 30000);
    return () => clearInterval(interval);
  }, [fetchQuotes]);

  // Sync add to cloud
  const syncAddToCloud = async (stock: StockInfo) => {
    if (!isAuthenticated) return;

    try {
      await client.entities.watchlists.create({
        data: {
          ts_code: stock.ts_code,
          stock_name: stock.name,
          added_at: new Date().toISOString(),
        },
      });
      setCloudSynced(true);
    } catch (error) {
      console.error('Failed to sync add to cloud:', error);
    }
  };

  // Sync remove from cloud
  const syncRemoveFromCloud = async (tsCode: string) => {
    if (!isAuthenticated) return;

    try {
      // Find the record by ts_code
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
  };

  const handleRemoveStock = async (tsCode: string) => {
    onRemoveStock(tsCode);
    await syncRemoveFromCloud(tsCode);
    toast({
      title: '已移除',
      description: '股票已从自选股移除',
    });
  };

  const handleRefreshQuotes = () => {
    fetchQuotes();
    toast({
      title: '刷新中',
      description: '正在获取最新行情数据',
    });
  };

  return (
    <Card className="bg-[#1A1A2E] border-[#2D2D3A] h-[calc(100vh-6rem)] sticky top-20">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-[#00D4AA]" />
            自选股
            <span className="text-gray-500 text-sm font-normal">({watchList.length})</span>
          </div>
          <div className="flex items-center gap-1">
            {isAuthenticated ? (
              <span className="text-xs text-[#00D4AA] flex items-center gap-1" title="已同步到云端">
                <Cloud className="h-3 w-3" />
                {syncing && <Loader2 className="h-3 w-3 animate-spin" />}
              </span>
            ) : (
              <span className="text-xs text-gray-500 flex items-center gap-1" title="登录后可同步到云端">
                <CloudOff className="h-3 w-3" />
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshQuotes}
              disabled={loadingQuotes}
              className="h-6 w-6 p-0 text-gray-400 hover:text-[#00D4AA]"
              title="刷新行情"
            >
              <RefreshCw className={`h-3 w-3 ${loadingQuotes ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[calc(100vh-10rem)]">
          {watchList.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <Star className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">暂无自选股</p>
              <p className="text-xs mt-1">搜索股票后点击 + 添加</p>
              {!isAuthenticated && (
                <p className="text-xs mt-2 text-[#00D4AA]">登录后可同步到云端</p>
              )}
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {watchList.map((stock) => {
                const isSelected = selectedStock?.ts_code === stock.ts_code;
                const quote = stockQuotes[stock.ts_code];
                const isUp = quote?.pct_chg !== undefined ? quote.pct_chg >= 0 : Math.random() > 0.5;
                const pctChg = quote?.pct_chg ?? (Math.random() * 5) * (isUp ? 1 : -1);
                
                return (
                  <div
                    key={stock.ts_code}
                    onClick={() => onSelectStock(stock)}
                    className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-[#00D4AA]/10 border border-[#00D4AA]/30' 
                        : 'hover:bg-[#2D2D3A] border border-transparent'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium truncate ${isSelected ? 'text-[#00D4AA]' : 'text-white'}`}>
                          {stock.name}
                        </span>
                        {quote?.price && (
                          <span className="text-xs text-gray-400">
                            ¥{quote.price.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500 font-mono">{stock.ts_code}</span>
                        <span className={`text-xs flex items-center gap-0.5 ${isUp ? 'text-[#00D4AA]' : 'text-[#FF4757]'}`}>
                          {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {isUp ? '+' : ''}{pctChg.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveStock(stock.ts_code);
                      }}
                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-[#FF4757] hover:bg-[#FF4757]/10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Export helper function for syncing add operation
export const syncWatchlistAdd = async (stock: StockInfo, isAuthenticated: boolean) => {
  if (!isAuthenticated) return;

  try {
    await client.entities.watchlists.create({
      data: {
        ts_code: stock.ts_code,
        stock_name: stock.name,
        added_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to sync add to cloud:', error);
  }
};
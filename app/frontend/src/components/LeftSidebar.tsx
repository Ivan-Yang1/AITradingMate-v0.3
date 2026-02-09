import { useState } from 'react';
import { Star, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import WatchList from './WatchList';
import TechIndicatorsMini from './TechIndicatorsMini';

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

interface LeftSidebarProps {
  watchList: StockInfo[];
  selectedStock: StockInfo | null;
  klineData: KLineData[];
  onSelectStock: (stock: StockInfo) => void;
  onRemoveStock: (tsCode: string) => void;
  onWatchListChange?: (watchList: StockInfo[]) => void;
}

export default function LeftSidebar({
  watchList,
  selectedStock,
  klineData,
  onSelectStock,
  onRemoveStock,
  onWatchListChange,
}: LeftSidebarProps) {
  const [watchListOpen, setWatchListOpen] = useState(true);
  const [indicatorsOpen, setIndicatorsOpen] = useState(true);

  return (
    <div className="w-72 flex-shrink-0 space-y-4 h-[calc(100vh-6rem)] sticky top-20 overflow-hidden">
      <ScrollArea className="h-full pr-2">
        <div className="space-y-4">
          {/* 自选股列表 */}
          <Collapsible open={watchListOpen} onOpenChange={setWatchListOpen}>
            <Card className="bg-[#1A1A2E] border-[#2D2D3A]">
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-2 cursor-pointer hover:bg-[#2D2D3A]/50 transition-colors rounded-t-lg">
                  <CardTitle className="text-white flex items-center justify-between text-base">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-[#00D4AA]" />
                      自选股
                      <span className="text-gray-500 text-sm font-normal">({watchList.length})</span>
                    </div>
                    {watchListOpen ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="p-0">
                  <WatchListContent
                    watchList={watchList}
                    selectedStock={selectedStock}
                    onSelectStock={onSelectStock}
                    onRemoveStock={onRemoveStock}
                    onWatchListChange={onWatchListChange}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* 技术指标 */}
          <Collapsible open={indicatorsOpen} onOpenChange={setIndicatorsOpen}>
            <Card className="bg-[#1A1A2E] border-[#2D2D3A]">
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-2 cursor-pointer hover:bg-[#2D2D3A]/50 transition-colors rounded-t-lg">
                  <CardTitle className="text-white flex items-center justify-between text-base">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-[#00D4AA]" />
                      技术指标
                    </div>
                    {indicatorsOpen ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <TechIndicatorsMini data={klineData} stockInfo={selectedStock} />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  );
}

// 内部自选股列表组件（简化版，不包含Card外壳）
function WatchListContent({
  watchList,
  selectedStock,
  onSelectStock,
  onRemoveStock,
}: {
  watchList: StockInfo[];
  selectedStock: StockInfo | null;
  onSelectStock: (stock: StockInfo) => void;
  onRemoveStock: (tsCode: string) => void;
  onWatchListChange?: (watchList: StockInfo[]) => void;
}) {
  if (watchList.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <Star className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">暂无自选股</p>
        <p className="text-xs mt-1">搜索股票后点击 + 添加</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2 max-h-64 overflow-y-auto">
      {watchList.map((stock) => {
        const isSelected = selectedStock?.ts_code === stock.ts_code;
        
        return (
          <div
            key={stock.ts_code}
            onClick={() => onSelectStock(stock)}
            className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
              isSelected 
                ? 'bg-[#00D4AA]/10 border border-[#00D4AA]/30' 
                : 'hover:bg-[#2D2D3A] border border-transparent'
            }`}
          >
            <div className="flex-1 min-w-0">
              <span className={`text-sm font-medium truncate block ${isSelected ? 'text-[#00D4AA]' : 'text-white'}`}>
                {stock.name}
              </span>
              <span className="text-xs text-gray-500 font-mono">{stock.ts_code}</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveStock(stock.ts_code);
              }}
              className="h-6 w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 text-gray-400 hover:text-[#FF4757] transition-opacity"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
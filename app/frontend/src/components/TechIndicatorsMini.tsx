import { TrendingUp, TrendingDown, BarChart2 } from 'lucide-react';

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

interface StockInfo {
  ts_code: string;
  name: string;
}

interface TechIndicatorsMiniProps {
  data: KLineData[];
  stockInfo: StockInfo | null;
}

export default function TechIndicatorsMini({ data, stockInfo }: TechIndicatorsMiniProps) {
  if (!stockInfo || data.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        <BarChart2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">请选择股票查看指标</p>
      </div>
    );
  }

  const latest = data[data.length - 1];
  
  // 计算MA
  const calcMA = (days: number) => {
    if (data.length < days) return null;
    const slice = data.slice(-days);
    return slice.reduce((acc, d) => acc + d.close, 0) / days;
  };

  const ma5 = calcMA(5);
  const ma10 = calcMA(10);
  const ma20 = calcMA(20);
  const ma60 = calcMA(60);

  // 计算均线趋势
  const maTrend = ma5 && ma10 && ma20 
    ? (ma5 > ma10 && ma10 > ma20 ? '多头排列' : ma5 < ma10 && ma10 < ma20 ? '空头排列' : '震荡整理')
    : '-';

  // 计算成交量变化
  const avgVol5 = data.slice(-5).reduce((acc, d) => acc + d.vol, 0) / 5;
  const avgVol20 = data.slice(-20).reduce((acc, d) => acc + d.vol, 0) / 20;
  const volRatio = avgVol20 > 0 ? (avgVol5 / avgVol20).toFixed(2) : '-';

  // 计算振幅
  const amplitude = ((latest.high - latest.low) / latest.low * 100).toFixed(2);

  // 计算近期涨跌
  const change5 = data.length >= 5 
    ? ((latest.close - data[data.length - 5].close) / data[data.length - 5].close * 100).toFixed(2)
    : '-';
  const change20 = data.length >= 20
    ? ((latest.close - data[data.length - 20].close) / data[data.length - 20].close * 100).toFixed(2)
    : '-';

  const indicators = [
    { label: 'MA5', value: ma5?.toFixed(2) || '-', color: '#FFD93D', trend: ma5 && latest.close > ma5 },
    { label: 'MA10', value: ma10?.toFixed(2) || '-', color: '#6BCB77', trend: ma10 && latest.close > ma10 },
    { label: 'MA20', value: ma20?.toFixed(2) || '-', color: '#4D96FF', trend: ma20 && latest.close > ma20 },
    { label: 'MA60', value: ma60?.toFixed(2) || '-', color: '#FF6B6B', trend: ma60 && latest.close > ma60 },
  ];

  return (
    <div className="space-y-3">
      {/* 当前股票信息 */}
      <div className="flex items-center justify-between p-2 bg-[#0A0A0F] rounded-lg">
        <div>
          <span className="text-white font-medium text-sm">{stockInfo.name}</span>
          <span className="text-gray-500 text-xs ml-2">{stockInfo.ts_code}</span>
        </div>
        <div className={`text-sm font-medium ${latest.pct_chg >= 0 ? 'text-[#00D4AA]' : 'text-[#FF4757]'}`}>
          ¥{latest.close.toFixed(2)}
        </div>
      </div>

      {/* 均线指标 */}
      <div>
        <h4 className="text-xs text-gray-400 mb-2 flex items-center gap-1">
          <BarChart2 className="h-3 w-3" />
          均线系统
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {indicators.map((ind) => (
            <div key={ind.label} className="p-2 bg-[#0A0A0F] rounded-lg">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs text-gray-500">{ind.label}</span>
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ind.color }} />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-white text-xs font-medium">{ind.value}</span>
                {ind.trend ? (
                  <TrendingUp className="h-2.5 w-2.5 text-[#00D4AA]" />
                ) : (
                  <TrendingDown className="h-2.5 w-2.5 text-[#FF4757]" />
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 p-2 bg-[#0A0A0F] rounded-lg">
          <span className="text-xs text-gray-500">趋势判断</span>
          <p className={`text-xs font-medium mt-0.5 ${
            maTrend === '多头排列' ? 'text-[#00D4AA]' : 
            maTrend === '空头排列' ? 'text-[#FF4757]' : 'text-yellow-400'
          }`}>
            {maTrend}
          </p>
        </div>
      </div>

      {/* 量能与价格 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 bg-[#0A0A0F] rounded-lg">
          <span className="text-xs text-gray-500 block">量比</span>
          <span className={`text-xs font-medium ${Number(volRatio) > 1 ? 'text-[#00D4AA]' : 'text-[#FF4757]'}`}>
            {volRatio}
          </span>
        </div>
        <div className="p-2 bg-[#0A0A0F] rounded-lg">
          <span className="text-xs text-gray-500 block">5日</span>
          <span className={`text-xs font-medium ${Number(change5) >= 0 ? 'text-[#00D4AA]' : 'text-[#FF4757]'}`}>
            {Number(change5) >= 0 ? '+' : ''}{change5}%
          </span>
        </div>
        <div className="p-2 bg-[#0A0A0F] rounded-lg">
          <span className="text-xs text-gray-500 block">振幅</span>
          <span className="text-xs font-medium text-white">{amplitude}%</span>
        </div>
      </div>

      {/* 20日涨跌 */}
      <div className="p-2 bg-[#0A0A0F] rounded-lg flex items-center justify-between">
        <span className="text-xs text-gray-500">20日涨跌</span>
        <span className={`text-xs font-medium ${Number(change20) >= 0 ? 'text-[#00D4AA]' : 'text-[#FF4757]'}`}>
          {Number(change20) >= 0 ? '+' : ''}{change20}%
        </span>
      </div>
    </div>
  );
}
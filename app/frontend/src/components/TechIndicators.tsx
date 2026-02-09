import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, TrendingUp, TrendingDown, BarChart2 } from 'lucide-react';

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

interface TechIndicatorsProps {
  data: KLineData[];
}

export default function TechIndicators({ data }: TechIndicatorsProps) {
  if (data.length === 0) {
    return (
      <Card className="bg-[#1A1A2E] border-[#2D2D3A]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#00D4AA]" />
            技术指标
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-400">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>请选择股票查看技术指标</p>
          </div>
        </CardContent>
      </Card>
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
  const recentVols = data.slice(-5);
  const avgVol5 = recentVols.reduce((acc, d) => acc + d.vol, 0) / 5;
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
    { 
      label: 'MA5', 
      value: ma5?.toFixed(2) || '-', 
      color: '#FFD93D',
      trend: ma5 && latest.close > ma5 ? 'up' : 'down'
    },
    { 
      label: 'MA10', 
      value: ma10?.toFixed(2) || '-', 
      color: '#6BCB77',
      trend: ma10 && latest.close > ma10 ? 'up' : 'down'
    },
    { 
      label: 'MA20', 
      value: ma20?.toFixed(2) || '-', 
      color: '#4D96FF',
      trend: ma20 && latest.close > ma20 ? 'up' : 'down'
    },
    { 
      label: 'MA60', 
      value: ma60?.toFixed(2) || '-', 
      color: '#FF6B6B',
      trend: ma60 && latest.close > ma60 ? 'up' : 'down'
    },
  ];

  return (
    <Card className="bg-[#1A1A2E] border-[#2D2D3A]">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Activity className="h-5 w-5 text-[#00D4AA]" />
          技术指标
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 均线指标 */}
        <div>
          <h4 className="text-sm text-gray-400 mb-3 flex items-center gap-2">
            <BarChart2 className="h-4 w-4" />
            均线系统
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {indicators.map((ind) => (
              <div key={ind.label} className="p-3 bg-[#0A0A0F] rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">{ind.label}</span>
                  <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: ind.color }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{ind.value}</span>
                  {ind.trend === 'up' ? (
                    <TrendingUp className="h-3 w-3 text-[#00D4AA]" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-[#FF4757]" />
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 p-3 bg-[#0A0A0F] rounded-lg">
            <span className="text-xs text-gray-500">均线趋势</span>
            <p className={`font-medium mt-1 ${
              maTrend === '多头排列' ? 'text-[#00D4AA]' : 
              maTrend === '空头排列' ? 'text-[#FF4757]' : 'text-yellow-400'
            }`}>
              {maTrend}
            </p>
          </div>
        </div>

        {/* 量能指标 */}
        <div>
          <h4 className="text-sm text-gray-400 mb-3">量能分析</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-[#0A0A0F] rounded-lg">
              <span className="text-xs text-gray-500">今日成交量</span>
              <p className="text-white font-medium mt-1">{(latest.vol / 10000).toFixed(0)}万手</p>
            </div>
            <div className="p-3 bg-[#0A0A0F] rounded-lg">
              <span className="text-xs text-gray-500">量比(5/20)</span>
              <p className={`font-medium mt-1 ${Number(volRatio) > 1 ? 'text-[#00D4AA]' : 'text-[#FF4757]'}`}>
                {volRatio}
              </p>
            </div>
          </div>
        </div>

        {/* 价格指标 */}
        <div>
          <h4 className="text-sm text-gray-400 mb-3">价格分析</h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-[#0A0A0F] rounded-lg">
              <span className="text-xs text-gray-500">今日振幅</span>
              <p className="text-white font-medium mt-1">{amplitude}%</p>
            </div>
            <div className="p-3 bg-[#0A0A0F] rounded-lg">
              <span className="text-xs text-gray-500">5日涨跌</span>
              <p className={`font-medium mt-1 ${Number(change5) >= 0 ? 'text-[#00D4AA]' : 'text-[#FF4757]'}`}>
                {Number(change5) >= 0 ? '+' : ''}{change5}%
              </p>
            </div>
            <div className="p-3 bg-[#0A0A0F] rounded-lg">
              <span className="text-xs text-gray-500">20日涨跌</span>
              <p className={`font-medium mt-1 ${Number(change20) >= 0 ? 'text-[#00D4AA]' : 'text-[#FF4757]'}`}>
                {Number(change20) >= 0 ? '+' : ''}{change20}%
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
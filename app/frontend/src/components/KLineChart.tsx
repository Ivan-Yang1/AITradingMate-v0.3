import React, { useEffect, useRef, useMemo, memo, useCallback } from 'react';
// 按需引入echarts模块，减少包体积
import * as echarts from 'echarts/core';
import { CandlestickChart, LineChart, BarChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DataZoomComponent,
  LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';

// 注册必要的组件
echarts.use([
  CandlestickChart,
  LineChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  DataZoomComponent,
  LegendComponent,
  CanvasRenderer,
]);

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

interface KLineChartProps {
  data: KLineData[];
  stockInfo: StockInfo;
  loading?: boolean;
  period: 'D' | 'W' | 'M';
  onPeriodChange: (period: 'D' | 'W' | 'M') => void;
}

// 计算MA均线的纯函数
const calculateMA = (data: KLineData[], dayCount: number): (number | null)[] => {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < dayCount - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = 0; j < dayCount; j++) {
        sum += data[i - j].close;
      }
      result.push(+(sum / dayCount).toFixed(2));
    }
  }
  return result;
};

// 使用memo优化组件
const KLineChart = memo(function KLineChart({ 
  data, 
  stockInfo, 
  loading, 
  period, 
  onPeriodChange 
}: KLineChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // 使用useMemo缓存计算结果
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;
    
    return {
      dates: data.map(d => d.trade_date),
      klineData: data.map(d => [d.open, d.close, d.low, d.high]),
      volumes: data.map(d => d.vol),
      colors: data.map(d => d.close >= d.open ? '#00D4AA' : '#FF4757'),
      ma5: calculateMA(data, 5),
      ma10: calculateMA(data, 10),
      ma20: calculateMA(data, 20),
    };
  }, [data]);

  // 获取最新数据
  const latestData = useMemo(() => {
    return data && data.length > 0 ? data[data.length - 1] : null;
  }, [data]);

  const isUp = latestData ? latestData.pct_chg >= 0 : true;

  // 生成图表配置
  const getChartOption = useCallback((): EChartsOption | null => {
    if (!chartData) return null;

    return {
      backgroundColor: 'transparent',
      animation: false,
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        },
        backgroundColor: 'rgba(26, 26, 46, 0.95)',
        borderColor: '#2D2D3A',
        textStyle: {
          color: '#fff'
        },
        formatter: (params: unknown) => {
          const paramsArray = params as { seriesName: string; dataIndex: number }[];
          const kline = paramsArray.find((p) => p.seriesName === stockInfo.name);
          if (!kline) return '';
          const idx = kline.dataIndex;
          const d = data[idx];
          if (!d) return '';
          const changeColor = d.pct_chg >= 0 ? '#00D4AA' : '#FF4757';
          return `
            <div style="padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 8px;">${d.trade_date}</div>
              <div>开盘: <span style="color: #fff;">${d.open.toFixed(2)}</span></div>
              <div>收盘: <span style="color: #fff;">${d.close.toFixed(2)}</span></div>
              <div>最高: <span style="color: #00D4AA;">${d.high.toFixed(2)}</span></div>
              <div>最低: <span style="color: #FF4757;">${d.low.toFixed(2)}</span></div>
              <div>涨跌幅: <span style="color: ${changeColor};">${d.pct_chg >= 0 ? '+' : ''}${d.pct_chg.toFixed(2)}%</span></div>
              <div>成交量: <span style="color: #8B8B9A;">${(d.vol / 10000).toFixed(0)}万手</span></div>
            </div>
          `;
        }
      },
      legend: {
        data: [stockInfo.name, 'MA5', 'MA10', 'MA20'],
        top: 10,
        textStyle: {
          color: '#8B8B9A'
        }
      },
      grid: [
        {
          left: '10%',
          right: '8%',
          top: '15%',
          height: '55%'
        },
        {
          left: '10%',
          right: '8%',
          top: '75%',
          height: '15%'
        }
      ],
      xAxis: [
        {
          type: 'category',
          data: chartData.dates,
          boundaryGap: false,
          axisLine: { lineStyle: { color: '#2D2D3A' } },
          axisLabel: { color: '#8B8B9A' },
          splitLine: { show: false }
        },
        {
          type: 'category',
          gridIndex: 1,
          data: chartData.dates,
          boundaryGap: false,
          axisLine: { lineStyle: { color: '#2D2D3A' } },
          axisLabel: { show: false },
          splitLine: { show: false }
        }
      ],
      yAxis: [
        {
          scale: true,
          splitArea: { show: false },
          axisLine: { lineStyle: { color: '#2D2D3A' } },
          axisLabel: { color: '#8B8B9A' },
          splitLine: { lineStyle: { color: '#2D2D3A', type: 'dashed' } }
        },
        {
          scale: true,
          gridIndex: 1,
          splitNumber: 2,
          axisLabel: { show: false },
          axisLine: { show: false },
          splitLine: { show: false }
        }
      ],
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: [0, 1],
          start: 50,
          end: 100
        },
        {
          show: true,
          xAxisIndex: [0, 1],
          type: 'slider',
          bottom: 10,
          start: 50,
          end: 100,
          height: 20,
          borderColor: '#2D2D3A',
          fillerColor: 'rgba(0, 212, 170, 0.2)',
          handleStyle: {
            color: '#00D4AA'
          },
          textStyle: {
            color: '#8B8B9A'
          }
        }
      ],
      series: [
        {
          name: stockInfo.name,
          type: 'candlestick',
          data: chartData.klineData,
          itemStyle: {
            color: '#00D4AA',
            color0: '#FF4757',
            borderColor: '#00D4AA',
            borderColor0: '#FF4757'
          }
        },
        {
          name: 'MA5',
          type: 'line',
          data: chartData.ma5,
          smooth: true,
          lineStyle: { width: 1, color: '#FFD93D' },
          symbol: 'none'
        },
        {
          name: 'MA10',
          type: 'line',
          data: chartData.ma10,
          smooth: true,
          lineStyle: { width: 1, color: '#6BCB77' },
          symbol: 'none'
        },
        {
          name: 'MA20',
          type: 'line',
          data: chartData.ma20,
          smooth: true,
          lineStyle: { width: 1, color: '#4D96FF' },
          symbol: 'none'
        },
        {
          name: '成交量',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: chartData.volumes.map((v, i) => ({
            value: v,
            itemStyle: { color: chartData.colors[i] }
          }))
        }
      ]
    };
  }, [chartData, stockInfo, data]);

  // 初始化图表 - 只在组件挂载时执行一次
  useEffect(() => {
    if (!chartRef.current) return;
    
    // 创建图表实例
    chartInstance.current = echarts.init(chartRef.current, 'dark');

    // 清理函数
    return () => {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []); // 空依赖数组，只在挂载时执行

  // 当数据变化时更新图表
  useEffect(() => {
    if (!chartInstance.current) return;
    
    // 如果正在加载，不更新图表（保持当前显示）
    if (loading) return;

    const option = getChartOption();
    if (option) {
      chartInstance.current.setOption(option, true);
    }
  }, [getChartOption, loading]);

  // 响应式处理
  useEffect(() => {
    const handleResize = () => {
      if (chartInstance.current) {
        chartInstance.current.resize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <Card className="bg-[#1A1A2E] border-[#2D2D3A]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <CardTitle className="text-white flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#00D4AA]" />
              {stockInfo.name}
              <span className="text-sm font-mono text-gray-400">{stockInfo.ts_code}</span>
            </CardTitle>
            {latestData && (
              <div className="flex items-center gap-4">
                <span className={`text-2xl font-bold ${isUp ? 'text-[#00D4AA]' : 'text-[#FF4757]'}`}>
                  {latestData.close.toFixed(2)}
                </span>
                <div className={`flex items-center gap-1 ${isUp ? 'text-[#00D4AA]' : 'text-[#FF4757]'}`}>
                  {isUp ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  <span>{isUp ? '+' : ''}{latestData.pct_chg.toFixed(2)}%</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {(['D', 'W', 'M'] as const).map((p) => (
              <Button
                key={p}
                variant={period === p ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPeriodChange(p)}
                className={period === p 
                  ? 'bg-[#00D4AA] text-black hover:bg-[#00B894]' 
                  : 'border-[#2D2D3A] text-gray-400 hover:text-white hover:bg-[#2D2D3A]'
                }
              >
                {p === 'D' ? '日K' : p === 'W' ? '周K' : '月K'}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="w-full h-[500px] relative">
          {/* 加载遮罩 */}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0A0A0F]/60 z-10 rounded-lg backdrop-blur-sm">
              <div className="text-center">
                <div className="animate-spin h-8 w-8 border-2 border-[#00D4AA] border-t-transparent rounded-full mx-auto"></div>
                <p className="mt-3 text-gray-400">加载数据中...</p>
              </div>
            </div>
          )}
          {/* 无数据提示 */}
          {!loading && (!data || data.length === 0) && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="text-center text-gray-400">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>暂无K线数据</p>
                <p className="text-sm mt-1">请选择一只股票查看</p>
              </div>
            </div>
          )}
          {/* 图表容器 - 始终渲染 */}
          <div ref={chartRef} className="w-full h-full" />
        </div>
      </CardContent>
    </Card>
  );
});

export default KLineChart;
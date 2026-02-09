import React, { useState } from 'react';
import { Brain, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@metagptx/web-sdk';

const client = createClient();

interface KLineData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  pct_chg: number;
}

interface AIAnalysisProps {
  stockCode: string;
  stockName: string;
  data: KLineData[];
}

export default function AIAnalysis({ stockCode, stockName, data }: AIAnalysisProps) {
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const generateAnalysis = async () => {
    if (!stockCode || data.length === 0) {
      setError('请先选择股票');
      return;
    }

    setLoading(true);
    setError('');
    setAnalysis('');

    try {
      // 准备最近的K线数据摘要
      const recentData = data.slice(-30);
      const latest = recentData[recentData.length - 1];
      const oldest = recentData[0];
      
      // 计算一些基本指标
      const priceChange = ((latest.close - oldest.close) / oldest.close * 100).toFixed(2);
      const avgVolume = recentData.reduce((acc, d) => acc + d.volume, 0) / recentData.length;
      const maxHigh = Math.max(...recentData.map(d => d.high));
      const minLow = Math.min(...recentData.map(d => d.low));

      // 计算MA
      const ma5 = data.slice(-5).reduce((acc, d) => acc + d.close, 0) / 5;
      const ma10 = data.slice(-10).reduce((acc, d) => acc + d.close, 0) / 10;
      const ma20 = data.slice(-20).reduce((acc, d) => acc + d.close, 0) / 20;

      const prompt = `你是一位专业的股票分析师。请根据以下${stockName}(${stockCode})的技术数据，给出专业的技术分析和投资建议。

最新数据(${latest.date}):
- 收盘价: ${latest.close.toFixed(2)}
- 开盘价: ${latest.open.toFixed(2)}
- 最高价: ${latest.high.toFixed(2)}
- 最低价: ${latest.low.toFixed(2)}
- 涨跌幅: ${latest.pct_chg.toFixed(2)}%
- 成交量: ${(latest.volume / 10000).toFixed(0)}万手

近30日表现:
- 期间涨跌幅: ${priceChange}%
- 最高价: ${maxHigh.toFixed(2)}
- 最低价: ${minLow.toFixed(2)}
- 平均成交量: ${(avgVolume / 10000).toFixed(0)}万手

技术指标:
- MA5: ${ma5.toFixed(2)}
- MA10: ${ma10.toFixed(2)}
- MA20: ${ma20.toFixed(2)}
- MA排列: ${ma5 > ma10 && ma10 > ma20 ? '多头排列' : ma5 < ma10 && ma10 < ma20 ? '空头排列' : '震荡整理'}

请从以下几个方面进行分析:
1. 趋势判断：当前处于什么趋势？
2. 支撑与压力：关键的支撑位和压力位在哪里？
3. 成交量分析：量能配合情况如何？
4. 短期展望：未来几个交易日可能的走势？
5. 操作建议：给出具体的操作策略建议。

注意：这只是技术分析参考，不构成投资建议，投资有风险，入市需谨慎。`;

      await client.ai.gentxt({
        messages: [
          { role: 'system', content: '你是一位专业的A股技术分析师，擅长K线分析、均线系统分析和量价关系分析。请用专业但易懂的语言进行分析。' },
          { role: 'user', content: prompt }
        ],
        model: 'deepseek-v3.2',
        stream: true,
        onChunk: (chunk) => {
          setAnalysis(prev => prev + (chunk.content || ''));
        },
        onComplete: () => {
          setLoading(false);
        },
        onError: (err) => {
          setError(err.message || 'AI分析失败');
          setLoading(false);
        }
      });
    } catch (err: any) {
      setError(err.message || 'AI分析失败');
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#1A1A2E] rounded-xl p-6 border border-[#2D2D3A]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Brain className="h-5 w-5 text-[#00D4AA]" />
          AI智能分析
        </h3>
        <Button
          onClick={generateAnalysis}
          disabled={loading || !stockCode}
          className="bg-gradient-to-r from-[#00D4AA] to-[#00B894] hover:from-[#00B894] hover:to-[#00D4AA] text-black font-medium"
        >
          {loading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              分析中...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              开始分析
            </>
          )}
        </Button>
      </div>

      {!stockCode && (
        <div className="text-center py-12 text-gray-400">
          <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>请先选择股票，然后点击"开始分析"获取AI智能分析</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-[#FF4757]/10 border border-[#FF4757]/30 rounded-lg mb-4">
          <div className="flex items-center gap-2 text-[#FF4757]">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {analysis && (
        <div className="prose prose-invert max-w-none">
          <div className="p-4 bg-[#0A0A0F] rounded-lg whitespace-pre-wrap text-gray-300 leading-relaxed">
            {analysis}
          </div>
        </div>
      )}

      {stockCode && !analysis && !loading && !error && (
        <div className="text-center py-8 text-gray-400">
          <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p>点击"开始分析"按钮，AI将为您分析 {stockName} 的技术走势</p>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-[#2D2D3A]">
        <p className="text-xs text-gray-500 text-center">
          ⚠️ 以上分析仅供参考，不构成投资建议。股市有风险，投资需谨慎。
        </p>
      </div>
    </div>
  );
}
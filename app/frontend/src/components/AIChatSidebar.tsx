import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Brain, Send, Trash2, Sparkles, User, Bot, ChevronRight, ChevronLeft, 
  TrendingUp, TrendingDown, Activity, BarChart3, Save, Settings,
  Loader2, Wrench, Lightbulb, CheckCircle, Code2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { client } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useTradingState, ChatMessage } from '@/contexts/TradingStateContext';
import { useToast } from '@/hooks/use-toast';

interface ThinkingBubble {
  id: string;
  type: 'thinking' | 'tool_call' | 'tool_result' | 'thinking_end';
  content: string;
  toolName?: string;
  timestamp: Date;
}

interface StockInfo {
  ts_code: string;
  name: string;
}

interface KLineData {
  trade_date?: string;
  date?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  vol?: number;
  volume?: number;
  amount: number;
  pct_chg: number;
}

interface Signal {
  type: string;
  indicator: string;
  message: string;
}

interface AnalysisData {
  stock_info: {
    ts_code?: string;
    name?: string;
    industry?: string;
    area?: string;
  };
  latest_price: number;
  pct_change: number;
  indicators: {
    ma5?: number;
    ma10?: number;
    ma20?: number;
    macd?: number;
    macd_signal?: number;
    macd_histogram?: number;
    rsi?: number;
    kdj_k?: number;
    kdj_d?: number;
    kdj_j?: number;
    boll_upper?: number;
    boll_middle?: number;
    boll_lower?: number;
  };
  signals: Signal[];
}

interface AIChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  stockInfo: StockInfo | null;
  klineData: KLineData[];
  onUserInput?: (input: string) => void;
}

// 投资风格配置
const INVESTMENT_STYLES = {
  value: {
    name: '长线价值投资',
    icon: '📈',
    description: '关注企业基本面、长期增长',
    color: 'from-blue-500 to-blue-600',
  },
  technical: {
    name: '短线技术分析',
    icon: '📊',
    description: '关注K线形态、技术指标',
    color: 'from-orange-500 to-orange-600',
  },
  news: {
    name: '消息面投资',
    icon: '📰',
    description: '关注政策新闻、市场热点',
    color: 'from-purple-500 to-purple-600',
  },
  balanced: {
    name: '综合分析',
    icon: '⚖️',
    description: '技术+基本面+消息面',
    color: 'from-green-500 to-green-600',
  },
};

// 监控关键词
const MONITOR_KEYWORDS = ['通知', '提醒', '监控', '告警', '预警', '金叉', '死叉', '突破', '超买', '超卖', '脚本', 'PineScript', 'Python'];

// 将ChatMessage转换为显示用的Message
interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  messageType?: 'text' | 'thinking' | 'tool_call' | 'tool_result' | 'error';
  toolName?: string;
}

export default function AIChatSidebar({ isOpen, onToggle, stockInfo, klineData, onUserInput }: AIChatSidebarProps) {
  // 使用持久化状态
  const {
    state: tradingState,
    addChatMessage,
    updateChatMessage,
    clearChatMessages,
    setInvestmentStyle,
  } = useTradingState();

  // 将持久化的消息转换为显示格式
  const messages: DisplayMessage[] = tradingState.chatMessages.map(msg => ({
    ...msg,
    timestamp: new Date(msg.timestamp),
  }));

  const investmentStyle = tradingState.investmentStyle || 'balanced';

  const [thinkingBubbles, setThinkingBubbles] = useState<ThinkingBubble[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [savingAnalysis, setSavingAnalysis] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, thinkingBubbles, streamingContent, scrollToBottom]);

  // 保存投资风格
  const handleStyleChange = (style: string) => {
    setInvestmentStyle(style);
    setShowStylePicker(false);
    toast({
      title: '投资风格已切换',
      description: `当前模式：${INVESTMENT_STYLES[style as keyof typeof INVESTMENT_STYLES]?.name}`,
    });
  };

  // 当股票变化时，获取分析数据
  useEffect(() => {
    if (stockInfo?.ts_code) {
      fetchAnalysis(stockInfo.ts_code);
    } else {
      setAnalysisData(null);
    }
  }, [stockInfo?.ts_code]);

  const fetchAnalysis = async (tsCode: string) => {
    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/fin-agent/analyze',
        method: 'POST',
        data: { ts_code: tsCode }
      });
      
      if (response.data?.success && response.data?.data) {
        setAnalysisData(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch analysis:', err);
    }
  };

  // Save analysis to database
  const saveAnalysisToHistory = async (content: string, result: 'bullish' | 'bearish' | 'neutral') => {
    if (!isAuthenticated || !stockInfo) return;

    setSavingAnalysis(true);
    try {
      await client.entities.analysis_history.create({
        data: {
          ts_code: stockInfo.ts_code,
          stock_name: stockInfo.name,
          analysis_result: result,
          analysis_content: content.slice(0, 2000),
          analyzed_at: new Date().toISOString(),
        },
      });
      toast({
        title: '分析已保存',
        description: '您可以在个人中心查看历史分析记录',
      });
    } catch (error) {
      console.error('Failed to save analysis:', error);
      toast({
        title: '保存失败',
        description: '无法保存分析记录，请稍后重试',
        variant: 'destructive',
      });
    } finally {
      setSavingAnalysis(false);
    }
  };

  // Determine analysis result from content
  const determineAnalysisResult = (content: string): 'bullish' | 'bearish' | 'neutral' => {
    const bullishKeywords = ['看涨', '买入', '上涨', '突破', '多头', '利好', '强势', '反弹', '金叉'];
    const bearishKeywords = ['看跌', '卖出', '下跌', '跌破', '空头', '利空', '弱势', '回调', '死叉'];
    
    let bullishCount = 0;
    let bearishCount = 0;
    
    bullishKeywords.forEach(keyword => {
      if (content.includes(keyword)) bullishCount++;
    });
    
    bearishKeywords.forEach(keyword => {
      if (content.includes(keyword)) bearishCount++;
    });
    
    if (bullishCount > bearishCount + 1) return 'bullish';
    if (bearishCount > bullishCount + 1) return 'bearish';
    return 'neutral';
  };

  const getStockContext = () => {
    if (!stockInfo || klineData.length === 0) return '';
    
    const recentData = klineData.slice(-30);
    const latest = recentData[recentData.length - 1];
    const oldest = recentData[0];
    
    const priceChange = ((latest.close - oldest.close) / oldest.close * 100).toFixed(2);
    const avgVol = recentData.reduce((acc, d) => acc + (d.vol || d.volume || 0), 0) / recentData.length;
    const maxHigh = Math.max(...recentData.map(d => d.high));
    const minLow = Math.min(...recentData.map(d => d.low));

    // 计算MA
    const calcMA = (days: number) => {
      const slice = klineData.slice(-days);
      return slice.reduce((acc, d) => acc + d.close, 0) / slice.length;
    };

    const ma5 = calcMA(5);
    const ma10 = calcMA(10);
    const ma20 = calcMA(20);

    const tradeDate = latest.trade_date || latest.date || '';

    return `
当前分析股票: ${stockInfo.name}(${stockInfo.ts_code})

最新数据(${tradeDate}):
- 收盘价: ${latest.close.toFixed(2)}
- 开盘价: ${latest.open.toFixed(2)}
- 最高价: ${latest.high.toFixed(2)}
- 最低价: ${latest.low.toFixed(2)}
- 涨跌幅: ${latest.pct_chg.toFixed(2)}%
- 成交量: ${((latest.vol || latest.volume || 0) / 10000).toFixed(0)}万手

近30日表现:
- 期间涨跌幅: ${priceChange}%
- 最高价: ${maxHigh.toFixed(2)}
- 最低价: ${minLow.toFixed(2)}
- 平均成交量: ${(avgVol / 10000).toFixed(0)}万手

技术指标:
- MA5: ${ma5.toFixed(2)}
- MA10: ${ma10.toFixed(2)}
- MA20: ${ma20.toFixed(2)}
- MA排列: ${ma5 > ma10 && ma10 > ma20 ? '多头排列' : ma5 < ma10 && ma10 < ma20 ? '空头排列' : '震荡整理'}
`;
  };

  // 检测是否包含监控意图
  const hasMonitorIntent = (text: string): boolean => {
    return MONITOR_KEYWORDS.some(kw => text.includes(kw));
  };

  // SSE流式发送消息 - 优化逐字输出
  const sendMessageWithSSE = async () => {
    if (!input.trim() || loading) return;

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
      messageType: 'text',
    };

    addChatMessage(userMessage);
    const userInput = input.trim();
    setInput('');
    setLoading(true);
    setIsThinking(true);
    setThinkingBubbles([]);
    setStreamingContent('');

    // 通知父组件用户输入（用于触发脚本生成）
    if (onUserInput && hasMonitorIntent(userInput)) {
      onUserInput(userInput);
    }

    // 创建助手消息占位
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      messageType: 'text',
    };
    addChatMessage(assistantMessage);

    let finalContent = '';

    try {
      const stockContext = getStockContext();
      
      // 如果包含监控意图，添加特殊提示
      const monitorHint = hasMonitorIntent(userInput) 
        ? '\n\n注意：用户希望设置监控提醒。请在回复中说明已识别到的监控条件，并告知用户页面下方已生成相应的监控脚本，用户可以点击"确认执行"按钮来激活监控。'
        : '';
      
      // 使用SSE流式API
      const response = await fetch('/api/v1/builtin-ai/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          model_id: 'deepseek-v3.2',
          message: userInput + monitorHint,
          history: messages.filter(m => m.messageType === 'text').map(m => ({ 
            role: m.role, 
            content: m.content 
          })),
          stock_code: stockInfo?.ts_code || null,
          stock_name: stockInfo?.name || null,
          stock_context: stockContext || null,
          investment_style: investmentStyle,
          temperature: 0.7,
          max_tokens: 2048,
          stream: true,
          char_by_char: true,
          char_delay: 30, // 30ms延迟，更明显的打字效果
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');

      if (!reader) {
        throw new Error('No reader available');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 解码并添加到缓冲区
        buffer += decoder.decode(value, { stream: true });
        
        // 按行处理
        const lines = buffer.split('\n');
        // 保留最后一个可能不完整的行
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            if (!data) continue;

            try {
              const parsed = JSON.parse(data);
              
              switch (parsed.type) {
                case 'thinking':
                  setThinkingBubbles(prev => [...prev, {
                    id: Date.now().toString() + Math.random(),
                    type: 'thinking',
                    content: parsed.content,
                    timestamp: new Date(),
                  }]);
                  break;
                  
                case 'tool_call':
                  setThinkingBubbles(prev => [...prev, {
                    id: Date.now().toString() + Math.random(),
                    type: 'tool_call',
                    content: parsed.content,
                    toolName: parsed.tool,
                    timestamp: new Date(),
                  }]);
                  break;
                  
                case 'tool_result':
                  setThinkingBubbles(prev => [...prev, {
                    id: Date.now().toString() + Math.random(),
                    type: 'tool_result',
                    content: parsed.content,
                    toolName: parsed.tool,
                    timestamp: new Date(),
                  }]);
                  break;
                  
                case 'thinking_end':
                  setIsThinking(false);
                  setThinkingBubbles(prev => [...prev, {
                    id: Date.now().toString() + Math.random(),
                    type: 'thinking_end',
                    content: parsed.content,
                    timestamp: new Date(),
                  }]);
                  break;
                  
                case 'content':
                  // 逐字更新内容
                  finalContent += parsed.content;
                  // 使用持久化状态更新消息
                  updateChatMessage(assistantMessageId, { content: finalContent });
                  // 同时更新streamingContent用于触发滚动
                  setStreamingContent(finalContent);
                  break;
                  
                case 'done':
                  setLoading(false);
                  setIsThinking(false);
                  // 清除思考气泡
                  setTimeout(() => setThinkingBubbles([]), 1000);
                  break;
                  
                case 'error':
                  updateChatMessage(assistantMessageId, {
                    content: `抱歉，分析时出现错误: ${parsed.content}`,
                    messageType: 'error',
                  });
                  setLoading(false);
                  setIsThinking(false);
                  break;
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      // Auto-save analysis for stock-related questions
      if (isAuthenticated && stockInfo && isAnalysisQuestion(userInput) && finalContent) {
        const result = determineAnalysisResult(finalContent);
        await saveAnalysisToHistory(finalContent, result);
      }

    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Request aborted');
        return;
      }
      console.error('SSE error:', err);
      // 显示错误信息
      updateChatMessage(assistantMessageId, {
        content: `抱歉，连接出现问题，请稍后重试。`,
        messageType: 'error',
      });
    }

    setLoading(false);
    setIsThinking(false);
    setStreamingContent('');
  };

  // Check if the question is analysis-related
  const isAnalysisQuestion = (question: string): boolean => {
    const analysisKeywords = ['分析', '走势', '趋势', '建议', '操作', '支撑', '压力', '买入', '卖出', 'MACD', 'RSI', 'KDJ', '均线', '量能'];
    return analysisKeywords.some(keyword => question.includes(keyword));
  };

  // Manual save current analysis
  const handleSaveAnalysis = async () => {
    if (!stockInfo || messages.length === 0) return;
    
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant' && m.content);
    if (!lastAssistantMsg) {
      toast({
        title: '无法保存',
        description: '没有可保存的分析内容',
        variant: 'destructive',
      });
      return;
    }

    const result = determineAnalysisResult(lastAssistantMsg.content);
    await saveAnalysisToHistory(lastAssistantMsg.content, result);
  };

  const handleClearMessages = () => {
    clearChatMessages();
    setThinkingBubbles([]);
    setStreamingContent('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessageWithSSE();
    }
  };

  const quickQuestions = [
    '分析当前股票走势',
    '支撑位和压力位在哪？',
    '短期操作建议',
    '如果出现金叉通知我',
    'MACD指标解读',
    '设置RSI超卖提醒'
  ];

  const renderSignalBadge = (signal: Signal) => {
    const isBullish = signal.type === 'bullish';
    return (
      <div 
        key={`${signal.indicator}-${signal.message}`}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
          isBullish 
            ? 'bg-green-500/10 border border-green-500/30 text-green-400' 
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}
      >
        {isBullish ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        <span className="font-medium">{signal.indicator}</span>
        <span className="text-gray-400">|</span>
        <span>{signal.message}</span>
      </div>
    );
  };

  // 渲染思考气泡
  const renderThinkingBubble = (bubble: ThinkingBubble) => {
    const getIcon = () => {
      switch (bubble.type) {
        case 'thinking':
          return <Lightbulb className="h-3 w-3 text-yellow-400 animate-pulse" />;
        case 'tool_call':
          return <Wrench className="h-3 w-3 text-blue-400 animate-spin" />;
        case 'tool_result':
          return <CheckCircle className="h-3 w-3 text-green-400" />;
        case 'thinking_end':
          return <CheckCircle className="h-3 w-3 text-green-400" />;
        default:
          return <Loader2 className="h-3 w-3 animate-spin" />;
      }
    };

    const getBgColor = () => {
      switch (bubble.type) {
        case 'thinking':
          return 'bg-yellow-500/10 border-yellow-500/30';
        case 'tool_call':
          return 'bg-blue-500/10 border-blue-500/30';
        case 'tool_result':
          return 'bg-green-500/10 border-green-500/30';
        case 'thinking_end':
          return 'bg-green-500/10 border-green-500/30';
        default:
          return 'bg-gray-500/10 border-gray-500/30';
      }
    };

    return (
      <motion.div
        key={bubble.id}
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border ${getBgColor()}`}
      >
        {getIcon()}
        <span className="text-gray-300">{bubble.content}</span>
      </motion.div>
    );
  };

  const currentStyle = INVESTMENT_STYLES[investmentStyle as keyof typeof INVESTMENT_STYLES];

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className={`fixed right-0 top-1/2 -translate-y-1/2 z-40 p-2 bg-[#1A1A2E] border border-[#2D2D3A] rounded-l-lg hover:bg-[#2D2D3A] transition-colors ${isOpen ? 'hidden' : ''}`}
      >
        <ChevronLeft className="h-5 w-5 text-[#00D4AA]" />
      </button>

      {/* Sidebar */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-16 bottom-0 w-[420px] bg-[#0A0A0F] border-l border-[#2D2D3A] z-30 flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-[#2D2D3A]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-gradient-to-br from-[#00D4AA] to-[#00B894] rounded-lg">
                    <Brain className="h-5 w-5 text-black" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold">小金 · AI金融助手</h3>
                    <p className="text-xs text-gray-500">
                      {stockInfo ? `分析: ${stockInfo.name}` : '请选择股票'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAuthenticated && stockInfo && messages.length > 0 && (
                    <button
                      onClick={handleSaveAnalysis}
                      disabled={savingAnalysis}
                      className="p-2 text-gray-400 hover:text-[#00D4AA] hover:bg-[#1A1A2E] rounded-lg transition-colors"
                      title="保存分析记录"
                    >
                      <Save className={`h-4 w-4 ${savingAnalysis ? 'animate-pulse' : ''}`} />
                    </button>
                  )}
                  {stockInfo && (
                    <button
                      onClick={() => setShowAnalysis(!showAnalysis)}
                      className={`p-2 rounded-lg transition-colors ${
                        showAnalysis 
                          ? 'bg-[#00D4AA]/20 text-[#00D4AA]' 
                          : 'text-gray-400 hover:text-white hover:bg-[#1A1A2E]'
                      }`}
                      title="技术分析"
                    >
                      <BarChart3 className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setShowStylePicker(!showStylePicker)}
                    className={`p-2 rounded-lg transition-colors ${
                      showStylePicker 
                        ? 'bg-[#00D4AA]/20 text-[#00D4AA]' 
                        : 'text-gray-400 hover:text-white hover:bg-[#1A1A2E]'
                    }`}
                    title="投资风格设置"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleClearMessages}
                    className="p-2 text-gray-400 hover:text-white hover:bg-[#1A1A2E] rounded-lg transition-colors"
                    title="清空对话"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={onToggle}
                    className="p-2 text-gray-400 hover:text-white hover:bg-[#1A1A2E] rounded-lg transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* 当前投资风格显示 */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r ${currentStyle?.color} bg-opacity-20`}>
                <span className="text-lg">{currentStyle?.icon}</span>
                <div className="flex-1">
                  <p className="text-white text-sm font-medium">{currentStyle?.name}</p>
                  <p className="text-white/60 text-xs">{currentStyle?.description}</p>
                </div>
              </div>
            </div>

            {/* 投资风格选择器 */}
            <AnimatePresence>
              {showStylePicker && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-b border-[#2D2D3A] overflow-hidden"
                >
                  <div className="p-4 space-y-2">
                    <p className="text-xs text-gray-500 mb-2">选择您的投资风格：</p>
                    {Object.entries(INVESTMENT_STYLES).map(([key, style]) => (
                      <button
                        key={key}
                        onClick={() => handleStyleChange(key)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                          investmentStyle === key
                            ? `bg-gradient-to-r ${style.color} text-white`
                            : 'bg-[#1A1A2E] text-gray-300 hover:bg-[#2D2D3A]'
                        }`}
                      >
                        <span className="text-xl">{style.icon}</span>
                        <div className="text-left flex-1">
                          <p className="font-medium text-sm">{style.name}</p>
                          <p className={`text-xs ${investmentStyle === key ? 'text-white/80' : 'text-gray-500'}`}>
                            {style.description}
                          </p>
                        </div>
                        {investmentStyle === key && (
                          <CheckCircle className="h-4 w-4" />
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Analysis Panel */}
            <AnimatePresence>
              {showAnalysis && analysisData && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-b border-[#2D2D3A] overflow-hidden"
                >
                  <div className="p-4 space-y-4">
                    {/* Price Info */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">最新价格</p>
                        <p className="text-2xl font-bold text-white">
                          ¥{analysisData.latest_price.toFixed(2)}
                        </p>
                      </div>
                      <div className={`px-3 py-1 rounded-lg ${
                        analysisData.pct_change >= 0 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        <span className="text-lg font-semibold">
                          {analysisData.pct_change >= 0 ? '+' : ''}{analysisData.pct_change.toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    {/* Indicators Grid */}
                    <div className="grid grid-cols-3 gap-2">
                      {analysisData.indicators.ma5 && (
                        <div className="bg-[#1A1A2E] rounded-lg p-2 text-center">
                          <p className="text-xs text-gray-500">MA5</p>
                          <p className="text-sm text-white font-medium">{analysisData.indicators.ma5.toFixed(2)}</p>
                        </div>
                      )}
                      {analysisData.indicators.ma10 && (
                        <div className="bg-[#1A1A2E] rounded-lg p-2 text-center">
                          <p className="text-xs text-gray-500">MA10</p>
                          <p className="text-sm text-white font-medium">{analysisData.indicators.ma10.toFixed(2)}</p>
                        </div>
                      )}
                      {analysisData.indicators.ma20 && (
                        <div className="bg-[#1A1A2E] rounded-lg p-2 text-center">
                          <p className="text-xs text-gray-500">MA20</p>
                          <p className="text-sm text-white font-medium">{analysisData.indicators.ma20.toFixed(2)}</p>
                        </div>
                      )}
                      {analysisData.indicators.rsi && (
                        <div className="bg-[#1A1A2E] rounded-lg p-2 text-center">
                          <p className="text-xs text-gray-500">RSI</p>
                          <p className={`text-sm font-medium ${
                            analysisData.indicators.rsi > 70 ? 'text-red-400' :
                            analysisData.indicators.rsi < 30 ? 'text-green-400' : 'text-white'
                          }`}>{analysisData.indicators.rsi.toFixed(1)}</p>
                        </div>
                      )}
                      {analysisData.indicators.kdj_k && (
                        <div className="bg-[#1A1A2E] rounded-lg p-2 text-center">
                          <p className="text-xs text-gray-500">KDJ(K)</p>
                          <p className="text-sm text-white font-medium">{analysisData.indicators.kdj_k.toFixed(1)}</p>
                        </div>
                      )}
                      {analysisData.indicators.macd && (
                        <div className="bg-[#1A1A2E] rounded-lg p-2 text-center">
                          <p className="text-xs text-gray-500">MACD</p>
                          <p className={`text-sm font-medium ${
                            analysisData.indicators.macd > 0 ? 'text-green-400' : 'text-red-400'
                          }`}>{analysisData.indicators.macd.toFixed(3)}</p>
                        </div>
                      )}
                    </div>

                    {/* Signals */}
                    {analysisData.signals.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Activity className="h-3 w-3" /> 交易信号
                        </p>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {analysisData.signals.map(renderSignalBadge)}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <Sparkles className="h-12 w-12 text-[#00D4AA] mx-auto mb-4 opacity-50" />
                  <p className="text-gray-400 mb-4">
                    {stockInfo 
                      ? `我已准备好以${currentStyle?.name}视角分析 ${stockInfo.name}，有什么想了解的？`
                      : '请先选择一只股票，我将为您提供专业分析'}
                  </p>
                  
                  {!isAuthenticated && (
                    <p className="text-xs text-[#00D4AA] mb-4">
                      登录后可保存分析记录
                    </p>
                  )}
                  
                  {/* 监控功能提示 */}
                  <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-purple-400 text-sm mb-1">
                      <Code2 className="h-4 w-4" />
                      <span className="font-medium">AI脚本监控</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      试试说"如果出现金叉通知我"，AI将自动生成监控脚本
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 mb-2">快捷提问：</p>
                    <div className="grid grid-cols-2 gap-2">
                      {quickQuestions.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => setInput(q)}
                          className={`text-left px-3 py-2 border rounded-lg text-sm transition-colors ${
                            hasMonitorIntent(q)
                              ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20'
                              : 'bg-[#1A1A2E] border-[#2D2D3A] text-gray-300 hover:border-[#00D4AA]/50 hover:text-white'
                          }`}
                        >
                          {hasMonitorIntent(q) && <Code2 className="h-3 w-3 inline mr-1" />}
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        msg.role === 'user' 
                          ? 'bg-[#2D2D3A]' 
                          : 'bg-gradient-to-br from-[#00D4AA] to-[#00B894]'
                      }`}>
                        {msg.role === 'user' 
                          ? <User className="h-4 w-4 text-gray-300" />
                          : <Bot className="h-4 w-4 text-black" />
                        }
                      </div>
                      <div className={`flex-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                        <div className={`inline-block max-w-[85%] px-4 py-2 rounded-2xl ${
                          msg.role === 'user'
                            ? 'bg-[#00D4AA] text-black'
                            : msg.messageType === 'error'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-[#1A1A2E] text-gray-300'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">
                            {msg.content || (loading && msg.role === 'assistant' ? '' : '')}
                            {loading && msg.role === 'assistant' && !msg.content && (
                              <span className="inline-flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span className="animate-pulse">正在生成...</span>
                              </span>
                            )}
                            {/* 打字光标效果 */}
                            {loading && msg.role === 'assistant' && msg.content && (
                              <span className="inline-block w-0.5 h-4 bg-[#00D4AA] ml-0.5 animate-pulse" />
                            )}
                          </p>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          {msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                  
                  {/* 思考气泡区域 */}
                  <AnimatePresence>
                    {isThinking && thinkingBubbles.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-2 ml-11"
                      >
                        {thinkingBubbles.map(renderThinkingBubble)}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-[#2D2D3A]">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={stockInfo ? `以${currentStyle?.name}视角询问 ${stockInfo.name}...` : '请先选择股票...'}
                  disabled={loading}
                  rows={1}
                  className="flex-1 px-4 py-2 bg-[#1A1A2E] border border-[#2D2D3A] rounded-xl text-white placeholder:text-gray-500 focus:border-[#00D4AA] focus:outline-none resize-none"
                  style={{ minHeight: '44px', maxHeight: '120px' }}
                />
                <Button
                  onClick={sendMessageWithSSE}
                  disabled={!input.trim() || loading}
                  className="bg-gradient-to-r from-[#00D4AA] to-[#00B894] text-black hover:opacity-90 px-4"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-600 mt-2 text-center">
                按 Enter 发送，Shift + Enter 换行 | 支持监控提醒功能
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
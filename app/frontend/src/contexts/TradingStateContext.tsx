import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// 股票信息接口
interface StockInfo {
  ts_code: string;
  name: string;
}

// K线数据接口
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

// 聊天消息接口
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string; // ISO string for serialization
  messageType?: 'text' | 'thinking' | 'tool_call' | 'tool_result' | 'error';
  toolName?: string;
}

// 交易页面状态接口
interface TradingState {
  selectedStock: StockInfo | null;
  klineData: KLineData[];
  chatMessages: ChatMessage[];
  period: 'D' | 'W' | 'M';
  dataSource: string;
  aiSidebarOpen: boolean;
  showScriptPanel: boolean;
  latestUserInput: string;
  investmentStyle: string;
  lastUpdated: string;
}

// 默认状态
const defaultState: TradingState = {
  selectedStock: null,
  klineData: [],
  chatMessages: [],
  period: 'D',
  dataSource: 'eastmoney',
  aiSidebarOpen: true,
  showScriptPanel: false,
  latestUserInput: '',
  investmentStyle: 'balanced',
  lastUpdated: new Date().toISOString(),
};

// 存储键名
const STORAGE_KEY = 'trading_page_state';
// 状态过期时间（24小时）
const STATE_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Context接口
interface TradingStateContextType {
  state: TradingState;
  setSelectedStock: (stock: StockInfo | null) => void;
  setKlineData: (data: KLineData[]) => void;
  setChatMessages: (messages: ChatMessage[]) => void;
  addChatMessage: (message: ChatMessage) => void;
  updateChatMessage: (id: string, updates: Partial<ChatMessage>) => void;
  clearChatMessages: () => void;
  setPeriod: (period: 'D' | 'W' | 'M') => void;
  setDataSource: (source: string) => void;
  setAiSidebarOpen: (open: boolean) => void;
  setShowScriptPanel: (show: boolean) => void;
  setLatestUserInput: (input: string) => void;
  setInvestmentStyle: (style: string) => void;
  clearState: () => void;
}

const TradingStateContext = createContext<TradingStateContextType | undefined>(undefined);

// 从localStorage加载状态
const loadStateFromStorage = (): TradingState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as TradingState;
      // 检查状态是否过期
      const lastUpdated = new Date(parsed.lastUpdated).getTime();
      const now = Date.now();
      if (now - lastUpdated < STATE_EXPIRY_MS) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('Failed to load trading state from storage:', error);
  }
  return defaultState;
};

// 保存状态到localStorage
const saveStateToStorage = (state: TradingState) => {
  try {
    const stateToSave = {
      ...state,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  } catch (error) {
    console.error('Failed to save trading state to storage:', error);
  }
};

// Provider组件
export function TradingStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TradingState>(() => loadStateFromStorage());

  // 当状态变化时保存到localStorage
  useEffect(() => {
    saveStateToStorage(state);
  }, [state]);

  // 设置选中的股票
  const setSelectedStock = useCallback((stock: StockInfo | null) => {
    setState(prev => ({ ...prev, selectedStock: stock }));
  }, []);

  // 设置K线数据
  const setKlineData = useCallback((data: KLineData[]) => {
    setState(prev => ({ ...prev, klineData: data }));
  }, []);

  // 设置聊天消息
  const setChatMessages = useCallback((messages: ChatMessage[]) => {
    setState(prev => ({ ...prev, chatMessages: messages }));
  }, []);

  // 添加聊天消息
  const addChatMessage = useCallback((message: ChatMessage) => {
    setState(prev => ({
      ...prev,
      chatMessages: [...prev.chatMessages, message],
    }));
  }, []);

  // 更新聊天消息
  const updateChatMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
    setState(prev => ({
      ...prev,
      chatMessages: prev.chatMessages.map(msg =>
        msg.id === id ? { ...msg, ...updates } : msg
      ),
    }));
  }, []);

  // 清空聊天消息
  const clearChatMessages = useCallback(() => {
    setState(prev => ({ ...prev, chatMessages: [] }));
  }, []);

  // 设置周期
  const setPeriod = useCallback((period: 'D' | 'W' | 'M') => {
    setState(prev => ({ ...prev, period }));
  }, []);

  // 设置数据源
  const setDataSource = useCallback((source: string) => {
    setState(prev => ({ ...prev, dataSource: source }));
  }, []);

  // 设置AI侧边栏开关
  const setAiSidebarOpen = useCallback((open: boolean) => {
    setState(prev => ({ ...prev, aiSidebarOpen: open }));
  }, []);

  // 设置脚本面板显示
  const setShowScriptPanel = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, showScriptPanel: show }));
  }, []);

  // 设置最新用户输入
  const setLatestUserInput = useCallback((input: string) => {
    setState(prev => ({ ...prev, latestUserInput: input }));
  }, []);

  // 设置投资风格
  const setInvestmentStyle = useCallback((style: string) => {
    setState(prev => ({ ...prev, investmentStyle: style }));
  }, []);

  // 清空所有状态
  const clearState = useCallback(() => {
    setState(defaultState);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value: TradingStateContextType = {
    state,
    setSelectedStock,
    setKlineData,
    setChatMessages,
    addChatMessage,
    updateChatMessage,
    clearChatMessages,
    setPeriod,
    setDataSource,
    setAiSidebarOpen,
    setShowScriptPanel,
    setLatestUserInput,
    setInvestmentStyle,
    clearState,
  };

  return (
    <TradingStateContext.Provider value={value}>
      {children}
    </TradingStateContext.Provider>
  );
}

// 自定义Hook
export function useTradingState() {
  const context = useContext(TradingStateContext);
  if (context === undefined) {
    throw new Error('useTradingState must be used within a TradingStateProvider');
  }
  return context;
}

export type { StockInfo, KLineData, ChatMessage, TradingState };
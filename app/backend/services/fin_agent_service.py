"""
金融AI助手服务 - 基于fin-agent的功能实现
提供智能金融分析、技术指标计算、投资建议等功能
"""

import logging
from typing import Optional, List, Dict, Any
from datetime import datetime

from openai import AsyncOpenAI
from services.tushare_service import TushareService, MOCK_STOCKS
from core.ai_config import get_builtin_model, BUILTIN_AI_MODELS

logger = logging.getLogger(__name__)

# 技术指标计算函数
def calculate_ma(prices: List[float], period: int) -> List[Optional[float]]:
    """计算移动平均线"""
    result = []
    for i in range(len(prices)):
        if i < period - 1:
            result.append(None)
        else:
            result.append(sum(prices[i - period + 1:i + 1]) / period)
    return result

def calculate_ema(prices: List[float], period: int) -> List[float]:
    """计算指数移动平均线"""
    if not prices:
        return []
    
    multiplier = 2 / (period + 1)
    ema = [prices[0]]
    
    for i in range(1, len(prices)):
        ema.append((prices[i] - ema[-1]) * multiplier + ema[-1])
    
    return ema

def calculate_macd(prices: List[float], fast: int = 12, slow: int = 26, signal: int = 9) -> Dict[str, List[float]]:
    """计算MACD指标"""
    if len(prices) < slow:
        return {"macd": [], "signal": [], "histogram": []}
    
    ema_fast = calculate_ema(prices, fast)
    ema_slow = calculate_ema(prices, slow)
    
    macd_line = [f - s for f, s in zip(ema_fast, ema_slow)]
    signal_line = calculate_ema(macd_line, signal)
    histogram = [m - s for m, s in zip(macd_line, signal_line)]
    
    return {
        "macd": macd_line,
        "signal": signal_line,
        "histogram": histogram
    }

def calculate_rsi(prices: List[float], period: int = 14) -> List[Optional[float]]:
    """计算RSI指标"""
    if len(prices) < period + 1:
        return [None] * len(prices)
    
    result = [None] * period
    
    gains = []
    losses = []
    
    for i in range(1, len(prices)):
        change = prices[i] - prices[i - 1]
        if change > 0:
            gains.append(change)
            losses.append(0)
        else:
            gains.append(0)
            losses.append(abs(change))
    
    avg_gain = sum(gains[:period]) / period
    avg_loss = sum(losses[:period]) / period
    
    if avg_loss == 0:
        result.append(100)
    else:
        rs = avg_gain / avg_loss
        result.append(100 - (100 / (1 + rs)))
    
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        
        if avg_loss == 0:
            result.append(100)
        else:
            rs = avg_gain / avg_loss
            result.append(100 - (100 / (1 + rs)))
    
    return result

def calculate_kdj(high: List[float], low: List[float], close: List[float], period: int = 9) -> Dict[str, List[Optional[float]]]:
    """计算KDJ指标"""
    if len(close) < period:
        return {"k": [], "d": [], "j": []}
    
    k_values = []
    d_values = []
    j_values = []
    
    for i in range(len(close)):
        if i < period - 1:
            k_values.append(None)
            d_values.append(None)
            j_values.append(None)
        else:
            highest = max(high[i - period + 1:i + 1])
            lowest = min(low[i - period + 1:i + 1])
            
            if highest == lowest:
                rsv = 50
            else:
                rsv = (close[i] - lowest) / (highest - lowest) * 100
            
            if i == period - 1:
                k = rsv
                d = rsv
            else:
                k = 2/3 * k_values[-1] + 1/3 * rsv
                d = 2/3 * d_values[-1] + 1/3 * k
            
            j = 3 * k - 2 * d
            
            k_values.append(round(k, 2))
            d_values.append(round(d, 2))
            j_values.append(round(j, 2))
    
    return {"k": k_values, "d": d_values, "j": j_values}

def calculate_bollinger_bands(prices: List[float], period: int = 20, std_dev: float = 2) -> Dict[str, List[Optional[float]]]:
    """计算布林带"""
    if len(prices) < period:
        return {"upper": [], "middle": [], "lower": []}
    
    upper = []
    middle = []
    lower = []
    
    for i in range(len(prices)):
        if i < period - 1:
            upper.append(None)
            middle.append(None)
            lower.append(None)
        else:
            window = prices[i - period + 1:i + 1]
            ma = sum(window) / period
            variance = sum((x - ma) ** 2 for x in window) / period
            std = variance ** 0.5
            
            middle.append(round(ma, 2))
            upper.append(round(ma + std_dev * std, 2))
            lower.append(round(ma - std_dev * std, 2))
    
    return {"upper": upper, "middle": middle, "lower": lower}


def format_indicator(value: Optional[float], decimals: int = 2) -> str:
    """格式化指标值，处理None的情况"""
    if value is None:
        return "N/A"
    return f"{value:.{decimals}f}"


class FinAgentService:
    """金融AI助手服务类"""
    
    def __init__(self):
        self.tushare_service = TushareService()
        self._ai_clients: Dict[str, AsyncOpenAI] = {}
        self._default_model_id = "deepseek-v3.2"
    
    def _get_ai_client(self, model_id: str = None) -> tuple[AsyncOpenAI, str]:
        """获取AI客户端和模型名称"""
        model_id = model_id or self._default_model_id
        
        if model_id not in self._ai_clients:
            model_config = get_builtin_model(model_id)
            if not model_config:
                # 回退到默认模型
                model_config = get_builtin_model(self._default_model_id)
                model_id = self._default_model_id
            
            if model_config:
                self._ai_clients[model_id] = AsyncOpenAI(
                    api_key=model_config.api_key,
                    base_url=model_config.base_url,
                )
        
        model_config = get_builtin_model(model_id)
        return self._ai_clients.get(model_id), model_config.model_name if model_config else "deepseek-chat"
    
    def _get_system_prompt(self) -> str:
        """获取系统提示词"""
        return """你是一个专业的金融分析助手，名叫"小金"。你可以帮助用户：

1. **股票分析**：分析A股、港股、美股等市场的股票，提供技术分析和基本面分析
2. **技术指标解读**：解释MACD、RSI、KDJ、布林带等技术指标的含义和交易信号
3. **市场趋势**：分析市场整体趋势，识别热点板块和概念
4. **投资建议**：根据用户的风险偏好提供个性化的投资建议
5. **财经知识**：解答金融、投资相关的问题

注意事项：
- 所有投资建议仅供参考，不构成实际投资建议
- 股市有风险，投资需谨慎
- 回答要专业但易懂，适合普通投资者理解
- 使用中文回答，保持友好和专业的语气
- 根据用户的问题给出具体、有针对性的回答，不要总是返回固定的模板回复"""
    
    async def analyze_stock(self, ts_code: str) -> Dict[str, Any]:
        """分析单只股票"""
        try:
            # 获取股票信息
            stock_info = await self.tushare_service.get_stock_info(ts_code)
            
            # 获取K线数据
            klines = await self.tushare_service.get_daily_kline(ts_code, period="daily")
            
            if not klines:
                return {
                    "success": False,
                    "message": "无法获取股票数据"
                }
            
            # 提取价格数据
            closes = [k["close"] for k in klines]
            highs = [k["high"] for k in klines]
            lows = [k["low"] for k in klines]
            
            # 计算技术指标
            ma5 = calculate_ma(closes, 5)
            ma10 = calculate_ma(closes, 10)
            ma20 = calculate_ma(closes, 20)
            macd = calculate_macd(closes)
            rsi = calculate_rsi(closes)
            kdj = calculate_kdj(highs, lows, closes)
            boll = calculate_bollinger_bands(closes)
            
            # 获取最新数据
            latest = klines[-1]
            latest_close = latest["close"]
            latest_pct_chg = latest.get("pct_chg", 0)
            
            # 生成技术分析摘要
            analysis = {
                "stock_info": stock_info,
                "latest_price": latest_close,
                "pct_change": latest_pct_chg,
                "indicators": {
                    "ma5": ma5[-1] if ma5 and ma5[-1] else None,
                    "ma10": ma10[-1] if ma10 and ma10[-1] else None,
                    "ma20": ma20[-1] if ma20 and ma20[-1] else None,
                    "macd": macd["macd"][-1] if macd["macd"] else None,
                    "macd_signal": macd["signal"][-1] if macd["signal"] else None,
                    "macd_histogram": macd["histogram"][-1] if macd["histogram"] else None,
                    "rsi": rsi[-1] if rsi and rsi[-1] else None,
                    "kdj_k": kdj["k"][-1] if kdj["k"] and kdj["k"][-1] else None,
                    "kdj_d": kdj["d"][-1] if kdj["d"] and kdj["d"][-1] else None,
                    "kdj_j": kdj["j"][-1] if kdj["j"] and kdj["j"][-1] else None,
                    "boll_upper": boll["upper"][-1] if boll["upper"] and boll["upper"][-1] else None,
                    "boll_middle": boll["middle"][-1] if boll["middle"] and boll["middle"][-1] else None,
                    "boll_lower": boll["lower"][-1] if boll["lower"] and boll["lower"][-1] else None,
                },
                "signals": self._generate_signals(latest_close, ma5, ma10, ma20, macd, rsi, kdj, boll)
            }
            
            return {
                "success": True,
                "data": analysis
            }
            
        except Exception as e:
            logger.error(f"分析股票失败: {e}")
            return {
                "success": False,
                "message": str(e)
            }
    
    def _generate_signals(
        self, 
        price: float, 
        ma5: List, 
        ma10: List, 
        ma20: List,
        macd: Dict,
        rsi: List,
        kdj: Dict,
        boll: Dict
    ) -> List[Dict[str, str]]:
        """生成交易信号"""
        signals = []
        
        # MA信号
        if ma5[-1] and ma10[-1]:
            if ma5[-1] > ma10[-1] and ma5[-2] and ma10[-2] and ma5[-2] <= ma10[-2]:
                signals.append({"type": "bullish", "indicator": "MA", "message": "MA5上穿MA10，金叉信号"})
            elif ma5[-1] < ma10[-1] and ma5[-2] and ma10[-2] and ma5[-2] >= ma10[-2]:
                signals.append({"type": "bearish", "indicator": "MA", "message": "MA5下穿MA10，死叉信号"})
        
        # MACD信号
        if macd["macd"] and macd["signal"] and len(macd["macd"]) >= 2:
            if macd["macd"][-1] > macd["signal"][-1] and macd["macd"][-2] <= macd["signal"][-2]:
                signals.append({"type": "bullish", "indicator": "MACD", "message": "MACD金叉，买入信号"})
            elif macd["macd"][-1] < macd["signal"][-1] and macd["macd"][-2] >= macd["signal"][-2]:
                signals.append({"type": "bearish", "indicator": "MACD", "message": "MACD死叉，卖出信号"})
        
        # RSI信号
        if rsi and rsi[-1]:
            if rsi[-1] < 30:
                signals.append({"type": "bullish", "indicator": "RSI", "message": f"RSI={rsi[-1]:.1f}，超卖区域，可能反弹"})
            elif rsi[-1] > 70:
                signals.append({"type": "bearish", "indicator": "RSI", "message": f"RSI={rsi[-1]:.1f}，超买区域，注意回调"})
        
        # KDJ信号
        if kdj["k"] and kdj["d"] and kdj["k"][-1] and kdj["d"][-1]:
            if kdj["k"][-1] < 20 and kdj["d"][-1] < 20:
                signals.append({"type": "bullish", "indicator": "KDJ", "message": "KDJ低位，超卖信号"})
            elif kdj["k"][-1] > 80 and kdj["d"][-1] > 80:
                signals.append({"type": "bearish", "indicator": "KDJ", "message": "KDJ高位，超买信号"})
        
        # 布林带信号
        if boll["upper"] and boll["lower"] and boll["upper"][-1] and boll["lower"][-1]:
            if price <= boll["lower"][-1]:
                signals.append({"type": "bullish", "indicator": "BOLL", "message": "价格触及布林带下轨，可能反弹"})
            elif price >= boll["upper"][-1]:
                signals.append({"type": "bearish", "indicator": "BOLL", "message": "价格触及布林带上轨，注意回调"})
        
        return signals
    
    def _build_context(self, data: Dict[str, Any], ts_code: str) -> str:
        """构建股票分析上下文"""
        indicators = data['indicators']
        
        # 使用辅助函数格式化指标
        ma5_str = format_indicator(indicators['ma5'])
        ma10_str = format_indicator(indicators['ma10'])
        ma20_str = format_indicator(indicators['ma20'])
        macd_str = format_indicator(indicators['macd'], 4)
        rsi_str = format_indicator(indicators['rsi'])
        
        # KDJ值
        kdj_k = indicators['kdj_k'] if indicators['kdj_k'] is not None else 'N/A'
        kdj_d = indicators['kdj_d'] if indicators['kdj_d'] is not None else 'N/A'
        kdj_j = indicators['kdj_j'] if indicators['kdj_j'] is not None else 'N/A'
        
        # 涨跌幅
        pct_change = data['pct_change']
        pct_str = f"{pct_change:.2f}" if pct_change is not None else "0.00"
        
        context = f"""当前分析的股票：{data['stock_info'].get('name', ts_code)} ({ts_code})
最新价格：{data['latest_price']}
涨跌幅：{pct_str}%

技术指标：
- MA5: {ma5_str}
- MA10: {ma10_str}
- MA20: {ma20_str}
- MACD: {macd_str}
- RSI: {rsi_str}
- KDJ(K/D/J): {kdj_k}/{kdj_d}/{kdj_j}

交易信号：
"""
        for signal in data['signals']:
            context += f"- [{signal['type'].upper()}] {signal['indicator']}: {signal['message']}\n"
        
        return context
    
    async def chat(self, message: str, history: List[Dict[str, str]] = None, ts_code: str = None, model_id: str = None) -> str:
        """与AI助手对话"""
        try:
            # 获取AI客户端
            client, model_name = self._get_ai_client(model_id)
            
            if not client:
                logger.warning("AI client not available, using fallback response")
                return self._generate_fallback_response(message, ts_code, "")
            
            # 构建消息历史
            messages = [{"role": "system", "content": self._get_system_prompt()}]
            
            # 如果有股票代码，添加股票分析上下文
            context = ""
            if ts_code:
                analysis = await self.analyze_stock(ts_code)
                if analysis["success"]:
                    context = self._build_context(analysis["data"], ts_code)
            
            # 添加历史消息
            if history:
                for h in history[-10:]:  # 只保留最近10条历史
                    messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
            
            # 添加当前消息（包含上下文）
            user_message = message
            if context:
                user_message = f"{context}\n\n用户问题：{message}"
            
            messages.append({"role": "user", "content": user_message})
            
            # 调用AI服务
            logger.info(f"Calling AI service with model: {model_name}")
            response = await client.chat.completions.create(
                model=model_name,
                messages=messages,
                temperature=0.7,
                max_tokens=2000,
                stream=False,
            )
            
            content = response.choices[0].message.content or ""
            logger.info(f"AI response received, length: {len(content)}")
            return content
            
        except Exception as e:
            logger.error(f"AI对话失败: {e}", exc_info=True)
            return self._generate_fallback_response(message, ts_code, "")
    
    def _generate_fallback_response(self, message: str, ts_code: str = None, context: str = "") -> str:
        """生成备用回复（当AI服务不可用时）"""
        message_lower = message.lower()
        
        # 问候语
        if any(word in message_lower for word in ["你好", "hi", "hello", "嗨"]):
            return "你好！我是小金，你的金融分析助手。我可以帮你分析股票、解读技术指标、提供投资建议。请问有什么可以帮助你的？"
        
        # 股票分析相关
        if ts_code and context:
            return f"""根据当前的技术分析数据：

{context}

**分析建议**：
1. 请关注各项技术指标的变化趋势
2. 结合成交量判断买卖信号的有效性
3. 设置合理的止损止盈位置
4. 投资有风险，建议分散投资

如需更详细的分析，请告诉我您具体想了解哪方面的信息。"""
        
        # MACD相关
        if "macd" in message_lower:
            return """**MACD指标解读**：

MACD（移动平均收敛散度）是一种趋势跟踪动量指标：

1. **金叉信号**：MACD线上穿信号线，可能是买入时机
2. **死叉信号**：MACD线下穿信号线，可能是卖出时机
3. **零轴上方**：多头市场，趋势向上
4. **零轴下方**：空头市场，趋势向下
5. **背离**：价格与MACD走势相反，可能预示趋势反转

建议结合其他指标和基本面分析综合判断。"""
        
        # RSI相关
        if "rsi" in message_lower:
            return """**RSI指标解读**：

RSI（相对强弱指数）衡量价格变动的速度和幅度：

1. **RSI > 70**：超买区域，可能面临回调
2. **RSI < 30**：超卖区域，可能出现反弹
3. **RSI = 50**：多空平衡点
4. **背离信号**：价格创新高/低但RSI未能同步，预示趋势可能反转

RSI最适合在震荡市场中使用，趋势市场中可能出现钝化。"""
        
        # KDJ相关
        if "kdj" in message_lower:
            return """**KDJ指标解读**：

KDJ（随机指标）是一种超买超卖指标：

1. **K线上穿D线**：金叉，买入信号
2. **K线下穿D线**：死叉，卖出信号
3. **J值 > 100**：超买，注意风险
4. **J值 < 0**：超卖，关注机会
5. **低位金叉**：K、D都在20以下金叉，信号更可靠

KDJ对短期波动敏感，适合短线交易参考。"""
        
        # 布林带相关
        if "布林" in message_lower or "boll" in message_lower:
            return """**布林带指标解读**：

布林带由三条线组成，反映价格的波动范围：

1. **上轨**：压力位，价格触及可能回落
2. **中轨**：20日均线，趋势参考线
3. **下轨**：支撑位，价格触及可能反弹
4. **带宽收窄**：波动减小，可能即将突破
5. **带宽扩大**：波动加大，趋势正在形成

布林带适合判断价格的相对高低位置。"""
        
        # 分析走势相关
        if any(word in message_lower for word in ["分析", "走势", "趋势", "建议"]):
            if ts_code:
                return f"""正在为您分析股票 {ts_code}...

请稍等，AI正在处理您的请求。如果长时间没有响应，您可以：
1. 查看右侧的技术指标面板获取实时数据
2. 点击技术分析按钮查看详细的指标信号
3. 稍后重新发送您的问题

感谢您的耐心等待！"""
            else:
                return """请先选择一只股票，我将为您提供专业的技术分析。

您可以：
1. 在搜索框中输入股票代码或名称
2. 从热门股票列表中选择
3. 选择后我会自动加载该股票的K线数据和技术指标"""
        
        # 默认回复 - 根据是否有股票上下文给出不同回复
        if ts_code:
            return f"""我正在分析 {ts_code}，请问您想了解哪方面的信息？

您可以问我：
- 这只股票的走势如何？
- 支撑位和压力位在哪里？
- MACD/RSI/KDJ指标怎么看？
- 短期操作建议是什么？"""
        else:
            return """我是小金，你的金融分析助手。我可以帮助你：

1. 📈 **股票分析**：选择一只股票，我会为你提供技术分析
2. 📊 **指标解读**：解释MACD、RSI、KDJ等技术指标
3. 💡 **投资建议**：根据你的情况提供参考建议
4. 📚 **财经知识**：解答投资相关的问题

请告诉我你想了解什么？你可以：
- 输入股票代码让我分析
- 询问某个技术指标的含义
- 咨询投资相关的问题"""
    
    async def get_market_overview(self) -> Dict[str, Any]:
        """获取市场概览"""
        try:
            # 获取主要指数和热门股票
            hot_stocks = MOCK_STOCKS[:5]
            
            overview = {
                "hot_stocks": [],
                "market_sentiment": "neutral",
                "update_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            
            for stock in hot_stocks:
                klines = await self.tushare_service.get_daily_kline(stock["ts_code"], period="daily")
                if klines:
                    latest = klines[-1]
                    overview["hot_stocks"].append({
                        "ts_code": stock["ts_code"],
                        "name": stock["name"],
                        "price": latest["close"],
                        "pct_chg": latest.get("pct_chg", 0)
                    })
            
            # 计算市场情绪
            if overview["hot_stocks"]:
                avg_change = sum(s["pct_chg"] for s in overview["hot_stocks"]) / len(overview["hot_stocks"])
                if avg_change > 1:
                    overview["market_sentiment"] = "bullish"
                elif avg_change < -1:
                    overview["market_sentiment"] = "bearish"
            
            return overview
            
        except Exception as e:
            logger.error(f"获取市场概览失败: {e}")
            return {
                "hot_stocks": [],
                "market_sentiment": "unknown",
                "update_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }


# 创建服务实例
fin_agent_service = FinAgentService()
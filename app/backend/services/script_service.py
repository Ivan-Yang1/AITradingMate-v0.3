"""交易脚本服务 - AI生成PineScript/Python脚本并监控执行"""
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
import json
import re

logger = logging.getLogger(__name__)


class ScriptService:
    """交易脚本服务"""
    
    # 支持的脚本类型
    SCRIPT_TYPES = {
        'pinescript': {
            'name': 'PineScript',
            'extension': '.pine',
            'description': 'TradingView PineScript脚本',
        },
        'python': {
            'name': 'Python',
            'extension': '.py',
            'description': 'Python交易脚本',
        }
    }
    
    # 常用技术指标模板
    INDICATOR_TEMPLATES = {
        'golden_cross': {
            'name': '金叉',
            'description': '短期均线上穿长期均线',
            'condition': 'MA短期 > MA长期 且 前一日MA短期 < 前一日MA长期',
        },
        'death_cross': {
            'name': '死叉',
            'description': '短期均线下穿长期均线',
            'condition': 'MA短期 < MA长期 且 前一日MA短期 > 前一日MA长期',
        },
        'macd_golden_cross': {
            'name': 'MACD金叉',
            'description': 'MACD线上穿信号线',
            'condition': 'MACD > Signal 且 前一日MACD < 前一日Signal',
        },
        'macd_death_cross': {
            'name': 'MACD死叉',
            'description': 'MACD线下穿信号线',
            'condition': 'MACD < Signal 且 前一日MACD > 前一日Signal',
        },
        'rsi_oversold': {
            'name': 'RSI超卖',
            'description': 'RSI低于30',
            'condition': 'RSI < 30',
        },
        'rsi_overbought': {
            'name': 'RSI超买',
            'description': 'RSI高于70',
            'condition': 'RSI > 70',
        },
        'kdj_golden_cross': {
            'name': 'KDJ金叉',
            'description': 'K线上穿D线',
            'condition': 'K > D 且 前一日K < 前一日D',
        },
        'volume_breakout': {
            'name': '放量突破',
            'description': '成交量超过20日均量2倍',
            'condition': 'Volume > MA20_Volume * 2',
        },
        'price_breakout': {
            'name': '价格突破',
            'description': '收盘价突破20日高点',
            'condition': 'Close > 20日最高价',
        },
        'boll_lower': {
            'name': '触及布林下轨',
            'description': '价格触及布林带下轨',
            'condition': 'Close <= BOLL下轨',
        },
        'boll_upper': {
            'name': '触及布林上轨',
            'description': '价格触及布林带上轨',
            'condition': 'Close >= BOLL上轨',
        },
    }
    
    def __init__(self):
        # 存储活跃的监控任务
        self.active_monitors: Dict[str, Dict] = {}
        logger.info("ScriptService initialized")
    
    def parse_user_intent(self, user_input: str) -> Dict[str, Any]:
        """解析用户意图，提取监控条件"""
        intent = {
            'indicators': [],
            'conditions': [],
            'timeframe': 'daily',
            'notification_type': 'alert',
        }
        
        # 检测时间周期
        if any(kw in user_input for kw in ['分钟', '5分钟', '15分钟', '30分钟', '60分钟']):
            if '5分钟' in user_input:
                intent['timeframe'] = '5min'
            elif '15分钟' in user_input:
                intent['timeframe'] = '15min'
            elif '30分钟' in user_input:
                intent['timeframe'] = '30min'
            elif '60分钟' in user_input or '1小时' in user_input:
                intent['timeframe'] = '60min'
        elif any(kw in user_input for kw in ['周线', '周']):
            intent['timeframe'] = 'weekly'
        elif any(kw in user_input for kw in ['月线', '月']):
            intent['timeframe'] = 'monthly'
        
        # 检测指标和条件
        if '金叉' in user_input:
            if 'MACD' in user_input.upper():
                intent['indicators'].append('macd_golden_cross')
                intent['conditions'].append('MACD金叉')
            elif 'KDJ' in user_input.upper():
                intent['indicators'].append('kdj_golden_cross')
                intent['conditions'].append('KDJ金叉')
            else:
                intent['indicators'].append('golden_cross')
                intent['conditions'].append('均线金叉')
        
        if '死叉' in user_input:
            if 'MACD' in user_input.upper():
                intent['indicators'].append('macd_death_cross')
                intent['conditions'].append('MACD死叉')
            else:
                intent['indicators'].append('death_cross')
                intent['conditions'].append('均线死叉')
        
        if any(kw in user_input for kw in ['超卖', 'RSI低于', 'RSI<']):
            intent['indicators'].append('rsi_oversold')
            intent['conditions'].append('RSI超卖')
        
        if any(kw in user_input for kw in ['超买', 'RSI高于', 'RSI>']):
            intent['indicators'].append('rsi_overbought')
            intent['conditions'].append('RSI超买')
        
        if any(kw in user_input for kw in ['放量', '成交量突破', '量能突破']):
            intent['indicators'].append('volume_breakout')
            intent['conditions'].append('放量突破')
        
        if any(kw in user_input for kw in ['突破', '新高', '创新高']):
            intent['indicators'].append('price_breakout')
            intent['conditions'].append('价格突破')
        
        if any(kw in user_input for kw in ['布林下轨', 'BOLL下轨', '下轨']):
            intent['indicators'].append('boll_lower')
            intent['conditions'].append('触及布林下轨')
        
        if any(kw in user_input for kw in ['布林上轨', 'BOLL上轨', '上轨']):
            intent['indicators'].append('boll_upper')
            intent['conditions'].append('触及布林上轨')
        
        return intent
    
    def generate_pinescript(self, stock_code: str, stock_name: str, intent: Dict[str, Any]) -> str:
        """生成PineScript脚本"""
        conditions = intent.get('conditions', [])
        indicators = intent.get('indicators', [])
        timeframe = intent.get('timeframe', 'daily')
        
        # 时间周期映射
        tf_map = {
            'daily': 'D',
            'weekly': 'W',
            'monthly': 'M',
            '5min': '5',
            '15min': '15',
            '30min': '30',
            '60min': '60',
        }
        tf = tf_map.get(timeframe, 'D')
        
        script = f'''// @version=5
// 股票监控脚本 - {stock_name}({stock_code})
// 监控条件: {', '.join(conditions) if conditions else '自定义条件'}
// 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

indicator("{stock_name}监控提醒", overlay=true)

// 参数设置
ma_short = input.int(5, "短期均线周期")
ma_long = input.int(20, "长期均线周期")
rsi_period = input.int(14, "RSI周期")
rsi_oversold = input.int(30, "RSI超卖阈值")
rsi_overbought = input.int(70, "RSI超买阈值")

// 计算指标
ma5 = ta.sma(close, ma_short)
ma20 = ta.sma(close, ma_long)
rsi = ta.rsi(close, rsi_period)
[macd_line, signal_line, hist] = ta.macd(close, 12, 26, 9)
[k, d, j] = ta.kdj(high, low, close, 9, 3, 3)

// 布林带
[bb_middle, bb_upper, bb_lower] = ta.bb(close, 20, 2)

// 成交量均线
vol_ma20 = ta.sma(volume, 20)

'''
        
        # 添加条件检测
        alert_conditions = []
        
        if 'golden_cross' in indicators:
            script += '''
// 均线金叉检测
golden_cross = ta.crossover(ma5, ma20)
plotshape(golden_cross, title="金叉", location=location.belowbar, 
          color=color.green, style=shape.triangleup, size=size.small)
'''
            alert_conditions.append('golden_cross')
        
        if 'death_cross' in indicators:
            script += '''
// 均线死叉检测
death_cross = ta.crossunder(ma5, ma20)
plotshape(death_cross, title="死叉", location=location.abovebar, 
          color=color.red, style=shape.triangledown, size=size.small)
'''
            alert_conditions.append('death_cross')
        
        if 'macd_golden_cross' in indicators:
            script += '''
// MACD金叉检测
macd_golden = ta.crossover(macd_line, signal_line)
plotshape(macd_golden, title="MACD金叉", location=location.belowbar, 
          color=color.lime, style=shape.diamond, size=size.small)
'''
            alert_conditions.append('macd_golden')
        
        if 'macd_death_cross' in indicators:
            script += '''
// MACD死叉检测
macd_death = ta.crossunder(macd_line, signal_line)
plotshape(macd_death, title="MACD死叉", location=location.abovebar, 
          color=color.orange, style=shape.diamond, size=size.small)
'''
            alert_conditions.append('macd_death')
        
        if 'rsi_oversold' in indicators:
            script += '''
// RSI超卖检测
rsi_oversold_signal = ta.crossunder(rsi, rsi_oversold)
plotshape(rsi_oversold_signal, title="RSI超卖", location=location.belowbar, 
          color=color.blue, style=shape.circle, size=size.small)
'''
            alert_conditions.append('rsi_oversold_signal')
        
        if 'rsi_overbought' in indicators:
            script += '''
// RSI超买检测
rsi_overbought_signal = ta.crossover(rsi, rsi_overbought)
plotshape(rsi_overbought_signal, title="RSI超买", location=location.abovebar, 
          color=color.purple, style=shape.circle, size=size.small)
'''
            alert_conditions.append('rsi_overbought_signal')
        
        if 'kdj_golden_cross' in indicators:
            script += '''
// KDJ金叉检测
kdj_golden = ta.crossover(k, d)
plotshape(kdj_golden, title="KDJ金叉", location=location.belowbar, 
          color=color.teal, style=shape.arrowup, size=size.small)
'''
            alert_conditions.append('kdj_golden')
        
        if 'volume_breakout' in indicators:
            script += '''
// 放量突破检测
vol_breakout = volume > vol_ma20 * 2
plotshape(vol_breakout, title="放量", location=location.belowbar, 
          color=color.yellow, style=shape.flag, size=size.small)
'''
            alert_conditions.append('vol_breakout')
        
        if 'price_breakout' in indicators:
            script += '''
// 价格突破检测
highest_20 = ta.highest(high, 20)[1]
price_breakout = close > highest_20
plotshape(price_breakout, title="突破新高", location=location.abovebar, 
          color=color.fuchsia, style=shape.star, size=size.small)
'''
            alert_conditions.append('price_breakout')
        
        if 'boll_lower' in indicators:
            script += '''
// 触及布林下轨检测
touch_boll_lower = close <= bb_lower
plotshape(touch_boll_lower, title="触及下轨", location=location.belowbar, 
          color=color.aqua, style=shape.xcross, size=size.small)
'''
            alert_conditions.append('touch_boll_lower')
        
        if 'boll_upper' in indicators:
            script += '''
// 触及布林上轨检测
touch_boll_upper = close >= bb_upper
plotshape(touch_boll_upper, title="触及上轨", location=location.abovebar, 
          color=color.maroon, style=shape.xcross, size=size.small)
'''
            alert_conditions.append('touch_boll_upper')
        
        # 添加绘图
        script += '''
// 绘制均线
plot(ma5, "MA5", color=color.yellow, linewidth=1)
plot(ma20, "MA20", color=color.blue, linewidth=1)

// 绘制布林带
plot(bb_upper, "BOLL上轨", color=color.gray, linewidth=1)
plot(bb_middle, "BOLL中轨", color=color.gray, linewidth=1)
plot(bb_lower, "BOLL下轨", color=color.gray, linewidth=1)
'''
        
        # 添加警报条件
        if alert_conditions:
            combined_condition = ' or '.join(alert_conditions)
            script += f'''
// 综合警报条件
alert_condition = {combined_condition}
alertcondition(alert_condition, title="{stock_name}监控提醒", 
               message="{stock_name}({stock_code})触发监控条件！")
'''
        
        return script
    
    def generate_python_script(self, stock_code: str, stock_name: str, intent: Dict[str, Any]) -> str:
        """生成Python监控脚本"""
        conditions = intent.get('conditions', [])
        indicators = intent.get('indicators', [])
        timeframe = intent.get('timeframe', 'daily')
        
        script = f'''"""
股票监控脚本 - {stock_name}({stock_code})
监控条件: {', '.join(conditions) if conditions else '自定义条件'}
生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# 股票信息
STOCK_CODE = "{stock_code}"
STOCK_NAME = "{stock_name}"
TIMEFRAME = "{timeframe}"

# 参数配置
MA_SHORT = 5
MA_LONG = 20
RSI_PERIOD = 14
RSI_OVERSOLD = 30
RSI_OVERBOUGHT = 70
MACD_FAST = 12
MACD_SLOW = 26
MACD_SIGNAL = 9
KDJ_N = 9
KDJ_M1 = 3
KDJ_M2 = 3
BOLL_PERIOD = 20
BOLL_STD = 2


def calculate_ma(data: pd.DataFrame, period: int) -> pd.Series:
    """计算移动平均线"""
    return data['close'].rolling(window=period).mean()


def calculate_rsi(data: pd.DataFrame, period: int = 14) -> pd.Series:
    """计算RSI指标"""
    delta = data['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))


def calculate_macd(data: pd.DataFrame, fast: int = 12, slow: int = 26, signal: int = 9):
    """计算MACD指标"""
    exp1 = data['close'].ewm(span=fast, adjust=False).mean()
    exp2 = data['close'].ewm(span=slow, adjust=False).mean()
    macd = exp1 - exp2
    signal_line = macd.ewm(span=signal, adjust=False).mean()
    histogram = macd - signal_line
    return macd, signal_line, histogram


def calculate_kdj(data: pd.DataFrame, n: int = 9, m1: int = 3, m2: int = 3):
    """计算KDJ指标"""
    low_n = data['low'].rolling(window=n).min()
    high_n = data['high'].rolling(window=n).max()
    rsv = (data['close'] - low_n) / (high_n - low_n) * 100
    k = rsv.ewm(com=m1-1, adjust=False).mean()
    d = k.ewm(com=m2-1, adjust=False).mean()
    j = 3 * k - 2 * d
    return k, d, j


def calculate_boll(data: pd.DataFrame, period: int = 20, std_dev: int = 2):
    """计算布林带"""
    middle = data['close'].rolling(window=period).mean()
    std = data['close'].rolling(window=period).std()
    upper = middle + std_dev * std
    lower = middle - std_dev * std
    return upper, middle, lower


def check_conditions(data: pd.DataFrame) -> dict:
    """检查监控条件"""
    if len(data) < 30:
        return {{"triggered": False, "message": "数据不足"}}
    
    # 计算指标
    data['ma_short'] = calculate_ma(data, MA_SHORT)
    data['ma_long'] = calculate_ma(data, MA_LONG)
    data['rsi'] = calculate_rsi(data, RSI_PERIOD)
    data['macd'], data['signal'], data['hist'] = calculate_macd(data, MACD_FAST, MACD_SLOW, MACD_SIGNAL)
    data['k'], data['d'], data['j'] = calculate_kdj(data, KDJ_N, KDJ_M1, KDJ_M2)
    data['boll_upper'], data['boll_middle'], data['boll_lower'] = calculate_boll(data, BOLL_PERIOD, BOLL_STD)
    data['vol_ma20'] = data['volume'].rolling(window=20).mean()
    
    # 获取最新数据
    latest = data.iloc[-1]
    prev = data.iloc[-2]
    
    alerts = []
'''
        
        # 添加条件检测
        if 'golden_cross' in indicators:
            script += '''
    # 均线金叉检测
    if latest['ma_short'] > latest['ma_long'] and prev['ma_short'] <= prev['ma_long']:
        alerts.append("📈 均线金叉：MA5上穿MA20")
'''
        
        if 'death_cross' in indicators:
            script += '''
    # 均线死叉检测
    if latest['ma_short'] < latest['ma_long'] and prev['ma_short'] >= prev['ma_long']:
        alerts.append("📉 均线死叉：MA5下穿MA20")
'''
        
        if 'macd_golden_cross' in indicators:
            script += '''
    # MACD金叉检测
    if latest['macd'] > latest['signal'] and prev['macd'] <= prev['signal']:
        alerts.append("📈 MACD金叉：MACD线上穿信号线")
'''
        
        if 'macd_death_cross' in indicators:
            script += '''
    # MACD死叉检测
    if latest['macd'] < latest['signal'] and prev['macd'] >= prev['signal']:
        alerts.append("📉 MACD死叉：MACD线下穿信号线")
'''
        
        if 'rsi_oversold' in indicators:
            script += '''
    # RSI超卖检测
    if latest['rsi'] < RSI_OVERSOLD:
        alerts.append(f"🔵 RSI超卖：当前RSI={latest['rsi']:.2f}")
'''
        
        if 'rsi_overbought' in indicators:
            script += '''
    # RSI超买检测
    if latest['rsi'] > RSI_OVERBOUGHT:
        alerts.append(f"🔴 RSI超买：当前RSI={latest['rsi']:.2f}")
'''
        
        if 'kdj_golden_cross' in indicators:
            script += '''
    # KDJ金叉检测
    if latest['k'] > latest['d'] and prev['k'] <= prev['d']:
        alerts.append("📈 KDJ金叉：K线上穿D线")
'''
        
        if 'volume_breakout' in indicators:
            script += '''
    # 放量突破检测
    if latest['volume'] > latest['vol_ma20'] * 2:
        alerts.append(f"📊 放量突破：成交量是20日均量的{latest['volume']/latest['vol_ma20']:.1f}倍")
'''
        
        if 'price_breakout' in indicators:
            script += '''
    # 价格突破检测
    highest_20 = data['high'].iloc[-21:-1].max()
    if latest['close'] > highest_20:
        alerts.append(f"🚀 价格突破：突破20日高点{highest_20:.2f}")
'''
        
        if 'boll_lower' in indicators:
            script += '''
    # 触及布林下轨检测
    if latest['close'] <= latest['boll_lower']:
        alerts.append(f"🔵 触及布林下轨：{latest['boll_lower']:.2f}")
'''
        
        if 'boll_upper' in indicators:
            script += '''
    # 触及布林上轨检测
    if latest['close'] >= latest['boll_upper']:
        alerts.append(f"🔴 触及布林上轨：{latest['boll_upper']:.2f}")
'''
        
        script += '''
    return {
        "triggered": len(alerts) > 0,
        "alerts": alerts,
        "stock_code": STOCK_CODE,
        "stock_name": STOCK_NAME,
        "latest_price": latest['close'],
        "check_time": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "indicators": {
            "ma_short": latest['ma_short'],
            "ma_long": latest['ma_long'],
            "rsi": latest['rsi'],
            "macd": latest['macd'],
            "signal": latest['signal'],
            "k": latest['k'],
            "d": latest['d'],
        }
    }


def run_monitor(data: pd.DataFrame) -> dict:
    """运行监控"""
    result = check_conditions(data)
    
    if result["triggered"]:
        print(f"\\n{'='*50}")
        print(f"🔔 {STOCK_NAME}({STOCK_CODE}) 触发监控条件！")
        print(f"时间: {result['check_time']}")
        print(f"最新价: {result['latest_price']:.2f}")
        print(f"{'='*50}")
        for alert in result["alerts"]:
            print(f"  {alert}")
        print(f"{'='*50}\\n")
    
    return result


if __name__ == "__main__":
    # 示例：加载数据并运行监控
    # data = pd.read_csv("stock_data.csv")
    # result = run_monitor(data)
    print(f"监控脚本已生成: {STOCK_NAME}({STOCK_CODE})")
    print(f"监控条件: {", ".join({repr(c) for c in {repr(conditions)}})}") 
'''
        
        return script
    
    def create_monitor(self, stock_code: str, stock_name: str, user_input: str, 
                      script_type: str = 'python') -> Dict[str, Any]:
        """创建监控任务"""
        # 解析用户意图
        intent = self.parse_user_intent(user_input)
        
        # 生成脚本
        if script_type == 'pinescript':
            script = self.generate_pinescript(stock_code, stock_name, intent)
        else:
            script = self.generate_python_script(stock_code, stock_name, intent)
        
        # 创建监控任务
        monitor_id = f"{stock_code}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        monitor = {
            'id': monitor_id,
            'stock_code': stock_code,
            'stock_name': stock_name,
            'user_input': user_input,
            'intent': intent,
            'script_type': script_type,
            'script': script,
            'status': 'pending',  # pending, active, triggered, stopped
            'created_at': datetime.now().isoformat(),
            'last_check': None,
            'trigger_count': 0,
        }
        
        return monitor
    
    def activate_monitor(self, monitor_id: str, monitor: Dict) -> bool:
        """激活监控任务"""
        self.active_monitors[monitor_id] = monitor
        monitor['status'] = 'active'
        logger.info(f"Monitor activated: {monitor_id}")
        return True
    
    def deactivate_monitor(self, monitor_id: str) -> bool:
        """停止监控任务"""
        if monitor_id in self.active_monitors:
            self.active_monitors[monitor_id]['status'] = 'stopped'
            del self.active_monitors[monitor_id]
            logger.info(f"Monitor deactivated: {monitor_id}")
            return True
        return False
    
    def get_active_monitors(self) -> List[Dict]:
        """获取所有活跃的监控任务"""
        return list(self.active_monitors.values())
    
    def check_monitor(self, monitor_id: str, kline_data: List[Dict]) -> Optional[Dict]:
        """检查监控条件是否触发"""
        if monitor_id not in self.active_monitors:
            return None
        
        monitor = self.active_monitors[monitor_id]
        intent = monitor.get('intent', {})
        indicators = intent.get('indicators', [])
        
        if len(kline_data) < 30:
            return None
        
        # 转换数据格式
        latest = kline_data[-1]
        prev = kline_data[-2] if len(kline_data) > 1 else latest
        
        # 计算简单指标
        closes = [d.get('close', 0) for d in kline_data]
        ma5 = sum(closes[-5:]) / 5 if len(closes) >= 5 else closes[-1]
        ma20 = sum(closes[-20:]) / 20 if len(closes) >= 20 else closes[-1]
        
        prev_closes = closes[:-1] if len(closes) > 1 else closes
        prev_ma5 = sum(prev_closes[-5:]) / 5 if len(prev_closes) >= 5 else prev_closes[-1]
        prev_ma20 = sum(prev_closes[-20:]) / 20 if len(prev_closes) >= 20 else prev_closes[-1]
        
        alerts = []
        
        # 检查各种条件
        if 'golden_cross' in indicators:
            if ma5 > ma20 and prev_ma5 <= prev_ma20:
                alerts.append({
                    'type': 'golden_cross',
                    'message': f'📈 均线金叉：MA5({ma5:.2f})上穿MA20({ma20:.2f})',
                    'severity': 'high',
                })
        
        if 'death_cross' in indicators:
            if ma5 < ma20 and prev_ma5 >= prev_ma20:
                alerts.append({
                    'type': 'death_cross',
                    'message': f'📉 均线死叉：MA5({ma5:.2f})下穿MA20({ma20:.2f})',
                    'severity': 'high',
                })
        
        # 更新监控状态
        monitor['last_check'] = datetime.now().isoformat()
        
        if alerts:
            monitor['trigger_count'] += 1
            monitor['status'] = 'triggered'
            return {
                'monitor_id': monitor_id,
                'stock_code': monitor['stock_code'],
                'stock_name': monitor['stock_name'],
                'alerts': alerts,
                'triggered_at': datetime.now().isoformat(),
                'latest_price': latest.get('close', 0),
            }
        
        return None


# 创建服务实例
script_service = ScriptService()
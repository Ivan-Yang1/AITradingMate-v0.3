import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Code2, Play, Square, Trash2, Copy, Check, ChevronDown, ChevronUp,
  Bell, BellOff, Loader2, Sparkles, FileCode, Terminal, AlertTriangle,
  Clock, Activity, X, Mail, Settings, Send, Volume2, VolumeX
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { client } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

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

interface Monitor {
  id: string;
  stock_code: string;
  stock_name: string;
  status: 'pending' | 'active' | 'triggered' | 'stopped';
  conditions: string[];
  created_at: string;
  last_check?: string;
  trigger_count: number;
  script?: string;
  script_type?: string;
}

interface NotificationSettings {
  browser_enabled: boolean;
  email_enabled: boolean;
  email_address: string;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  notification_types: Record<string, boolean>;
}

interface ScriptMonitorPanelProps {
  stockInfo: StockInfo | null;
  klineData: KLineData[];
  userInput: string;
  onClose?: () => void;
}

// 请求浏览器通知权限
const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  
  return false;
};

// 发送浏览器通知
const sendBrowserNotification = (title: string, body: string, data?: Record<string, unknown>) => {
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'stock-monitor',
      renotify: true,
      requireInteraction: true,
      data,
    });
    
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    
    // 播放提示音
    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {
      // 忽略音频播放错误
    }
    
    return notification;
  }
  return null;
};

export default function ScriptMonitorPanel({ 
  stockInfo, 
  klineData, 
  userInput,
  onClose 
}: ScriptMonitorPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<string>('');
  const [scriptType, setScriptType] = useState<'python' | 'pinescript'>('python');
  const [monitorId, setMonitorId] = useState<string>('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [isActivating, setIsActivating] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    browser_enabled: true,
    email_enabled: false,
    email_address: '',
    quiet_hours_start: null,
    quiet_hours_end: null,
    notification_types: {},
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isTestingNotification, setIsTestingNotification] = useState(false);
  const { toast } = useToast();

  // 检查浏览器通知权限
  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // 加载通知设置
  const loadNotificationSettings = useCallback(async () => {
    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/scripts/notification/settings',
        method: 'GET',
      });
      if (response.data?.settings) {
        setNotificationSettings(response.data.settings);
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
    }
  }, []);

  // 加载用户的监控任务
  const loadMonitors = useCallback(async () => {
    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/scripts/monitors',
        method: 'GET',
      });
      if (response.data?.monitors) {
        setMonitors(response.data.monitors);
      }
    } catch (error) {
      console.error('Failed to load monitors:', error);
    }
  }, []);

  useEffect(() => {
    loadMonitors();
    loadNotificationSettings();
  }, [loadMonitors, loadNotificationSettings]);

  // 当用户输入包含监控关键词时自动生成脚本
  useEffect(() => {
    const monitorKeywords = ['通知', '提醒', '监控', '告警', '预警', '金叉', '死叉', '突破', '超买', '超卖'];
    const hasMonitorIntent = monitorKeywords.some(kw => userInput.includes(kw));
    
    if (hasMonitorIntent && stockInfo && userInput.length > 5) {
      // 延迟生成，避免频繁请求
      const timer = setTimeout(() => {
        generateScript();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [userInput, stockInfo]);

  // 请求通知权限
  const handleRequestPermission = async () => {
    const granted = await requestNotificationPermission();
    setNotificationPermission(granted ? 'granted' : 'denied');
    if (granted) {
      toast({
        title: '通知权限已开启',
        description: '您将收到监控触发的浏览器通知',
      });
    } else {
      toast({
        title: '通知权限被拒绝',
        description: '请在浏览器设置中手动开启通知权限',
        variant: 'destructive',
      });
    }
  };

  // 保存通知设置
  const saveNotificationSettings = async () => {
    setIsSavingSettings(true);
    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/scripts/notification/settings',
        method: 'POST',
        data: notificationSettings,
      });
      if (response.data?.success) {
        toast({
          title: '设置已保存',
          description: '通知设置已更新',
        });
      }
    } catch (error) {
      console.error('Failed to save notification settings:', error);
      toast({
        title: '保存失败',
        description: '无法保存通知设置',
        variant: 'destructive',
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  // 测试通知
  const testNotification = async (type: 'browser' | 'email') => {
    setIsTestingNotification(true);
    try {
      if (type === 'browser') {
        // 直接发送浏览器通知
        if (notificationPermission !== 'granted') {
          await handleRequestPermission();
          return;
        }
        sendBrowserNotification(
          '🔔 测试通知',
          '这是一条测试通知，用于验证浏览器通知功能是否正常工作。',
          { type: 'test' }
        );
        toast({
          title: '测试通知已发送',
          description: '请检查浏览器通知',
        });
      } else {
        // 发送测试邮件
        const response = await client.apiCall.invoke({
          url: '/api/v1/scripts/notification/test',
          method: 'POST',
          data: {
            notification_type: 'email',
            title: '【AI金融助手】测试邮件',
            body: '这是一条测试邮件，用于验证邮件通知功能是否正常工作。',
          },
        });
        if (response.data?.success) {
          toast({
            title: '测试邮件已发送',
            description: `已发送至 ${notificationSettings.email_address}`,
          });
        } else {
          toast({
            title: '发送失败',
            description: response.data?.result?.reason || '无法发送测试邮件',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('Test notification error:', error);
      toast({
        title: '测试失败',
        description: '无法发送测试通知',
        variant: 'destructive',
      });
    } finally {
      setIsTestingNotification(false);
    }
  };

  // 生成脚本
  const generateScript = async () => {
    if (!stockInfo || !userInput.trim()) return;
    
    setIsGenerating(true);
    setGeneratedScript('');
    setConditions([]);
    
    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/scripts/generate',
        method: 'POST',
        data: {
          stock_code: stockInfo.ts_code,
          stock_name: stockInfo.name,
          user_input: userInput,
          script_type: scriptType,
        },
      });
      
      if (response.data?.success) {
        setGeneratedScript(response.data.script);
        setMonitorId(response.data.monitor_id);
        setConditions(response.data.conditions || []);
        setShowScript(true);
        
        toast({
          title: '脚本生成成功',
          description: `已识别${response.data.conditions?.length || 0}个监控条件`,
        });
      }
    } catch (error) {
      console.error('Generate script error:', error);
      toast({
        title: '生成失败',
        description: '无法生成监控脚本，请重试',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // 激活监控
  const activateMonitor = async () => {
    if (!monitorId) return;
    
    // 检查通知权限
    if (notificationSettings.browser_enabled && notificationPermission !== 'granted') {
      const granted = await requestNotificationPermission();
      setNotificationPermission(granted ? 'granted' : 'denied');
    }
    
    setIsActivating(true);
    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/scripts/activate',
        method: 'POST',
        data: {
          monitor_id: monitorId,
          monitor_data: {
            id: monitorId,
            stock_code: stockInfo?.ts_code,
            stock_name: stockInfo?.name,
            intent: { conditions },
            script_type: scriptType,
            script: generatedScript,
            status: 'pending',
            created_at: new Date().toISOString(),
          },
        },
      });
      
      if (response.data?.success) {
        toast({
          title: '监控已激活',
          description: `${stockInfo?.name}的监控已开始运行`,
        });
        loadMonitors();
      }
    } catch (error) {
      console.error('Activate monitor error:', error);
      toast({
        title: '激活失败',
        description: '无法激活监控，请重试',
        variant: 'destructive',
      });
    } finally {
      setIsActivating(false);
    }
  };

  // 停止监控
  const deactivateMonitor = async (id: string) => {
    try {
      const response = await client.apiCall.invoke({
        url: `/api/v1/scripts/deactivate/${id}`,
        method: 'POST',
      });
      
      if (response.data?.success) {
        toast({
          title: '监控已停止',
          description: '监控任务已停止运行',
        });
        loadMonitors();
      }
    } catch (error) {
      console.error('Deactivate monitor error:', error);
    }
  };

  // 复制脚本
  const copyScript = async () => {
    if (!generatedScript) return;
    
    try {
      await navigator.clipboard.writeText(generatedScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: '已复制',
        description: '脚本已复制到剪贴板',
      });
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  // 检查监控条件
  const checkMonitorConditions = async (id: string) => {
    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/scripts/check',
        method: 'POST',
        data: {
          monitor_id: id,
          kline_data: klineData,
        },
      });
      
      if (response.data?.triggered) {
        const result = response.data.result;
        const notification = response.data.notification;
        
        // 发送浏览器通知
        if (notification?.browser?.success && notificationSettings.browser_enabled) {
          const notifData = notification.browser.notification;
          sendBrowserNotification(
            notifData.title,
            notifData.body,
            notifData.data
          );
        }
        
        toast({
          title: '🔔 监控触发',
          description: result?.alerts?.[0]?.message || '条件已触发',
        });
        loadMonitors();
      }
    } catch (error) {
      console.error('Check monitor error:', error);
    }
  };

  // 如果没有生成脚本且没有监控任务，不显示面板
  if (!generatedScript && monitors.length === 0 && !isGenerating) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-[#1A1A2E] border border-[#2D2D3A] rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-3 bg-[#0D0D14] cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
            <Code2 className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-white font-medium text-sm">AI脚本监控</h3>
            <p className="text-xs text-gray-500">
              {monitors.filter(m => m.status === 'active').length}个监控运行中
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isGenerating && (
            <Loader2 className="h-4 w-4 text-purple-400 animate-spin" />
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSettings(!showSettings);
            }}
            className={`p-1.5 rounded transition-colors ${
              showSettings ? 'bg-purple-500/20 text-purple-400' : 'text-gray-400 hover:text-white'
            }`}
            title="通知设置"
          >
            <Settings className="h-4 w-4" />
          </button>
          {onClose && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1 text-gray-400 hover:text-white rounded"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* 通知设置面板 */}
              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-[#0D0D14] rounded-lg p-4 space-y-4 border border-[#2D2D3A]"
                  >
                    <h4 className="text-white font-medium text-sm flex items-center gap-2">
                      <Bell className="h-4 w-4 text-purple-400" />
                      通知设置
                    </h4>
                    
                    {/* 浏览器通知 */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Volume2 className="h-4 w-4 text-blue-400" />
                          <span className="text-sm text-gray-300">浏览器通知</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={notificationSettings.browser_enabled}
                            onCheckedChange={(checked) => 
                              setNotificationSettings(prev => ({ ...prev, browser_enabled: checked }))
                            }
                          />
                        </div>
                      </div>
                      
                      {notificationSettings.browser_enabled && (
                        <div className="ml-6 space-y-2">
                          {notificationPermission !== 'granted' ? (
                            <button
                              onClick={handleRequestPermission}
                              className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                            >
                              <Bell className="h-3 w-3" />
                              点击开启浏览器通知权限
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-green-400 flex items-center gap-1">
                                <Check className="h-3 w-3" />
                                通知权限已开启
                              </span>
                              <button
                                onClick={() => testNotification('browser')}
                                disabled={isTestingNotification}
                                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                              >
                                <Send className="h-3 w-3" />
                                测试
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* 邮件通知 */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-green-400" />
                          <span className="text-sm text-gray-300">邮件通知</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={notificationSettings.email_enabled}
                            onCheckedChange={(checked) => 
                              setNotificationSettings(prev => ({ ...prev, email_enabled: checked }))
                            }
                          />
                        </div>
                      </div>
                      
                      {notificationSettings.email_enabled && (
                        <div className="ml-6 space-y-2">
                          <div className="flex gap-2">
                            <Input
                              type="email"
                              placeholder="输入邮箱地址"
                              value={notificationSettings.email_address}
                              onChange={(e) => 
                                setNotificationSettings(prev => ({ ...prev, email_address: e.target.value }))
                              }
                              className="h-8 text-xs bg-[#1A1A2E] border-[#2D2D3A]"
                            />
                            <button
                              onClick={() => testNotification('email')}
                              disabled={isTestingNotification || !notificationSettings.email_address}
                              className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 disabled:opacity-50 flex items-center gap-1"
                            >
                              <Send className="h-3 w-3" />
                              测试
                            </button>
                          </div>
                          <p className="text-xs text-gray-500">
                            监控触发时将发送邮件到此地址
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* 免打扰时间 */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <VolumeX className="h-4 w-4 text-yellow-400" />
                        <span className="text-sm text-gray-300">免打扰时间</span>
                      </div>
                      <div className="ml-6 flex items-center gap-2">
                        <Input
                          type="time"
                          value={notificationSettings.quiet_hours_start || ''}
                          onChange={(e) => 
                            setNotificationSettings(prev => ({ ...prev, quiet_hours_start: e.target.value || null }))
                          }
                          className="h-8 text-xs bg-[#1A1A2E] border-[#2D2D3A] w-24"
                        />
                        <span className="text-gray-500 text-xs">至</span>
                        <Input
                          type="time"
                          value={notificationSettings.quiet_hours_end || ''}
                          onChange={(e) => 
                            setNotificationSettings(prev => ({ ...prev, quiet_hours_end: e.target.value || null }))
                          }
                          className="h-8 text-xs bg-[#1A1A2E] border-[#2D2D3A] w-24"
                        />
                      </div>
                    </div>
                    
                    {/* 保存按钮 */}
                    <Button
                      onClick={saveNotificationSettings}
                      disabled={isSavingSettings}
                      className="w-full bg-purple-500 hover:bg-purple-600 text-white"
                      size="sm"
                    >
                      {isSavingSettings ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      保存设置
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 生成的脚本 */}
              {(generatedScript || isGenerating) && (
                <div className="space-y-3">
                  {/* 条件标签 */}
                  {conditions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs text-gray-500">监控条件:</span>
                      {conditions.map((condition, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full"
                        >
                          {condition}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 脚本类型切换 */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setScriptType('python')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        scriptType === 'python'
                          ? 'bg-blue-500 text-white'
                          : 'bg-[#2D2D3A] text-gray-400 hover:text-white'
                      }`}
                    >
                      <Terminal className="h-3 w-3 inline mr-1" />
                      Python
                    </button>
                    <button
                      onClick={() => setScriptType('pinescript')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        scriptType === 'pinescript'
                          ? 'bg-green-500 text-white'
                          : 'bg-[#2D2D3A] text-gray-400 hover:text-white'
                      }`}
                    >
                      <FileCode className="h-3 w-3 inline mr-1" />
                      PineScript
                    </button>
                    <button
                      onClick={generateScript}
                      disabled={isGenerating || !stockInfo}
                      className="ml-auto px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-500/30 transition-colors disabled:opacity-50"
                    >
                      <Sparkles className="h-3 w-3 inline mr-1" />
                      重新生成
                    </button>
                  </div>

                  {/* 脚本预览 */}
                  {showScript && generatedScript && (
                    <div className="relative">
                      <div className="absolute top-2 right-2 flex gap-1 z-10">
                        <button
                          onClick={copyScript}
                          className="p-1.5 bg-[#2D2D3A] rounded hover:bg-[#3D3D4A] transition-colors"
                          title="复制脚本"
                        >
                          {copied ? (
                            <Check className="h-3 w-3 text-green-400" />
                          ) : (
                            <Copy className="h-3 w-3 text-gray-400" />
                          )}
                        </button>
                      </div>
                      <pre className="bg-[#0D0D14] rounded-lg p-3 text-xs text-gray-300 overflow-x-auto max-h-48 overflow-y-auto">
                        <code>{generatedScript.slice(0, 1500)}...</code>
                      </pre>
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={activateMonitor}
                      disabled={isActivating || !monitorId}
                      className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:opacity-90"
                    >
                      {isActivating ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Play className="h-4 w-4 mr-2" />
                      )}
                      确认执行监控
                    </Button>
                    <Button
                      onClick={() => setShowScript(!showScript)}
                      variant="outline"
                      className="border-[#2D2D3A] text-gray-400 hover:text-white"
                    >
                      {showScript ? '隐藏脚本' : '查看脚本'}
                    </Button>
                  </div>
                </div>
              )}

              {/* 活跃的监控任务 */}
              {monitors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs text-gray-500 flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    监控任务 ({monitors.length})
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {monitors.map((monitor) => (
                      <div
                        key={monitor.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          monitor.status === 'active'
                            ? 'bg-green-500/10 border-green-500/30'
                            : monitor.status === 'triggered'
                            ? 'bg-yellow-500/10 border-yellow-500/30'
                            : 'bg-[#2D2D3A] border-[#3D3D4A]'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white text-sm font-medium truncate">
                              {monitor.stock_name}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-xs ${
                              monitor.status === 'active'
                                ? 'bg-green-500/20 text-green-400'
                                : monitor.status === 'triggered'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-gray-500/20 text-gray-400'
                            }`}>
                              {monitor.status === 'active' ? '运行中' : 
                               monitor.status === 'triggered' ? '已触发' : '已停止'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">
                              {monitor.conditions?.slice(0, 2).join(', ')}
                            </span>
                            {monitor.trigger_count > 0 && (
                              <span className="text-xs text-yellow-400">
                                触发{monitor.trigger_count}次
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          {monitor.status === 'active' && (
                            <button
                              onClick={() => checkMonitorConditions(monitor.id)}
                              className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                              title="立即检查"
                            >
                              <Bell className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => deactivateMonitor(monitor.id)}
                            className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                            title="停止监控"
                          >
                            {monitor.status === 'active' ? (
                              <Square className="h-3.5 w-3.5" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 提示信息 */}
              {!generatedScript && !isGenerating && monitors.length === 0 && (
                <div className="text-center py-4">
                  <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-gray-400">
                    在对话中描述监控条件，AI将自动生成脚本
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    例如："如果该股票出现日线金叉通知我"
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
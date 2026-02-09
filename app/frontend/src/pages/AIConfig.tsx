import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, Cpu, Settings, Zap, Save, RotateCcw, Loader2, LogIn, Cloud, CloudOff, 
  Key, Globe, Eye, EyeOff, CheckCircle, AlertCircle, Sparkles, Rocket,
  TrendingUp, BarChart3, Newspaper, Scale
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { client } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { AIConfigSkeleton } from '@/components/Skeleton';

// 内置预配置的AI模型（已配置好API Key，可直接使用）
const BUILTIN_AI_MODELS = [
  { 
    id: 'deepseek-v3.2', 
    name: 'DeepSeek V3.2', 
    description: '高性能通用模型，推理能力强，性价比高', 
    recommended: true,
    isBuiltin: true,
    status: 'ready' as const,
  },
  { 
    id: 'kimi-k2', 
    name: 'Kimi K2', 
    description: '月之暗面最新模型，长文本处理优秀，推理能力强', 
    recommended: true,
    isBuiltin: true,
    status: 'ready' as const,
  },
];

// 自定义API模型选项（需要用户配置）
const CUSTOM_API_PRESETS = [
  { name: 'OpenAI', url: 'https://api.openai.com/v1', model: 'gpt-4o' },
  { name: 'DeepSeek', url: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: '通义千问', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-turbo' },
  { name: '智谱AI', url: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4' },
  { name: '月之暗面', url: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { name: '本地Ollama', url: 'http://localhost:11434/v1', model: 'llama3' },
];

// 投资风格配置
const INVESTMENT_STYLES = [
  {
    id: 'value',
    name: '长线价值投资',
    icon: TrendingUp,
    description: '关注企业基本面、财务健康、长期增长潜力',
    focus: ['PE/PB估值', 'ROE/ROA', '营收利润增长', '行业地位', '护城河', '分红派息'],
    timeHorizon: '中长期（1年以上）',
    riskPreference: '稳健',
    color: 'from-blue-500 to-blue-600',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  {
    id: 'technical',
    name: '短线技术分析',
    icon: BarChart3,
    description: '关注K线形态、技术指标、量价关系',
    focus: ['K线形态', 'MACD/KDJ/RSI', '均线系统', '支撑压力位', '成交量', '筹码分布'],
    timeHorizon: '短期（日内至数周）',
    riskPreference: '激进',
    color: 'from-orange-500 to-orange-600',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
  },
  {
    id: 'news',
    name: '消息面新闻投资',
    icon: Newspaper,
    description: '关注政策动向、行业新闻、市场情绪',
    focus: ['政策利好/利空', '行业新闻', '公司公告', '机构动向', '北向资金', '市场热点'],
    timeHorizon: '事件驱动',
    riskPreference: '机会型',
    color: 'from-purple-500 to-purple-600',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
  {
    id: 'balanced',
    name: '综合分析',
    icon: Scale,
    description: '结合技术面、基本面和消息面综合分析',
    focus: ['技术指标', '基本面数据', '消息面动态', '资金流向'],
    timeHorizon: '灵活',
    riskPreference: '平衡',
    color: 'from-green-500 to-green-600',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
];

const ANALYSIS_FOCUS_OPTIONS = ['技术面', '基本面', '资金流向', '市场情绪'];

interface UserSettings {
  id?: number;
  ai_model: string;
  temperature: number;
  max_tokens: number;
  auto_analysis: boolean;
  stream_output: boolean;
  analysis_focus: string;
  custom_prompt: string;
  custom_api_enabled: boolean;
  custom_api_base_url: string;
  custom_api_key: string;
  custom_api_model: string;
  investment_style: string;
}

const DEFAULT_SETTINGS: UserSettings = {
  ai_model: 'deepseek-v3.2',
  temperature: 0.7,
  max_tokens: 2048,
  auto_analysis: true,
  stream_output: true,
  analysis_focus: '技术面,基本面',
  custom_prompt: '',
  custom_api_enabled: false,
  custom_api_base_url: '',
  custom_api_key: '',
  custom_api_model: '',
  investment_style: 'balanced',
};

export default function AIConfig() {
  const { user, isLoading: authLoading, isAuthenticated, login } = useAuth();
  const { toast } = useToast();
  
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cloudSynced, setCloudSynced] = useState(false);
  const [selectedFocus, setSelectedFocus] = useState<string[]>(['技术面', '基本面']);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingApi, setTestingApi] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<'success' | 'error' | null>(null);
  const [testingBuiltinModel, setTestingBuiltinModel] = useState<string | null>(null);
  const [builtinModelStatus, setBuiltinModelStatus] = useState<Record<string, 'ready' | 'testing' | 'success' | 'error'>>({
    'deepseek-v3.2': 'ready',
    'kimi-k2': 'ready',
  });
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Load settings from cloud on mount
  useEffect(() => {
    const loadSettings = async () => {
      // 先尝试从localStorage快速加载
      const localSettings = localStorage.getItem('ai_config');
      if (localSettings) {
        try {
          const parsed = JSON.parse(localSettings);
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
          setSelectedFocus(parsed.analysis_focus?.split(',') || ['技术面', '基本面']);
        } catch (e) {
          console.error('Failed to parse local settings:', e);
        }
      }
      
      // 加载投资风格
      const savedStyle = localStorage.getItem('investment_style');
      if (savedStyle) {
        setSettings(prev => ({ ...prev, investment_style: savedStyle }));
      }

      // 标记初始加载完成（即使没有云端数据也显示界面）
      setInitialLoadComplete(true);

      if (!isAuthenticated) {
        return;
      }

      setLoading(true);
      try {
        const response = await client.entities.user_settings.query({
          query: {},
          limit: 1,
        });
        
        if (response.data?.items && response.data.items.length > 0) {
          const cloudSettings = response.data.items[0];
          setSettings({
            ...DEFAULT_SETTINGS,
            ...cloudSettings,
            id: cloudSettings.id,
          });
          setSelectedFocus(cloudSettings.analysis_focus?.split(',') || ['技术面', '基本面']);
          setCloudSynced(true);
        }
      } catch (error) {
        console.error('Failed to load settings from cloud:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      loadSettings();
    }
  }, [isAuthenticated, authLoading]);

  // Save settings
  const handleSave = useCallback(async () => {
    setSaving(true);
    
    const settingsToSave = {
      ...settings,
      analysis_focus: selectedFocus.join(','),
    };

    // Always save to localStorage
    localStorage.setItem('ai_config', JSON.stringify(settingsToSave));
    localStorage.setItem('investment_style', settings.investment_style);

    if (isAuthenticated) {
      try {
        if (settings.id) {
          // Update existing settings
          await client.entities.user_settings.update({
            id: String(settings.id),
            data: {
              ai_model: settingsToSave.ai_model,
              temperature: settingsToSave.temperature,
              max_tokens: settingsToSave.max_tokens,
              auto_analysis: settingsToSave.auto_analysis,
              stream_output: settingsToSave.stream_output,
              analysis_focus: settingsToSave.analysis_focus,
              custom_prompt: settingsToSave.custom_prompt,
              custom_api_enabled: settingsToSave.custom_api_enabled,
              custom_api_base_url: settingsToSave.custom_api_base_url,
              custom_api_key: settingsToSave.custom_api_key,
              custom_api_model: settingsToSave.custom_api_model,
              investment_style: settingsToSave.investment_style,
              updated_at: new Date().toISOString(),
            },
          });
        } else {
          // Create new settings
          const response = await client.entities.user_settings.create({
            data: {
              ai_model: settingsToSave.ai_model,
              temperature: settingsToSave.temperature,
              max_tokens: settingsToSave.max_tokens,
              auto_analysis: settingsToSave.auto_analysis,
              stream_output: settingsToSave.stream_output,
              analysis_focus: settingsToSave.analysis_focus,
              custom_prompt: settingsToSave.custom_prompt,
              custom_api_enabled: settingsToSave.custom_api_enabled,
              custom_api_base_url: settingsToSave.custom_api_base_url,
              custom_api_key: settingsToSave.custom_api_key,
              custom_api_model: settingsToSave.custom_api_model,
              investment_style: settingsToSave.investment_style,
              updated_at: new Date().toISOString(),
            },
          });
          if (response.data?.id) {
            setSettings(prev => ({ ...prev, id: response.data.id }));
          }
        }
        setCloudSynced(true);
        toast({
          title: '设置已保存',
          description: '您的AI配置已同步到云端',
        });
      } catch (error) {
        console.error('Failed to save to cloud:', error);
        toast({
          title: '云端同步失败',
          description: '设置已保存到本地，但无法同步到云端',
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: '设置已保存',
        description: '登录后可同步到云端',
      });
    }

    setSaving(false);
  }, [settings, selectedFocus, isAuthenticated, toast]);

  // Reset to defaults
  const handleReset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    setSelectedFocus(['技术面', '基本面']);
    localStorage.removeItem('ai_config');
    localStorage.removeItem('investment_style');
    toast({
      title: '已重置',
      description: '所有设置已恢复为默认值',
    });
  }, [toast]);

  // Test builtin model
  const testBuiltinModel = useCallback(async (modelId: string) => {
    setTestingBuiltinModel(modelId);
    setBuiltinModelStatus(prev => ({ ...prev, [modelId]: 'testing' }));
    
    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/builtin-ai/chat',
        method: 'POST',
        data: {
          model_id: modelId,
          message: '你好，请简单介绍一下自己',
          temperature: 0.7,
          max_tokens: 100,
        },
      });

      if (response.data?.success) {
        setBuiltinModelStatus(prev => ({ ...prev, [modelId]: 'success' }));
        toast({
          title: '连接成功',
          description: `${BUILTIN_AI_MODELS.find(m => m.id === modelId)?.name} 可正常使用`,
        });
      } else {
        setBuiltinModelStatus(prev => ({ ...prev, [modelId]: 'error' }));
        toast({
          title: '连接失败',
          description: response.data?.error || '未知错误',
          variant: 'destructive',
        });
      }
    } catch (error) {
      setBuiltinModelStatus(prev => ({ ...prev, [modelId]: 'error' }));
      toast({
        title: '连接失败',
        description: '无法连接到AI服务',
        variant: 'destructive',
      });
    } finally {
      setTestingBuiltinModel(null);
    }
  }, [toast]);

  // Test custom API
  const testCustomApi = useCallback(async () => {
    if (!settings.custom_api_base_url || !settings.custom_api_key || !settings.custom_api_model) {
      toast({
        title: '配置不完整',
        description: '请填写完整的API配置信息',
        variant: 'destructive',
      });
      return;
    }

    setTestingApi(true);
    setApiTestResult(null);

    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/custom-ai/test',
        method: 'POST',
        data: {
          base_url: settings.custom_api_base_url,
          api_key: settings.custom_api_key,
          model: settings.custom_api_model,
        },
      });

      if (response.data?.success) {
        setApiTestResult('success');
        toast({
          title: '连接成功',
          description: '自定义API配置正确，可正常使用',
        });
      } else {
        setApiTestResult('error');
        toast({
          title: '连接失败',
          description: response.data?.error || '请检查API配置',
          variant: 'destructive',
        });
      }
    } catch (error) {
      setApiTestResult('error');
      toast({
        title: '连接失败',
        description: '无法连接到自定义API',
        variant: 'destructive',
      });
    } finally {
      setTestingApi(false);
    }
  }, [settings.custom_api_base_url, settings.custom_api_key, settings.custom_api_model, toast]);

  // Toggle focus option
  const toggleFocus = useCallback((focus: string) => {
    setSelectedFocus(prev => 
      prev.includes(focus) 
        ? prev.filter(f => f !== focus)
        : [...prev, focus]
    );
  }, []);

  // Apply preset
  const applyPreset = useCallback((preset: typeof CUSTOM_API_PRESETS[0]) => {
    setSettings(prev => ({
      ...prev,
      custom_api_base_url: preset.url,
      custom_api_model: preset.model,
    }));
  }, []);

  // 显示骨架屏（仅在初始加载未完成时）
  if (!initialLoadComplete) {
    return (
      <div className="min-h-screen bg-[#0A0A0F]">
        <Header />
        <main className="container mx-auto px-4 pt-20 pb-8 max-w-5xl">
          <AIConfigSkeleton />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Header />
      
      {/* 添加 pt-20 来为固定导航栏留出空间（64px导航栏 + 16px额外间距） */}
      <main className="container mx-auto px-4 pt-20 pb-8 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-[#00D4AA] to-[#00B894] rounded-xl">
                <Brain className="h-6 w-6 text-black" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">AI 配置中心</h1>
                <p className="text-gray-400 text-sm">
                  自定义您的AI分析助手
                  {cloudSynced && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[#00D4AA]">
                      <Cloud className="h-3 w-3" /> 已同步
                    </span>
                  )}
                  {loading && (
                    <span className="ml-2 inline-flex items-center gap-1 text-gray-500">
                      <Loader2 className="h-3 w-3 animate-spin" /> 同步中...
                    </span>
                  )}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleReset}
                className="border-[#2D2D3A] text-gray-400 hover:text-white"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                重置
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-gradient-to-r from-[#00D4AA] to-[#00B894] text-black hover:opacity-90"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                保存设置
              </Button>
            </div>
          </div>

          {/* Login prompt */}
          {!isAuthenticated && (
            <Card className="bg-[#1A1A2E] border-[#2D2D3A]">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <CloudOff className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="text-white font-medium">登录以同步设置</p>
                    <p className="text-gray-400 text-sm">登录后您的配置将自动同步到云端</p>
                  </div>
                </div>
                <Button
                  onClick={login}
                  variant="outline"
                  className="border-[#00D4AA] text-[#00D4AA] hover:bg-[#00D4AA]/10"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  登录
                </Button>
              </CardContent>
            </Card>
          )}

          <Tabs defaultValue="style" className="space-y-6">
            <TabsList className="bg-[#1A1A2E] border border-[#2D2D3A]">
              <TabsTrigger value="style" className="data-[state=active]:bg-[#00D4AA] data-[state=active]:text-black">
                <Scale className="h-4 w-4 mr-2" />
                投资风格
              </TabsTrigger>
              <TabsTrigger value="model" className="data-[state=active]:bg-[#00D4AA] data-[state=active]:text-black">
                <Cpu className="h-4 w-4 mr-2" />
                模型选择
              </TabsTrigger>
              <TabsTrigger value="params" className="data-[state=active]:bg-[#00D4AA] data-[state=active]:text-black">
                <Settings className="h-4 w-4 mr-2" />
                参数调整
              </TabsTrigger>
              <TabsTrigger value="custom" className="data-[state=active]:bg-[#00D4AA] data-[state=active]:text-black">
                <Key className="h-4 w-4 mr-2" />
                自定义API
              </TabsTrigger>
            </TabsList>

            {/* 投资风格选择 */}
            <TabsContent value="style" className="space-y-6">
              <Card className="bg-[#1A1A2E] border-[#2D2D3A]">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Scale className="h-5 w-5 text-[#00D4AA]" />
                    选择您的投资风格
                  </CardTitle>
                  <CardDescription>
                    AI助手将根据您选择的投资风格，提供针对性的分析和建议
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {INVESTMENT_STYLES.map((style) => {
                      const Icon = style.icon;
                      const isSelected = settings.investment_style === style.id;
                      return (
                        <motion.button
                          key={style.id}
                          onClick={() => setSettings(prev => ({ ...prev, investment_style: style.id }))}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                            isSelected
                              ? `${style.bgColor} ${style.borderColor} border-opacity-100`
                              : 'bg-[#0A0A0F] border-[#2D2D3A] hover:border-[#3D3D4A]'
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute top-3 right-3">
                              <CheckCircle className="h-5 w-5 text-[#00D4AA]" />
                            </div>
                          )}
                          
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg bg-gradient-to-br ${style.color}`}>
                              <Icon className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-white font-semibold mb-1">{style.name}</h3>
                              <p className="text-gray-400 text-sm mb-3">{style.description}</p>
                              
                              <div className="space-y-2">
                                <div className="flex flex-wrap gap-1">
                                  {style.focus.slice(0, 4).map((f, i) => (
                                    <span
                                      key={i}
                                      className="px-2 py-0.5 bg-[#2D2D3A] rounded text-xs text-gray-300"
                                    >
                                      {f}
                                    </span>
                                  ))}
                                </div>
                                
                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                  <span>周期: {style.timeHorizon}</span>
                                  <span>风险: {style.riskPreference}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* 当前选择的风格详情 */}
                  {settings.investment_style && (
                    <div className="mt-6 p-4 bg-[#0A0A0F] rounded-xl border border-[#2D2D3A]">
                      <h4 className="text-white font-medium mb-3">
                        当前风格：{INVESTMENT_STYLES.find(s => s.id === settings.investment_style)?.name}
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {INVESTMENT_STYLES.find(s => s.id === settings.investment_style)?.focus.map((f, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 px-3 py-2 bg-[#1A1A2E] rounded-lg"
                          >
                            <CheckCircle className="h-3 w-3 text-[#00D4AA]" />
                            <span className="text-sm text-gray-300">{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Model Selection */}
            <TabsContent value="model" className="space-y-6">
              {/* Builtin Models */}
              <Card className="bg-[#1A1A2E] border-[#2D2D3A]">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Rocket className="h-5 w-5 text-[#00D4AA]" />
                    内置AI模型
                    <span className="ml-2 px-2 py-0.5 bg-[#00D4AA]/20 text-[#00D4AA] text-xs rounded-full">
                      推荐
                    </span>
                  </CardTitle>
                  <CardDescription>
                    预配置的高性能AI模型，无需额外配置即可使用
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {BUILTIN_AI_MODELS.map((model) => (
                    <div
                      key={model.id}
                      onClick={() => !settings.custom_api_enabled && setSettings(prev => ({ ...prev, ai_model: model.id }))}
                      className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        settings.ai_model === model.id && !settings.custom_api_enabled
                          ? 'border-[#00D4AA] bg-[#00D4AA]/10'
                          : 'border-[#2D2D3A] hover:border-[#3D3D4A]'
                      } ${settings.custom_api_enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          settings.ai_model === model.id && !settings.custom_api_enabled
                            ? 'bg-[#00D4AA]'
                            : 'bg-[#2D2D3A]'
                        }`}>
                          <Sparkles className={`h-5 w-5 ${
                            settings.ai_model === model.id && !settings.custom_api_enabled
                              ? 'text-black'
                              : 'text-gray-400'
                          }`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-white font-medium">{model.name}</h3>
                            {model.recommended && (
                              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 text-xs rounded-full">
                                推荐
                              </span>
                            )}
                          </div>
                          <p className="text-gray-400 text-sm">{model.description}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {builtinModelStatus[model.id] === 'success' && (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        )}
                        {builtinModelStatus[model.id] === 'error' && (
                          <AlertCircle className="h-5 w-5 text-red-500" />
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            testBuiltinModel(model.id);
                          }}
                          disabled={testingBuiltinModel === model.id || settings.custom_api_enabled}
                          className="border-[#2D2D3A]"
                        >
                          {testingBuiltinModel === model.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            '测试连接'
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Parameters */}
            <TabsContent value="params" className="space-y-6">
              <Card className="bg-[#1A1A2E] border-[#2D2D3A]">
                <CardHeader>
                  <CardTitle className="text-white">模型参数</CardTitle>
                  <CardDescription>调整AI模型的行为参数</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Temperature */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-white">创造性 (Temperature)</Label>
                      <span className="text-[#00D4AA] font-mono">{settings.temperature.toFixed(1)}</span>
                    </div>
                    <Slider
                      value={[settings.temperature]}
                      onValueChange={([value]) => setSettings(prev => ({ ...prev, temperature: value }))}
                      min={0}
                      max={1}
                      step={0.1}
                      className="w-full"
                    />
                    <p className="text-gray-500 text-xs">
                      较低值更保守准确，较高值更有创造性
                    </p>
                  </div>

                  {/* Max Tokens */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-white">最大输出长度</Label>
                      <span className="text-[#00D4AA] font-mono">{settings.max_tokens}</span>
                    </div>
                    <Slider
                      value={[settings.max_tokens]}
                      onValueChange={([value]) => setSettings(prev => ({ ...prev, max_tokens: value }))}
                      min={256}
                      max={4096}
                      step={256}
                      className="w-full"
                    />
                  </div>

                  {/* Switches */}
                  <div className="space-y-4 pt-4 border-t border-[#2D2D3A]">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-white">自动分析</Label>
                        <p className="text-gray-500 text-xs">选择股票时自动进行分析</p>
                      </div>
                      <Switch
                        checked={settings.auto_analysis}
                        onCheckedChange={(checked) => setSettings(prev => ({ ...prev, auto_analysis: checked }))}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-white">流式输出</Label>
                        <p className="text-gray-500 text-xs">实时显示AI回复（打字机效果）</p>
                      </div>
                      <Switch
                        checked={settings.stream_output}
                        onCheckedChange={(checked) => setSettings(prev => ({ ...prev, stream_output: checked }))}
                      />
                    </div>
                  </div>

                  {/* Analysis Focus */}
                  <div className="space-y-3 pt-4 border-t border-[#2D2D3A]">
                    <Label className="text-white">分析重点</Label>
                    <div className="flex flex-wrap gap-2">
                      {ANALYSIS_FOCUS_OPTIONS.map((focus) => (
                        <button
                          key={focus}
                          onClick={() => toggleFocus(focus)}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                            selectedFocus.includes(focus)
                              ? 'bg-[#00D4AA] text-black'
                              : 'bg-[#2D2D3A] text-gray-400 hover:text-white'
                          }`}
                        >
                          {focus}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Custom API */}
            <TabsContent value="custom" className="space-y-6">
              <Card className="bg-[#1A1A2E] border-[#2D2D3A]">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-white flex items-center gap-2">
                        <Globe className="h-5 w-5 text-[#00D4AA]" />
                        自定义API配置
                      </CardTitle>
                      <CardDescription>
                        使用您自己的API密钥连接大模型服务
                      </CardDescription>
                    </div>
                    <Switch
                      checked={settings.custom_api_enabled}
                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, custom_api_enabled: checked }))}
                    />
                  </div>
                </CardHeader>
                
                {settings.custom_api_enabled && (
                  <CardContent className="space-y-4">
                    {/* Presets */}
                    <div className="space-y-2">
                      <Label className="text-white">快速配置</Label>
                      <div className="flex flex-wrap gap-2">
                        {CUSTOM_API_PRESETS.map((preset) => (
                          <button
                            key={preset.name}
                            onClick={() => applyPreset(preset)}
                            className="px-3 py-1.5 bg-[#2D2D3A] rounded-lg text-sm text-gray-400 hover:text-white hover:bg-[#3D3D4A] transition-colors"
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* API Base URL */}
                    <div className="space-y-2">
                      <Label className="text-white">API Base URL</Label>
                      <Input
                        value={settings.custom_api_base_url}
                        onChange={(e) => setSettings(prev => ({ ...prev, custom_api_base_url: e.target.value }))}
                        placeholder="https://api.example.com/v1"
                        className="bg-[#0A0A0F] border-[#2D2D3A] text-white"
                      />
                    </div>

                    {/* API Key */}
                    <div className="space-y-2">
                      <Label className="text-white">API Key</Label>
                      <div className="relative">
                        <Input
                          type={showApiKey ? 'text' : 'password'}
                          value={settings.custom_api_key}
                          onChange={(e) => setSettings(prev => ({ ...prev, custom_api_key: e.target.value }))}
                          placeholder="sk-..."
                          className="bg-[#0A0A0F] border-[#2D2D3A] text-white pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Model Name */}
                    <div className="space-y-2">
                      <Label className="text-white">模型名称</Label>
                      <Input
                        value={settings.custom_api_model}
                        onChange={(e) => setSettings(prev => ({ ...prev, custom_api_model: e.target.value }))}
                        placeholder="gpt-4o"
                        className="bg-[#0A0A0F] border-[#2D2D3A] text-white"
                      />
                    </div>

                    {/* Test Button */}
                    <div className="flex items-center gap-3 pt-4">
                      <Button
                        onClick={testCustomApi}
                        disabled={testingApi}
                        variant="outline"
                        className="border-[#2D2D3A]"
                      >
                        {testingApi ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Zap className="h-4 w-4 mr-2" />
                        )}
                        测试连接
                      </Button>
                      
                      {apiTestResult === 'success' && (
                        <span className="flex items-center gap-1 text-green-500 text-sm">
                          <CheckCircle className="h-4 w-4" /> 连接成功
                        </span>
                      )}
                      {apiTestResult === 'error' && (
                        <span className="flex items-center gap-1 text-red-500 text-sm">
                          <AlertCircle className="h-4 w-4" /> 连接失败
                        </span>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>
    </div>
  );
}
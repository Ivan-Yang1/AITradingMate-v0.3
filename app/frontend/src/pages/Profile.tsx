import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Settings, History, Bell, Shield, LogOut, Save, Loader2, LogIn, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { client } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface AnalysisRecord {
  id: number;
  ts_code: string;
  stock_name: string;
  analysis_result: string;
  analysis_content?: string;
  analyzed_at: string;
}

export default function Profile() {
  const { user, isLoading: authLoading, isAuthenticated, login, logout } = useAuth();
  const { toast } = useToast();
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    browser: true,
  });

  // Fetch analysis history
  useEffect(() => {
    const fetchHistory = async () => {
      if (!isAuthenticated) return;
      
      setHistoryLoading(true);
      try {
        const response = await client.entities.analysis_history.query({
          sort: '-analyzed_at',
          limit: 20,
        });
        if (response?.data?.items) {
          setAnalysisHistory(response.data.items);
        }
      } catch (error) {
        console.error('Failed to fetch analysis history:', error);
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchHistory();
  }, [isAuthenticated]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getResultIcon = (result: string) => {
    if (result === 'bullish' || result === '看涨') {
      return <TrendingUp className="h-4 w-4" />;
    } else if (result === 'bearish' || result === '看跌') {
      return <TrendingDown className="h-4 w-4" />;
    }
    return <Minus className="h-4 w-4" />;
  };

  const getResultStyle = (result: string) => {
    if (result === 'bullish' || result === '看涨') {
      return 'bg-green-500/20 text-green-400';
    } else if (result === 'bearish' || result === '看跌') {
      return 'bg-red-500/20 text-red-400';
    }
    return 'bg-yellow-500/20 text-yellow-400';
  };

  const getResultText = (result: string) => {
    if (result === 'bullish') return '看涨';
    if (result === 'bearish') return '看跌';
    if (result === 'neutral') return '震荡';
    return result;
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
    toast({
      title: '设置已更新',
      description: `${key === 'email' ? '邮件' : key === 'sms' ? '短信' : '浏览器'}通知已${notifications[key] ? '关闭' : '开启'}`,
    });
  };

  // Show login prompt if not authenticated
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F]">
        <Header />
        <div className="pt-24 pb-12 px-4 max-w-6xl mx-auto flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-[#00D4AA]" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-[#0A0A0F]">
        <Header />
        <div className="pt-24 pb-12 px-4 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center min-h-[60vh] text-center"
          >
            <div className="p-6 bg-[#1A1A2E] rounded-full mb-6">
              <User className="h-16 w-16 text-[#00D4AA]" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">登录以访问个人中心</h1>
            <p className="text-gray-400 mb-8 max-w-md">
              登录后您可以管理个人资料、查看分析历史、同步自选股等
            </p>
            <Button
              onClick={login}
              className="bg-gradient-to-r from-[#00D4AA] to-[#00B894] text-black font-medium hover:opacity-90 px-8 py-6 text-lg"
            >
              <LogIn className="h-5 w-5 mr-2" />
              立即登录
            </Button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Header />
      
      <div className="pt-24 pb-12 px-4 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Profile Header */}
          <div className="flex items-center gap-6 mb-8">
            <Avatar className="h-24 w-24 border-4 border-[#00D4AA]">
              <AvatarImage src={user.avatar} />
              <AvatarFallback className="bg-[#1A1A2E] text-[#00D4AA] text-2xl">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">{user.name}</h1>
              <p className="text-gray-400">{user.email}</p>
              <div className="mt-2 px-3 py-1 bg-[#00D4AA]/20 text-[#00D4AA] rounded-full text-sm inline-block">
                {user.role === 'admin' ? '管理员' : '普通用户'}
              </div>
            </div>
          </div>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="bg-[#1A1A2E] border border-[#2D2D3A]">
              <TabsTrigger value="profile" className="data-[state=active]:bg-[#00D4AA] data-[state=active]:text-black">
                <User className="h-4 w-4 mr-2" />
                个人资料
              </TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-[#00D4AA] data-[state=active]:text-black">
                <History className="h-4 w-4 mr-2" />
                分析历史
              </TabsTrigger>
              <TabsTrigger value="settings" className="data-[state=active]:bg-[#00D4AA] data-[state=active]:text-black">
                <Settings className="h-4 w-4 mr-2" />
                账户设置
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <Card className="bg-[#1A1A2E] border-[#2D2D3A]">
                <CardHeader>
                  <CardTitle className="text-white">个人信息</CardTitle>
                  <CardDescription className="text-gray-400">您的账户信息（来自第三方登录）</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-gray-300">用户名</Label>
                      <Input
                        value={user.name}
                        readOnly
                        className="bg-[#0A0A0F] border-[#2D2D3A] text-gray-300"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">邮箱</Label>
                      <Input
                        type="email"
                        value={user.email}
                        readOnly
                        className="bg-[#0A0A0F] border-[#2D2D3A] text-gray-300"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">用户ID</Label>
                      <Input
                        value={user.id}
                        readOnly
                        className="bg-[#0A0A0F] border-[#2D2D3A] text-gray-500 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">账户类型</Label>
                      <Input
                        value={user.role === 'admin' ? '管理员' : '普通用户'}
                        readOnly
                        className="bg-[#0A0A0F] border-[#2D2D3A] text-gray-300"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-[#0A0A0F] rounded-lg border border-[#2D2D3A]">
                    <p className="text-gray-400 text-sm">
                      您的账户信息来自第三方登录（GitHub/Google），如需修改请前往对应平台设置。
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card className="bg-[#1A1A2E] border-[#2D2D3A]">
                <CardHeader>
                  <CardTitle className="text-white">分析历史</CardTitle>
                  <CardDescription className="text-gray-400">查看您的AI分析记录</CardDescription>
                </CardHeader>
                <CardContent>
                  {historyLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-[#00D4AA]" />
                    </div>
                  ) : analysisHistory.length === 0 ? (
                    <div className="text-center py-12">
                      <History className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">暂无分析记录</p>
                      <p className="text-gray-500 text-sm mt-2">在交易页面使用AI分析功能后，记录将显示在这里</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {analysisHistory.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-4 bg-[#0A0A0F] rounded-lg border border-[#2D2D3A] hover:border-[#00D4AA]/30 transition-colors">
                          <div className="flex-1">
                            <p className="text-white font-medium">{item.ts_code} {item.stock_name}</p>
                            <p className="text-gray-500 text-sm">{formatDate(item.analyzed_at)}</p>
                            {item.analysis_content && (
                              <p className="text-gray-400 text-sm mt-2 line-clamp-2">{item.analysis_content}</p>
                            )}
                          </div>
                          <div className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 ${getResultStyle(item.analysis_result)}`}>
                            {getResultIcon(item.analysis_result)}
                            {getResultText(item.analysis_result)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings">
              <div className="space-y-6">
                <Card className="bg-[#1A1A2E] border-[#2D2D3A]">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Bell className="h-5 w-5 text-[#00D4AA]" />
                      通知设置
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-[#0A0A0F] rounded-lg">
                      <span className="text-gray-300">邮件通知</span>
                      <button
                        onClick={() => toggleNotification('email')}
                        className={`w-12 h-6 rounded-full relative transition-colors ${
                          notifications.email ? 'bg-[#00D4AA]' : 'bg-gray-600'
                        }`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                            notifications.email ? 'right-1' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-[#0A0A0F] rounded-lg">
                      <span className="text-gray-300">短信通知</span>
                      <button
                        onClick={() => toggleNotification('sms')}
                        className={`w-12 h-6 rounded-full relative transition-colors ${
                          notifications.sms ? 'bg-[#00D4AA]' : 'bg-gray-600'
                        }`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                            notifications.sms ? 'right-1' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-[#0A0A0F] rounded-lg">
                      <span className="text-gray-300">浏览器推送</span>
                      <button
                        onClick={() => toggleNotification('browser')}
                        className={`w-12 h-6 rounded-full relative transition-colors ${
                          notifications.browser ? 'bg-[#00D4AA]' : 'bg-gray-600'
                        }`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                            notifications.browser ? 'right-1' : 'left-1'
                          }`}
                        />
                      </button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#1A1A2E] border-[#2D2D3A]">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Shield className="h-5 w-5 text-[#00D4AA]" />
                      安全设置
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-[#0A0A0F] rounded-lg border border-[#2D2D3A]">
                      <p className="text-gray-400 text-sm">
                        您使用第三方账户（GitHub/Google）登录，密码和安全设置请在对应平台管理。
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Button
                  variant="outline"
                  className="w-full border-red-500/50 text-red-400 hover:bg-red-500/10"
                  onClick={logout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  退出登录
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  );
}
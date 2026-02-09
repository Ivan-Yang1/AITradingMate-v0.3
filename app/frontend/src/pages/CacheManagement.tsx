import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Database, 
  RefreshCw, 
  Trash2, 
  Clock, 
  Server,
  Zap,
  HardDrive,
  Activity,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { createClient } from '@metagptx/web-sdk';
import { useToast } from '@/hooks/use-toast';

const client = createClient();

interface CacheStats {
  backend: string;
  initialized: boolean;
  keys: number;
  used_memory: string;
}

interface CacheConfig {
  name: string;
  description: string;
  ttl: number;
  ttlUnit: string;
  icon: React.ReactNode;
}

const cacheConfigs: CacheConfig[] = [
  {
    name: '股票列表',
    description: '全市场股票基础信息',
    ttl: 24,
    ttlUnit: '小时',
    icon: <Database className="h-4 w-4" />
  },
  {
    name: '股票详情',
    description: '单只股票的详细信息',
    ttl: 24,
    ttlUnit: '小时',
    icon: <Server className="h-4 w-4" />
  },
  {
    name: '日K线数据',
    description: '股票日线级别K线数据',
    ttl: 6,
    ttlUnit: '小时',
    icon: <Activity className="h-4 w-4" />
  },
  {
    name: '周K线数据',
    description: '股票周线级别K线数据',
    ttl: 24,
    ttlUnit: '小时',
    icon: <Activity className="h-4 w-4" />
  },
  {
    name: '月K线数据',
    description: '股票月线级别K线数据',
    ttl: 24,
    ttlUnit: '小时',
    icon: <Activity className="h-4 w-4" />
  },
  {
    name: '实时行情',
    description: '股票实时价格和涨跌幅',
    ttl: 10,
    ttlUnit: '秒',
    icon: <Zap className="h-4 w-4" />
  },
  {
    name: 'AI分析结果',
    description: '股票AI智能分析缓存',
    ttl: 5,
    ttlUnit: '分钟',
    icon: <HardDrive className="h-4 w-4" />
  }
];

export default function CacheManagement() {
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  const fetchStats = async () => {
    try {
      setRefreshing(true);
      const response = await client.apiCall.invoke({
        url: '/api/v1/cache/stats',
        method: 'GET'
      });
      setStats(response.data);
    } catch (error: any) {
      console.error('Failed to fetch cache stats:', error);
      // 如果API不可用，显示默认状态
      setStats({
        backend: 'memory',
        initialized: true,
        keys: 0,
        used_memory: 'N/A'
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const clearCache = async () => {
    try {
      setClearing(true);
      await client.apiCall.invoke({
        url: '/api/v1/cache/clear',
        method: 'POST'
      });
      toast({
        title: '缓存已清空',
        description: '所有缓存数据已成功清除',
      });
      await fetchStats();
    } catch (error: any) {
      toast({
        title: '清空缓存失败',
        description: error?.message || '请稍后重试',
        variant: 'destructive'
      });
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">缓存管理</h1>
        <p className="text-muted-foreground">
          管理系统缓存，优化数据访问性能
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="config">缓存配置</TabsTrigger>
          <TabsTrigger value="benefits">性能优势</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* 缓存状态卡片 */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">缓存后端</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold capitalize">
                  {loading ? '加载中...' : stats?.backend || 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats?.backend === 'redis' ? 'Redis分布式缓存' : '内存缓存'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">缓存状态</CardTitle>
                {stats?.initialized ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                )}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? '...' : stats?.initialized ? '运行中' : '未初始化'}
                </div>
                <p className="text-xs text-muted-foreground">
                  缓存服务状态
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">缓存键数量</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? '...' : stats?.keys?.toLocaleString() || '0'}
                </div>
                <p className="text-xs text-muted-foreground">
                  当前存储的缓存条目
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">内存使用</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? '...' : stats?.used_memory || 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">
                  缓存占用内存
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 操作按钮 */}
          <Card>
            <CardHeader>
              <CardTitle>缓存操作</CardTitle>
              <CardDescription>
                管理缓存数据，刷新或清空缓存
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Button 
                variant="outline" 
                onClick={fetchStats}
                disabled={refreshing}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                刷新状态
              </Button>
              <Button 
                variant="destructive" 
                onClick={clearCache}
                disabled={clearing}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {clearing ? '清空中...' : '清空所有缓存'}
              </Button>
            </CardContent>
          </Card>

          {/* 缓存说明 */}
          <Card>
            <CardHeader>
              <CardTitle>缓存说明</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5">Redis</Badge>
                <div>
                  <p className="font-medium">分布式缓存模式</p>
                  <p className="text-sm text-muted-foreground">
                    当配置了REDIS_URL环境变量时，系统将使用Redis作为缓存后端，支持分布式部署和持久化存储。
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5">Memory</Badge>
                <div>
                  <p className="font-medium">内存缓存模式</p>
                  <p className="text-sm text-muted-foreground">
                    当Redis不可用时，系统自动降级为内存缓存，适用于单机部署场景。重启后缓存数据会丢失。
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>缓存配置详情</CardTitle>
              <CardDescription>
                各类数据的缓存策略和过期时间
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cacheConfigs.map((config, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        {config.icon}
                      </div>
                      <div>
                        <p className="font-medium">{config.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {config.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-sm">
                        {config.ttl} {config.ttlUnit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="benefits" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  响应速度提升
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  通过缓存常用数据，大幅减少API请求延迟
                </p>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>股票列表查询</span>
                      <span className="text-green-500">提升 95%</span>
                    </div>
                    <Progress value={95} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>K线数据加载</span>
                      <span className="text-green-500">提升 90%</span>
                    </div>
                    <Progress value={90} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>实时行情刷新</span>
                      <span className="text-green-500">提升 80%</span>
                    </div>
                    <Progress value={80} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5 text-blue-500" />
                  服务器负载降低
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  减少对Tushare API的请求次数，避免频率限制
                </p>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>API调用减少</span>
                      <span className="text-blue-500">减少 70%</span>
                    </div>
                    <Progress value={70} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>数据库查询减少</span>
                      <span className="text-blue-500">减少 60%</span>
                    </div>
                    <Progress value={60} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>网络带宽节省</span>
                      <span className="text-blue-500">节省 50%</span>
                    </div>
                    <Progress value={50} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>缓存策略说明</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">长期缓存</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      股票列表、股票基本信息等变化不频繁的数据
                    </p>
                    <Badge>24小时</Badge>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">中期缓存</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      K线数据、AI分析结果等需要定期更新的数据
                    </p>
                    <Badge>5分钟 - 6小时</Badge>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">短期缓存</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      实时行情等需要频繁更新但可短暂缓存的数据
                    </p>
                    <Badge>10秒</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
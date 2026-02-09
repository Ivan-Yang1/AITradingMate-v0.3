import { useState, useEffect } from 'react';
import { client } from '@/lib/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Database, RefreshCw, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataSource {
  id: string;
  name: string;
  description: string;
  features: string[];
  periods: string[];
  recommended?: boolean;
}

interface DataSourceSelectorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  showLabel?: boolean;
}

// 默认数据源列表 - 按优先级排序：东方财富 > 新浪财经 > Tushare
const DEFAULT_SOURCES: DataSource[] = [
  {
    id: 'eastmoney',
    name: '东方财富',
    description: 'AKShare免费数据，支持分钟K线（推荐）',
    features: ['股票列表', '多周期K线', '实时行情', '指数数据'],
    periods: ['1', '5', '15', '30', '60', 'daily', 'weekly', 'monthly'],
    recommended: true,
  },
  {
    id: 'sina',
    name: '新浪财经',
    description: 'AKShare免费数据（备用）',
    features: ['K线数据', '实时行情'],
    periods: ['5', '15', '30', '60', 'daily', 'weekly', 'monthly'],
    recommended: false,
  },
  {
    id: 'tushare',
    name: 'Tushare Pro',
    description: '专业金融数据接口，需要Token',
    features: ['股票列表', '日/周/月K线', '实时行情'],
    periods: ['daily', 'weekly', 'monthly'],
    recommended: false,
  },
];

// 默认数据源
const DEFAULT_SOURCE = 'eastmoney';

export default function DataSourceSelector({
  value,
  onChange,
  className,
  showLabel = true,
}: DataSourceSelectorProps) {
  const [sources, setSources] = useState<DataSource[]>(DEFAULT_SOURCES);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDataSources();
  }, []);

  const fetchDataSources = async () => {
    setLoading(true);
    try {
      const response = await client.apiCall.invoke({
        url: '/api/v1/data/sources',
        method: 'GET',
      });
      if (response.data?.sources && response.data.sources.length > 0) {
        setSources(response.data.sources);
        // 如果当前没有选择数据源，使用后端返回的默认值或东方财富
        if (!value) {
          onChange(response.data.default || DEFAULT_SOURCE);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data sources:', error);
      // 使用默认数据源列表
      setSources(DEFAULT_SOURCES);
      // 如果没有选择数据源，使用默认值
      if (!value) {
        onChange(DEFAULT_SOURCE);
      }
    } finally {
      setLoading(false);
    }
  };

  const selectedSource = sources.find((s) => s.id === value);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showLabel && (
        <div className="flex items-center gap-1.5 text-gray-400">
          <Database className="w-4 h-4" />
          <span className="text-sm">数据源:</span>
        </div>
      )}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[160px] bg-[#1A1A2E] border-[#2D2D3A] text-white">
          <SelectValue placeholder="选择数据源">
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <div className="flex items-center gap-1.5">
                {selectedSource?.recommended && (
                  <Star className="w-3 h-3 text-[#00D4AA] fill-[#00D4AA]" />
                )}
                <span>{selectedSource?.name || '选择数据源'}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-[#1A1A2E] border-[#2D2D3A]">
          {sources.map((source) => (
            <SelectItem
              key={source.id}
              value={source.id}
              className="text-white hover:bg-[#2D2D3A] focus:bg-[#2D2D3A]"
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  {source.recommended && (
                    <Star className="w-3 h-3 text-[#00D4AA] fill-[#00D4AA]" />
                  )}
                  <span className="font-medium">{source.name}</span>
                </div>
                <span className="text-xs text-gray-400">{source.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// 导出数据源类型和默认值
export type { DataSource };
export { DEFAULT_SOURCE, DEFAULT_SOURCES };
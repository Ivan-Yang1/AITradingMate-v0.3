import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-[#2D2D3A]',
        className
      )}
    />
  );
}

// K线图骨架屏
export function KLineChartSkeleton() {
  return (
    <div className="bg-[#1A1A2E] border border-[#2D2D3A] rounded-lg p-4">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-12" />
          <Skeleton className="h-8 w-12" />
          <Skeleton className="h-8 w-12" />
        </div>
      </div>
      {/* 图表区域 */}
      <div className="h-[500px] relative">
        {/* 模拟K线 */}
        <div className="absolute inset-0 flex items-end justify-around px-4 pb-16">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <Skeleton 
                className="w-2" 
                style={{ height: `${Math.random() * 200 + 100}px` }} 
              />
              <Skeleton 
                className="w-3" 
                style={{ height: `${Math.random() * 40 + 20}px` }} 
              />
            </div>
          ))}
        </div>
        {/* 加载提示 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin h-8 w-8 border-2 border-[#00D4AA] border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-3 text-gray-400 text-sm">加载K线数据...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// AI配置页面骨架屏
export function AIConfigSkeleton() {
  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div>
            <Skeleton className="h-7 w-40 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
      
      {/* Tabs */}
      <Skeleton className="h-10 w-full max-w-md" />
      
      {/* 内容卡片 */}
      <div className="bg-[#1A1A2E] border border-[#2D2D3A] rounded-lg p-6">
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-6" />
        
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-4 rounded-xl border border-[#2D2D3A]">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-24 mb-2" />
                  <Skeleton className="h-4 w-full mb-3" />
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <Skeleton key={j} className="h-5 w-16" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 股票搜索结果骨架屏
export function StockSearchSkeleton() {
  return (
    <div className="p-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="px-4 py-3 border-b border-[#2D2D3A] last:border-b-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

// 左侧边栏骨架屏
export function LeftSidebarSkeleton() {
  return (
    <div className="bg-[#1A1A2E] border border-[#2D2D3A] rounded-lg p-4 space-y-4">
      {/* 自选股标题 */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-4 rounded" />
      </div>
      
      {/* 股票列表 */}
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-2 rounded-lg bg-[#0A0A0F]">
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-4 w-16 mb-1" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="text-right">
                <Skeleton className="h-4 w-14 mb-1" />
                <Skeleton className="h-3 w-10" />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* 技术指标标题 */}
      <div className="pt-4 border-t border-[#2D2D3A]">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-4 rounded" />
        </div>
        
        {/* 指标卡片 */}
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-3 rounded-lg bg-[#0A0A0F]">
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
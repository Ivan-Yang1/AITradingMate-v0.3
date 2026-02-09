import { Loader2 } from 'lucide-react';

export default function PageLoading() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#2D2D3A] rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-[#00D4AA] rounded-full animate-spin"></div>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">加载中...</span>
        </div>
      </div>
    </div>
  );
}
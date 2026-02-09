import { Loader2 } from 'lucide-react';

interface ComponentLoadingProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function ComponentLoading({ 
  text = '加载中...', 
  size = 'md',
  className = ''
}: ComponentLoadingProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
      <Loader2 className={`${sizeClasses[size]} animate-spin text-[#00D4AA]`} />
      {text && <span className="mt-2 text-sm text-gray-400">{text}</span>}
    </div>
  );
}
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { DottedGlowBackground } from '@/components/ui/dotted-glow-background';
import { TypewriterEffectSmooth } from '@/components/ui/typewriter-effect';
import { Button } from '@/components/ui/button';
import { TrendingUp, Brain, BarChart3, Star, ArrowRight, Zap } from 'lucide-react';
import Header from '@/components/Header';

export default function Home() {
  const navigate = useNavigate();

  const titleWords = [
    {
      text: "AI",
      className: "text-[#00D4AA]",
    },
    {
      text: "Trading",
      className: "text-[#00D4AA]",
    },
    {
      text: "Mate",
      className: "text-[#00B894]",
    },
  ];

  const features = [
    {
      icon: <BarChart3 className="h-8 w-8" />,
      title: 'K线图分析',
      description: '专业K线图展示，支持日K、周K、月K切换，实时获取A股市场数据'
    },
    {
      icon: <TrendingUp className="h-8 w-8" />,
      title: '技术指标',
      description: 'MA均线、成交量等技术指标分析，帮助您把握市场趋势'
    },
    {
      icon: <Brain className="h-8 w-8" />,
      title: 'AI智能分析',
      description: '基于DeepSeek大模型的智能分析，为您提供专业的技术分析建议'
    },
    {
      icon: <Star className="h-8 w-8" />,
      title: '自选股管理',
      description: '便捷的自选股列表，快速切换查看您关注的股票'
    }
  ];

  return (
    <div className="relative min-h-screen bg-[#0A0A0F] overflow-hidden">
      <Header />
      
      {/* Dotted Glow Background */}
      <DottedGlowBackground
        className="pointer-events-none"
        opacity={0.8}
        gap={16}
        radius={1.8}
        color="rgba(0, 212, 170, 0.4)"
        darkColor="rgba(0, 212, 170, 0.5)"
        glowColor="rgba(0, 212, 170, 0.9)"
        darkGlowColor="rgba(0, 184, 148, 0.95)"
        backgroundOpacity={0}
        speedMin={0.2}
        speedMax={1.2}
        speedScale={0.8}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-start min-h-screen px-4 pt-28">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.3,
            duration: 0.8,
            ease: "easeInOut",
          }}
          className="text-center max-w-4xl mx-auto"
        >
          {/* Logo Icon */}
          <motion.div 
            className="flex items-center justify-center mb-4"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: "spring" }}
          >
            <div className="p-4 bg-gradient-to-br from-[#00D4AA] to-[#00B894] rounded-2xl shadow-lg shadow-[#00D4AA]/30">
              <Zap className="h-12 w-12 text-black" />
            </div>
          </motion.div>

          {/* Title with Typewriter Effect */}
          <div className="flex items-center justify-center mb-4">
            <TypewriterEffectSmooth 
              words={titleWords} 
              className="text-5xl md:text-7xl font-bold"
              cursorClassName="bg-[#00D4AA] h-12 md:h-16"
            />
          </div>

          {/* Tagline */}
          <motion.p 
            className="text-xl md:text-2xl text-gray-400 mb-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            AI驱动的智能看盘助手，让投资决策更简单
          </motion.p>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button
              onClick={() => navigate('/trading')}
              size="lg"
              className="bg-gradient-to-r from-[#00D4AA] to-[#00B894] hover:from-[#00B894] hover:to-[#00D4AA] text-black font-bold text-lg px-8 py-6 rounded-xl shadow-lg shadow-[#00D4AA]/20 transition-all hover:shadow-[#00D4AA]/40 hover:scale-105"
            >
              开始看盘
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              onClick={() => navigate('/pricing')}
              size="lg"
              variant="outline"
              className="border-[#2D2D3A] text-gray-300 hover:bg-[#1A1A2E] hover:text-white font-medium text-lg px-8 py-6 rounded-xl transition-all"
            >
              查看价格
            </Button>
          </motion.div>

          {/* Stats */}
          <motion.div 
            className="flex items-center justify-center gap-8 mt-14 text-gray-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <div className="text-center">
              <p className="text-3xl font-bold text-white">5000+</p>
              <p className="text-sm">A股覆盖</p>
            </div>
            <div className="w-px h-12 bg-[#2D2D3A]"></div>
            <div className="text-center">
              <p className="text-3xl font-bold text-white">实时</p>
              <p className="text-sm">数据更新</p>
            </div>
            <div className="w-px h-12 bg-[#2D2D3A]"></div>
            <div className="text-center">
              <p className="text-3xl font-bold text-white">AI</p>
              <p className="text-sm">智能分析</p>
            </div>
          </motion.div>
        </motion.div>

        {/* Features Grid */}
        <motion.div 
          className="mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto px-4"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.6 }}
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              className="p-6 bg-[#1A1A2E]/80 backdrop-blur-sm border border-[#2D2D3A] rounded-xl hover:border-[#00D4AA]/50 transition-all hover:transform hover:-translate-y-1 group"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 + index * 0.1 }}
            >
              <div className="text-[#00D4AA] mb-4 group-hover:scale-110 transition-transform">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-gray-400 text-sm">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Footer */}
        <motion.div 
          className="mt-auto py-8 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          <p className="text-gray-500 text-sm">
            数据来源: Tushare | AI模型: DeepSeek
          </p>
        </motion.div>
      </div>
    </div>
  );
}
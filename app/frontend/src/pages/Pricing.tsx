import React from 'react';
import { motion } from 'motion/react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Zap, Crown, Building2 } from 'lucide-react';

const plans = [
  {
    name: '免费版',
    icon: <Zap className="h-6 w-6" />,
    price: '¥0',
    period: '/月',
    description: '适合个人投资者入门使用',
    features: [
      '每日10次AI分析',
      '基础K线图展示',
      '5只自选股',
      'MA均线指标',
      '社区支持',
    ],
    buttonText: '开始使用',
    popular: false,
  },
  {
    name: '专业版',
    icon: <Crown className="h-6 w-6" />,
    price: '¥99',
    period: '/月',
    description: '适合活跃交易者深度分析',
    features: [
      '无限次AI分析',
      '高级K线图与指标',
      '无限自选股',
      '全部技术指标',
      '实时数据推送',
      '优先客服支持',
      '历史分析记录',
    ],
    buttonText: '升级专业版',
    popular: true,
  },
  {
    name: '企业版',
    icon: <Building2 className="h-6 w-6" />,
    price: '定制',
    period: '',
    description: '适合机构和团队使用',
    features: [
      '专业版全部功能',
      'API接口访问',
      '多用户管理',
      '定制化报告',
      '专属客户经理',
      'SLA服务保障',
      '私有化部署',
    ],
    buttonText: '联系销售',
    popular: false,
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-[#0A0A0F]">
      <Header />
      
      <div className="pt-24 pb-12 px-4 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Page Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">选择适合您的方案</h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              无论您是投资新手还是专业交易者，我们都有适合您的方案
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className={`bg-[#1A1A2E] border-[#2D2D3A] h-full relative ${plan.popular ? 'border-[#00D4AA] shadow-lg shadow-[#00D4AA]/20' : ''}`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-[#00D4AA] to-[#00B894] text-black text-sm font-medium rounded-full">
                      最受欢迎
                    </div>
                  )}
                  <CardHeader className="text-center pb-2">
                    <div className={`mx-auto p-3 rounded-xl mb-4 ${plan.popular ? 'bg-[#00D4AA]/20 text-[#00D4AA]' : 'bg-[#2D2D3A] text-gray-400'}`}>
                      {plan.icon}
                    </div>
                    <CardTitle className="text-white text-xl">{plan.name}</CardTitle>
                    <CardDescription className="text-gray-400">{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="text-center">
                      <span className="text-4xl font-bold text-white">{plan.price}</span>
                      <span className="text-gray-400">{plan.period}</span>
                    </div>
                    
                    <ul className="space-y-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-3 text-gray-300">
                          <Check className="h-5 w-5 text-[#00D4AA] flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button 
                      className={`w-full ${plan.popular 
                        ? 'bg-gradient-to-r from-[#00D4AA] to-[#00B894] text-black hover:opacity-90' 
                        : 'bg-[#2D2D3A] text-white hover:bg-[#3D3D4A]'}`}
                    >
                      {plan.buttonText}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* FAQ Section */}
          <div className="mt-20">
            <h2 className="text-2xl font-bold text-white text-center mb-8">常见问题</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                { q: '可以随时取消订阅吗？', a: '是的，您可以随时取消订阅，取消后将在当前计费周期结束时停止服务。' },
                { q: '支持哪些支付方式？', a: '我们支持支付宝、微信支付、银行卡等多种支付方式。' },
                { q: '免费版有使用期限吗？', a: '免费版永久免费，您可以一直使用基础功能。' },
                { q: '企业版如何定价？', a: '企业版根据用户数量和定制需求报价，请联系我们的销售团队获取详细方案。' },
              ].map((faq) => (
                <div key={faq.q} className="p-6 bg-[#1A1A2E] border border-[#2D2D3A] rounded-xl">
                  <h3 className="text-white font-medium mb-2">{faq.q}</h3>
                  <p className="text-gray-400 text-sm">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
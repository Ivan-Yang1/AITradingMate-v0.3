import React from 'react';
import { motion } from 'motion/react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, Phone, MapPin, MessageSquare, Send, Clock } from 'lucide-react';

export default function Contact() {
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
            <h1 className="text-4xl font-bold text-white mb-4">联系我们</h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              有任何问题或建议？我们随时为您提供帮助
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Contact Info */}
            <div className="space-y-6">
              <Card className="bg-[#1A1A2E] border-[#2D2D3A]">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-[#00D4AA]/20 rounded-lg">
                      <Mail className="h-6 w-6 text-[#00D4AA]" />
                    </div>
                    <div>
                      <h3 className="text-white font-medium mb-1">邮箱</h3>
                      <p className="text-gray-400">support@aitradingmate.com</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#1A1A2E] border-[#2D2D3A]">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-[#00D4AA]/20 rounded-lg">
                      <Phone className="h-6 w-6 text-[#00D4AA]" />
                    </div>
                    <div>
                      <h3 className="text-white font-medium mb-1">电话</h3>
                      <p className="text-gray-400">400-888-8888</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#1A1A2E] border-[#2D2D3A]">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-[#00D4AA]/20 rounded-lg">
                      <MapPin className="h-6 w-6 text-[#00D4AA]" />
                    </div>
                    <div>
                      <h3 className="text-white font-medium mb-1">地址</h3>
                      <p className="text-gray-400">上海市浦东新区陆家嘴金融中心</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#1A1A2E] border-[#2D2D3A]">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-[#00D4AA]/20 rounded-lg">
                      <Clock className="h-6 w-6 text-[#00D4AA]" />
                    </div>
                    <div>
                      <h3 className="text-white font-medium mb-1">工作时间</h3>
                      <p className="text-gray-400">周一至周五 9:00 - 18:00</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Contact Form */}
            <Card className="bg-[#1A1A2E] border-[#2D2D3A] lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-[#00D4AA]" />
                  发送消息
                </CardTitle>
                <CardDescription className="text-gray-400">
                  填写以下表单，我们会尽快回复您
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-gray-300">姓名</Label>
                      <Input
                        placeholder="请输入您的姓名"
                        className="bg-[#0A0A0F] border-[#2D2D3A] text-gray-300 focus:border-[#00D4AA]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-300">邮箱</Label>
                      <Input
                        type="email"
                        placeholder="请输入您的邮箱"
                        className="bg-[#0A0A0F] border-[#2D2D3A] text-gray-300 focus:border-[#00D4AA]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-300">主题</Label>
                    <Input
                      placeholder="请输入消息主题"
                      className="bg-[#0A0A0F] border-[#2D2D3A] text-gray-300 focus:border-[#00D4AA]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-300">消息内容</Label>
                    <textarea
                      rows={6}
                      placeholder="请详细描述您的问题或建议..."
                      className="w-full p-3 bg-[#0A0A0F] border border-[#2D2D3A] rounded-lg text-gray-300 resize-none focus:border-[#00D4AA] focus:outline-none"
                    />
                  </div>

                  <Button className="w-full bg-gradient-to-r from-[#00D4AA] to-[#00B894] text-black font-medium hover:opacity-90">
                    <Send className="h-4 w-4 mr-2" />
                    发送消息
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Social Links */}
          <div className="mt-12 text-center">
            <p className="text-gray-400 mb-4">关注我们的社交媒体</p>
            <div className="flex justify-center gap-4">
              {['微信', '微博', 'Twitter', 'GitHub'].map((social) => (
                <button
                  key={social}
                  className="px-6 py-2 bg-[#1A1A2E] border border-[#2D2D3A] rounded-lg text-gray-300 hover:border-[#00D4AA]/50 hover:text-white transition-colors"
                >
                  {social}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
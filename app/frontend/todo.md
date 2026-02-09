# AI Trading Mate - 用户认证与数据持久化开发计划

## 已完成功能
- ✅ 首页 (Home.tsx) - 带有打字机效果的Hero区域和导航
- ✅ 交易看盘页 (Trading.tsx) - K线图展示、股票搜索、自选股管理
- ✅ AI对话侧边栏 (AIChatSidebar.tsx) - 集成fin-agent的AI分析功能
- ✅ K线图组件 (KLineChart.tsx) - 支持日/周/月K线切换
- ✅ 技术指标面板 (TechIndicators.tsx) - MA均线、成交量展示
- ✅ 后端Tushare API - K线数据获取

## 本次开发任务

### 1. Auth0集成
- [x] 数据库表创建 (watchlists, analysis_history, user_settings)
- [ ] 前端Header组件添加登录/登出按钮
- [ ] 创建AuthContext用于全局用户状态管理
- [ ] Profile页面绑定真实用户数据

### 2. 用户会话管理
- [ ] 实现登录状态持久化
- [ ] 自动登出功能

### 3. 数据持久化
- [ ] 自选股云端同步 (WatchList组件改造)
- [ ] AI分析历史保存 (AIChatSidebar改造)
- [ ] 用户配置持久化 (AIConfig页面改造)

### 4. 实时行情接入
- [ ] 获取自选股实时行情数据
- [ ] 替换模拟涨跌数据

## 文件清单
1. `src/contexts/AuthContext.tsx` - 用户认证上下文
2. `src/components/Header.tsx` - 更新添加登录按钮
3. `src/pages/Profile.tsx` - 更新绑定真实用户数据
4. `src/components/WatchList.tsx` - 更新支持云端同步
5. `src/components/AIChatSidebar.tsx` - 更新保存分析历史
6. `src/pages/AIConfig.tsx` - 更新保存用户配置
7. `src/pages/Trading.tsx` - 更新实时行情
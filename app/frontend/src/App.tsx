import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { TradingStateProvider } from './contexts/TradingStateContext';
import PageLoading from './components/PageLoading';

// 路由懒加载 - 减少首屏加载时间
const Home = lazy(() => import('./pages/Home'));
const Trading = lazy(() => import('./pages/Trading'));
const AIConfig = lazy(() => import('./pages/AIConfig'));
const Pricing = lazy(() => import('./pages/Pricing'));
const Contact = lazy(() => import('./pages/Contact'));
const Profile = lazy(() => import('./pages/Profile'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const CacheManagement = lazy(() => import('./pages/CacheManagement'));

function App() {
  return (
    <AuthProvider>
      <TradingStateProvider>
        <Router>
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/trading" element={<Trading />} />
              <Route path="/ai-config" element={<AIConfig />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/cache" element={<CacheManagement />} />
            </Routes>
          </Suspense>
        </Router>
      </TradingStateProvider>
    </AuthProvider>
  );
}

export default App;
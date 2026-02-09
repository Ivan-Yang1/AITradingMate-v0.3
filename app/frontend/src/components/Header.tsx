import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Zap, User, Menu, X, LogIn, LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const navItems = [
  { name: '首页', path: '/' },
  { name: '行情', path: '/trading' },
  { name: 'AI配置', path: '/ai-config' },
  { name: '价格', path: '/pricing' },
  { name: '联系', path: '/contact' },
];

export default function Header() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0F]/80 backdrop-blur-md border-b border-[#2D2D3A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-br from-[#00D4AA] to-[#00B894] rounded-lg">
              <Zap className="h-5 w-5 text-black" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-[#00D4AA] to-[#00B894] bg-clip-text text-transparent">
              AI Trading Mate
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  location.pathname === item.path
                    ? "text-[#00D4AA] bg-[#00D4AA]/10"
                    : "text-gray-400 hover:text-white hover:bg-[#1A1A2E]"
                )}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* User Menu */}
          <div className="hidden md:flex items-center gap-3">
            {isLoading ? (
              <Button variant="ghost" size="sm" disabled>
                <Loader2 className="h-4 w-4 animate-spin" />
              </Button>
            ) : isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-white hover:bg-[#1A1A2E] flex items-center gap-2"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback className="bg-[#00D4AA]/20 text-[#00D4AA] text-xs">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="max-w-[100px] truncate">{user.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 bg-[#1A1A2E] border-[#2D2D3A]"
                >
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium text-white">{user.name}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator className="bg-[#2D2D3A]" />
                  <DropdownMenuItem asChild>
                    <Link
                      to="/profile"
                      className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white focus:text-white"
                    >
                      <User className="h-4 w-4" />
                      个人中心
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[#2D2D3A]" />
                  <DropdownMenuItem
                    onClick={logout}
                    className="flex items-center gap-2 cursor-pointer text-red-400 hover:text-red-300 focus:text-red-300"
                  >
                    <LogOut className="h-4 w-4" />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={login}
                className="text-gray-400 hover:text-white hover:bg-[#1A1A2E]"
              >
                <LogIn className="h-4 w-4 mr-2" />
                登录
              </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-gray-400 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-[#2D2D3A]">
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    location.pathname === item.path
                      ? "text-[#00D4AA] bg-[#00D4AA]/10"
                      : "text-gray-400 hover:text-white hover:bg-[#1A1A2E]"
                  )}
                >
                  {item.name}
                </Link>
              ))}
              
              {isAuthenticated && user ? (
                <>
                  <Link
                    to="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center",
                      location.pathname === '/profile'
                        ? "text-[#00D4AA] bg-[#00D4AA]/10"
                        : "text-gray-400 hover:text-white hover:bg-[#1A1A2E]"
                    )}
                  >
                    <User className="h-4 w-4 mr-2" />
                    个人中心
                  </Link>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logout();
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center text-red-400 hover:text-red-300 hover:bg-[#1A1A2E]"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    退出登录
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    login();
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center text-gray-400 hover:text-white hover:bg-[#1A1A2E]"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  登录
                </button>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar, 
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/icons/logo';
import { LayoutDashboard, History, Settings, LogOut, DollarSign, LogIn, CreditCard, BarChartBig, User, AlertCircle, Activity, RefreshCw, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { isFirebaseInitialized } from '@/lib/firebase/firebase';
import { Badge } from '@/components/ui/badge';

export function SidebarContentComponent() {
  const auth = useAuth();
  const { isMobile, open, setOpen, openMobile, setOpenMobile } = useSidebar(); 
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    if (auth && auth.logout) {
      await auth.logout();
    } else {
      console.error("[SidebarContentComponent] Logout function is not available on auth context.");
      // Potentially fall back to a simple window.location redirect if appropriate
      // or notify the user that logout failed.
    }
  };

  const handleMenuClick = () => {
    if (isMobile) {
      setOpenMobile(false); 
    } else {
      if (open) {
        setOpen(false);
      }
    }
  };

  const canSwitchToDemo = auth.currentAuthMethod === 'deriv' && auth.derivDemoAccountId && auth.selectedDerivAccountType !== 'demo';
  const canSwitchToLive = auth.currentAuthMethod === 'deriv' && auth.derivLiveAccountId && auth.selectedDerivAccountType !== 'live';

  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon">
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-2 text-sidebar-primary hover:text-sidebar-primary-foreground">
          <Logo className="h-8 w-auto text-sidebar-primary" />
        </Link>
      </SidebarHeader>
      <Separator className="bg-sidebar-border" />
      <SidebarContent className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/'}
              tooltip={{ children: 'Dashboard', side: 'right' }}
              onClick={handleMenuClick}
            >
              <Link href="/">
                <LayoutDashboard />
                <span>Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
           <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/volatility-trading'}
              tooltip={{ children: 'Volatility Trading', side: 'right' }}
              onClick={handleMenuClick}
            >
              <Link href="/volatility-trading">
                <Activity />
                <span>Volatility Trading</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/mt5-trading'}
              tooltip={{ children: 'MT5 Trading', side: 'right' }}
              onClick={handleMenuClick}
            >
              <Link href="/mt5-trading">
                <BarChartBig />
                <span>MT5 Trading</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/trade-history'}
              tooltip={{ children: 'Trade History', side: 'right' }}
              onClick={handleMenuClick}
            >
              <Link href="/trade-history">
                <History />
                <span>Trade History</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/ai-performance'}
              tooltip={{ children: 'AI Performance', side: 'right' }}
              onClick={handleMenuClick}
            >
              <Link href="/ai-performance">
                <BarChartBig />
                <span>AI Performance</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
           <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/profits-claimable'}
              tooltip={{ children: 'Profits Claimable', side: 'right' }}
              onClick={handleMenuClick}
            >
              <Link href="/profits-claimable">
                <DollarSign />
                <span>Profits Claimable</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/payments'}
              tooltip={{ children: 'Payments', side: 'right' }}
              onClick={handleMenuClick}
            >
              <Link href="/payments">
                <CreditCard />
                <span>Payments</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/settings'}
              tooltip={{ children: 'Settings', side: 'right' }}
              onClick={handleMenuClick}
            >
              <Link href="/settings"> 
                <Settings />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/settings/profile'}
              tooltip={{ children: 'User Profile', side: 'right' }}
              onClick={handleMenuClick}
            >
              <Link href="/settings/profile"> 
                <User /> 
                <span>User Profile</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          
          { !isFirebaseInitialized() && (
            <SidebarMenuItem>
               <SidebarMenuButton
                isActive={false}
                tooltip={{children: "Firebase Not Configured", side: "right"}}
                className="text-destructive-foreground bg-destructive hover:bg-destructive/90 cursor-not-allowed"
                disabled
               >
                <AlertCircle/>
                <span>Firebase N/A</span>
               </SidebarMenuButton>
            </SidebarMenuItem>
           )}
        </SidebarMenu>
      </SidebarContent>
      <Separator className="bg-sidebar-border" />
      <SidebarFooter className="p-4">
        {auth.authStatus === 'authenticated' && auth.userInfo ? (
          <div className="flex flex-col gap-3 items-start group-data-[collapsible=icon]:items-center">
            <div className="flex items-center gap-3 w-full">
              <Avatar className="h-10 w-10">
                {auth.userInfo.photoURL ? (
                  <AvatarImage src={auth.userInfo.photoURL} alt={auth.userInfo.name || 'User'} />
                ) : (
                  <AvatarImage src={`https://avatar.vercel.sh/${auth.userInfo.id}.png?text=${auth.userInfo.name?.substring(0,2).toUpperCase() || 'U'}`} alt={auth.userInfo.name || 'User'} />
                )}
                <AvatarFallback>{auth.userInfo.name?.substring(0, 2).toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
              <div className="group-data-[collapsible=icon]:hidden flex-grow">
                <p className="text-sm font-medium text-sidebar-foreground truncate" title={auth.userInfo.name || ''}>{auth.userInfo.name || 'Anonymous User'}</p>
                {auth.userInfo.email && <p className="text-xs text-sidebar-foreground/70 truncate" title={auth.userInfo.email}>{auth.userInfo.email}</p>}
                
                {auth.currentAuthMethod === 'deriv' ? (
                  <div className="text-xs text-sidebar-foreground/70 mt-0.5">
                    <div className='flex items-center'>
                       <span className="mr-1">Deriv:</span>
                        {auth.selectedDerivAccountType === 'demo' && auth.derivDemoAccountId && (
                            <Badge variant="outline" className="border-sky-500 text-sky-500">Demo: {auth.derivDemoAccountId}</Badge>
                        )}
                        {auth.selectedDerivAccountType === 'live' && auth.derivLiveAccountId && (
                            <Badge variant="outline" className="border-green-500 text-green-500">Real: {auth.derivLiveAccountId}</Badge>
                        )}
                         {!auth.selectedDerivAccountType && (
                            <Badge variant="secondary">Account</Badge>
                        )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-sidebar-foreground/50 capitalize">
                    {auth.currentAuthMethod ? `${auth.currentAuthMethod} Account` : 'Logged In'}
                  </p>
                )}
              </div>
            </div>

            {auth.currentAuthMethod === 'deriv' && (auth.derivDemoAccountId || auth.derivLiveAccountId) && (
              <div className="group-data-[collapsible=icon]:hidden w-full space-y-1 mt-1">
                {canSwitchToDemo && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start text-xs h-auto py-1 px-2 hover:bg-sidebar-accent"
                    onClick={() => {auth.switchToDerivDemo(); handleMenuClick();}}
                  >
                    <Eye className="mr-2 h-3.5 w-3.5 text-sky-500" /> Switch to Demo
                  </Button>
                )}
                {canSwitchToLive && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start text-xs h-auto py-1 px-2 hover:bg-sidebar-accent"
                    onClick={() => {auth.switchToDerivLive(); handleMenuClick();}}
                  >
                    <EyeOff className="mr-2 h-3.5 w-3.5 text-green-500" /> Switch to Real
                  </Button>
                )}
              </div>
            )}

            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:aspect-square"
              onClick={async () => {
                if (auth && auth.logout) {
                  await auth.logout();
                } else {
                   console.error("[SidebarContentComponent] Logout function not available for button click.");
                }
                if (typeof handleMenuClick === 'function') {
                   handleMenuClick();
                }
              }}
              aria-label="Logout"
            >
              <LogOut className="mr-2 group-data-[collapsible=icon]:mr-0 h-4 w-4" />
              <span className="group-data-[collapsible=icon]:hidden">Logout</span>
            </Button>
          </div>
        ) : (
          <div className="group-data-[collapsible=icon]:hidden w-full space-y-2">
            <Button 
              asChild
              variant="outline" 
              className="w-full bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
              onClick={handleMenuClick}
            >
              <Link href="/auth/login">
                <LogIn className="mr-2 h-4 w-4" />
                Login
              </Link>
            </Button>
             <Button 
              asChild
              variant="outline" 
              className="w-full bg-sidebar-background text-sidebar-foreground border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={handleMenuClick}
            >
              <Link href="/auth/signup">
                <User className="mr-2 h-4 w-4" />
                Sign Up
              </Link>
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}


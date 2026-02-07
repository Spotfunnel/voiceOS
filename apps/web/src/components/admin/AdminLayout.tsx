 'use client';
 
 import React from 'react';
 import { usePathname, useRouter } from 'next/navigation';
 import {
   Activity,
   AlertTriangle,
   Settings,
   TrendingUp,
   UserPlus,
 } from 'lucide-react';
 import { cn } from '@/components/ui/cn';
 
 type AdminNavItem = {
   id: string;
   label: string;
   path: string;
   icon: React.ElementType;
 };
 
 const NAV_ITEMS: AdminNavItem[] = [
   { id: 'operations', label: 'Operations', path: '/admin/operations', icon: Activity },
   { id: 'new-agent', label: 'New Agent', path: '/admin/new-agent', icon: UserPlus },
   { id: 'configure', label: 'Configure', path: '/admin/configure', icon: Settings },
   { id: 'quality', label: 'Quality', path: '/admin/quality', icon: AlertTriangle },
   { id: 'intelligence', label: 'Intelligence', path: '/admin/intelligence', icon: TrendingUp },
 ];
 
 interface AdminLayoutProps {
   children: React.ReactNode;
   tenantName?: string | null;
 }
 
 export function AdminLayout({ children, tenantName }: AdminLayoutProps) {
   const pathname = usePathname();
   const router = useRouter();
 
   return (
     <div className="min-h-screen bg-background">
       <nav className="border-b bg-card">
         <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
           <div>
             <p className="text-xs font-semibold uppercase text-muted-foreground">SpotFunnel</p>
             <h1 className="text-xl font-semibold text-foreground">Admin Control Panel</h1>
           </div>
           <div className="flex items-center gap-3 text-sm text-muted-foreground">
             <span className="hidden sm:inline">Operator Mode</span>
             {tenantName ? (
               <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground">
                 Viewing as: {tenantName}
               </span>
             ) : null}
           </div>
         </div>
         <div className="mx-auto w-full max-w-7xl px-6 pb-3">
           <div className="flex flex-wrap gap-2">
             {NAV_ITEMS.map((item) => {
               const Icon = item.icon;
               const isActive = pathname === item.path;
               return (
                 <button
                   key={item.id}
                   type="button"
                   onClick={() => router.push(item.path)}
                   className={cn(
                     'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                     isActive
                       ? 'bg-primary text-primary-foreground'
                       : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                   )}
                 >
                   <Icon className="h-4 w-4" />
                   {item.label}
                 </button>
               );
             })}
           </div>
         </div>
       </nav>
       <main className="mx-auto w-full max-w-7xl px-6 py-6">{children}</main>
     </div>
   );
 }

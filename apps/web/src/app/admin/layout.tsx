 import { redirect } from 'next/navigation';
 import { getServerSession } from '@/server/session';
 
 export default function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
   const session = getServerSession();
 
   if (session.role !== 'operator') {
     redirect('/dashboard');
   }
 
  return <>{children}</>;
 }

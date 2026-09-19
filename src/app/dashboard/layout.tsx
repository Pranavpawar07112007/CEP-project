import * as React from 'react';
import { Sidebar } from '@/components/layout/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 overflow-auto bg-muted/20">
        <div className="h-full px-4 py-6 md:px-8 max-w-7xl mx-auto">
            {children}
        </div>
      </div>
    </div>
  );
}

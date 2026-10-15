'use client';
import { createContext, useContext, ReactNode } from 'react';

export const DashboardContext = createContext<{
  isDashboardOverview: boolean;
} | undefined>(undefined);

export function DashboardProvider({ children, isDashboardOverview }: { children: ReactNode; isDashboardOverview: boolean }) {
  return (
    <DashboardContext.Provider value={{ isDashboardOverview }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}

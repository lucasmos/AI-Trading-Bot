'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { AiStrategyPerformanceTable } from '@/components/dashboard/ai-strategy-performance-table';
import type { StrategyPerformanceData } from '@/app/api/ai/strategy-performance/route';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast'; // Added for potential error toasts

const AiPerformancePage = () => {
  const { authStatus } = useAuth();
  const { toast } = useToast(); // Initialize useToast

  const [strategyPerformance, setStrategyPerformance] = useState<StrategyPerformanceData[]>([]);
  const [isPerfLoading, setIsPerfLoading] = useState(true);
  const [perfError, setPerfError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPerformanceData() {
      if (authStatus !== 'authenticated') {
        setIsPerfLoading(false);
        setPerfError("Please log in to view strategy performance.");
        // Optionally, show a toast
        // toast({ title: "Authentication Required", description: "Please log in to view strategy performance.", variant: "destructive" });
        return;
      }
      setIsPerfLoading(true);
      setPerfError(null);
      try {
        const response = await fetch('/api/ai/strategy-performance');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Error fetching data: ${response.status}`);
        }
        const data: StrategyPerformanceData[] = await response.json();
        setStrategyPerformance(data);
      } catch (err) {
        console.error("Failed to fetch AI strategy performance:", err);
        const errorMessage = err instanceof Error ? err.message : 'Could not load performance data.';
        setPerfError(errorMessage);
        toast({ // Show toast on error
          title: "Error Loading Performance Data",
          description: errorMessage,
          variant: "destructive"
        });
      }
      setIsPerfLoading(false);
    }

    if (authStatus !== 'pending') { // Avoid fetching if auth status is still pending
        fetchPerformanceData();
    }
  }, [authStatus, toast]); // Added toast to dependency array

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Strategy Performance</CardTitle>
          <CardDescription>
            Review the historical performance of various AI trading strategies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AiStrategyPerformanceTable 
            performanceData={strategyPerformance}
            isLoading={isPerfLoading}
            error={perfError}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default AiPerformancePage; 
import { AutomatedTradingControls } from '@/components/dashboard/AutomatedTradingControls';
import { AppLayout } from '@/components/layout/app-layout'; // Assuming a general app layout component exists

export default function AutomatedTradingPage() {
  return (
    <AppLayout> {/* Or whatever your standard page layout component is */}
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-6">
          AI Automated Trading
        </h1>
        <AutomatedTradingControls />
      </div>
    </AppLayout>
  );
}

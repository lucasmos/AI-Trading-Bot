import { Suspense } from 'react';
import DerivFinalizeClient from './DerivFinalizeClient';

export const dynamic = 'force-dynamic';

export default function DerivFinalizePage() {
  return (
    <Suspense fallback={<div>Loading Deriv Login...</div>}>
      <DerivFinalizeClient />
    </Suspense>
  );
} 
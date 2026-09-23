import { useEffect } from 'react';
import { useIsMutating } from '@tanstack/react-query';

export function useGlobalPendingQuestionGuard(): void {
  const pendingCount = useIsMutating({
    predicate: (mutation) => mutation.options.mutationKey?.[0] === 'sendMessage',
  });

  useEffect(() => {
    if (pendingCount === 0) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [pendingCount]);
}

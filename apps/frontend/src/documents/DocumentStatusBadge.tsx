import type { DocumentStatus } from '@/api/types';
import { Badge } from '@/components/ui/badge';

interface DocumentStatusBadgeProps {
  status: DocumentStatus;
  error?: string | null;
}

export function DocumentStatusBadge({ status, error }: DocumentStatusBadgeProps) {
  switch (status) {
    case 'ready':
      return <Badge variant="success">Listo</Badge>;
    case 'processing':
      return (
        <Badge variant="warning" className="animate-pulse">
          Procesando
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="destructive" title={error ?? undefined}>
          Error
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

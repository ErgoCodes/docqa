import * as React from 'react';
import { Link } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type RecentConversationItem,
  recentConversationsStore,
} from './recent-conversations-store';

export function RecentConversationsList() {
  const [recents, setRecents] = React.useState<RecentConversationItem[]>([]);

  React.useEffect(() => {
    setRecents(recentConversationsStore.list());
  }, []);

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    recentConversationsStore.remove(id);
    setRecents(recentConversationsStore.list());
  };

  if (recents.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Conversaciones recientes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-border divide-y rounded-md border">
          {recents.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 text-sm hover:bg-muted/40 transition-colors"
            >
              <Link
                to="/conversations/$id"
                params={{ id: item.id }}
                className="min-w-0 flex-1 hover:underline font-medium truncate"
              >
                {item.title}
                <span className="text-muted-foreground block text-xs font-normal">
                  {new Date(item.updatedAt).toLocaleDateString()}
                </span>
              </Link>
              <button
                type="button"
                onClick={(e) => handleRemove(e, item.id)}
                className="text-muted-foreground hover:text-foreground ml-2 p-1 text-xs"
                title="Eliminar del historial local"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

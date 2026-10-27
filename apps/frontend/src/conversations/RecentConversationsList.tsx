import * as React from 'react';
import { Link } from '@tanstack/react-router';
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
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Historial reciente
        </h4>
        <span className="text-[11px] text-muted-foreground/80">{recents.length}</span>
      </div>

      <div className="divide-border/60 divide-y rounded-xl border border-border/80 bg-card overflow-hidden">
        {recents.map((item) => (
          <div
            key={item.id}
            className="group flex items-center justify-between p-3 text-sm transition-colors hover:bg-secondary/40"
          >
            <Link
              to="/conversations/$id"
              params={{ id: item.id }}
              className="min-w-0 flex-1 hover:text-primary transition-colors font-medium truncate"
            >
              <div className="truncate text-foreground font-medium">{item.title}</div>
              <span className="text-muted-foreground block text-[11px] mt-0.5">
                {new Date(item.updatedAt).toLocaleDateString()}
              </span>
            </Link>
            <button
              type="button"
              onClick={(e) => handleRemove(e, item.id)}
              className="text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-md p-1.5 text-xs transition-colors cursor-pointer opacity-70 group-hover:opacity-100"
              title="Eliminar del historial local"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-3.5"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

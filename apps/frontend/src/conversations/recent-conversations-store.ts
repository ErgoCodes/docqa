export interface RecentConversationItem {
  id: string;
  title: string;
  documentIds: string[];
  updatedAt: string;
}

const STORAGE_KEY = 'docqa.recent_conversations.v1';
const MAX_ITEMS = 20;

export const recentConversationsStore = {
  list(): RecentConversationItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as RecentConversationItem[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  addOrUpdate(item: RecentConversationItem): void {
    try {
      const current = this.list();
      const filtered = current.filter((c) => c.id !== item.id);
      const updated = [item, ...filtered].slice(0, MAX_ITEMS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  },

  remove(id: string): void {
    try {
      const current = this.list();
      const updated = current.filter((c) => c.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  },

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
};

import { beforeEach, describe, expect, it } from 'vitest';
import { recentConversationsStore } from './recent-conversations-store';

describe('recentConversationsStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty array when storage is empty', () => {
    expect(recentConversationsStore.list()).toEqual([]);
  });

  it('adds and prepends recent conversations without duplicating', () => {
    recentConversationsStore.addOrUpdate({
      id: 'c1',
      title: 'First chat',
      documentIds: ['d1'],
      updatedAt: '2026-09-20',
    });
    recentConversationsStore.addOrUpdate({
      id: 'c2',
      title: 'Second chat',
      documentIds: ['d2'],
      updatedAt: '2026-09-21',
    });

    const list = recentConversationsStore.list();
    expect(list.length).toBe(2);
    expect(list[0]?.id).toBe('c2');
    expect(list[1]?.id).toBe('c1');

    // Updating c1 moves it to the top
    recentConversationsStore.addOrUpdate({
      id: 'c1',
      title: 'Updated first chat',
      documentIds: ['d1'],
      updatedAt: '2026-09-22',
    });

    const updatedList = recentConversationsStore.list();
    expect(updatedList.length).toBe(2);
    expect(updatedList[0]?.id).toBe('c1');
    expect(updatedList[0]?.title).toBe('Updated first chat');
  });

  it('removes conversation by id', () => {
    recentConversationsStore.addOrUpdate({
      id: 'c1',
      title: 'First chat',
      documentIds: [],
      updatedAt: '2026-09-20',
    });
    recentConversationsStore.remove('c1');
    expect(recentConversationsStore.list()).toEqual([]);
  });
});

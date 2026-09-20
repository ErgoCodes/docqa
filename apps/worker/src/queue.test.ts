import { describe, expect, it, vi } from 'vitest';
import type { Job } from 'bullmq';
import { processor } from './queue.js';

describe('processor', () => {
  it('resolves for a placeholder job without touching Redis', async () => {
    const fakeJob = {
      id: 'job-1',
      log: vi.fn().mockResolvedValue(1),
    } as unknown as Job;

    await expect(processor(fakeJob)).resolves.toBeUndefined();
    expect(fakeJob.log).toHaveBeenCalledOnce();
  });
});

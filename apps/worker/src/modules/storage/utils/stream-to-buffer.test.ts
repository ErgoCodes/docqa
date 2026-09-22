import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { streamToBuffer } from './stream-to-buffer.js';

describe('streamToBuffer', () => {
  it('concatenates multiple Buffer chunks into a single buffer', async () => {
    const stream = Readable.from([
      Buffer.from('Hello '),
      Buffer.from('World!'),
    ]);

    const result = await streamToBuffer(stream);

    expect(result).toEqual(Buffer.from('Hello World!'));
    expect(result.toString('utf-8')).toBe('Hello World!');
  });

  it('handles Uint8Array and string chunks', async () => {
    const uint8Chunk = new Uint8Array([102, 111, 111]); // 'foo'
    const stream = Readable.from([uint8Chunk, 'bar', [98, 97, 122]]); // 'baz'

    const result = await streamToBuffer(stream);

    expect(result.toString('utf-8')).toBe('foobarbaz');
  });

  it('rejects when the stream emits an error', async () => {
    const stream = new Readable({
      read() {
        this.push(Buffer.from('some data'));
        this.destroy(new Error('stream read failure'));
      },
    });

    await expect(streamToBuffer(stream)).rejects.toThrow('stream read failure');
  });
});

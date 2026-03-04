/**
 * Utility for draining a Mastra fullStream and routing chunk events to typed callbacks.
 *
 * Use this instead of consuming `textStream` directly. `textStream` only surfaces
 * text-delta events; `fullStream` carries the complete event graph including
 * tool-call, tool-result, reasoning-delta, and finish events.
 *
 * IMPORTANT: fullStream (and textStream) MUST be consumed concurrently with
 * `output.object` using Promise.all — never sequentially — or the ReadableStream
 * backpressure will stall the agent and output.object will never resolve.
 */

/** Subset of chunk types we care about for display routing. */
export interface DrainableChunk {
  type: string;
  payload: unknown;
}

/** Callbacks for the different event categories in fullStream. */
export interface DrainFullStreamOptions {
  /**
   * Called with each text or reasoning delta from the LLM.
   * Receives the raw string content only (payload.text).
   */
  onThought?: (delta: string) => void;
  /**
   * Called for every chunk in the stream, regardless of type.
   * Use this to observe tool-call, tool-result, finish, or any other event.
   */
  onEvent?: (chunk: DrainableChunk) => void;
}

/**
 * Drains a Mastra `fullStream` (ReadableStream of ChunkType), routing events
 * to the supplied callbacks.
 *
 * - `text-delta` and `reasoning-delta` → forwarded as text to `onThought`
 * - every chunk → forwarded to `onEvent`
 *
 * Always resolves when the stream closes, regardless of which callbacks are set.
 * Must be awaited concurrently with `output.object` (via Promise.all) to avoid
 * backpressure deadlock.
 *
 * @param stream - The fullStream from MastraModelOutput.
 * @param opts - Routing callbacks.
 */
export async function drainFullStream(
  stream: ReadableStream<DrainableChunk>,
  opts: DrainFullStreamOptions = {},
): Promise<void> {
  const { onThought, onEvent } = opts;
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Route text and reasoning deltas to onThought
      if ((value.type === 'text-delta' || value.type === 'reasoning-delta') && onThought) {
        const p = value.payload as { text?: string };
        if (typeof p.text === 'string') onThought(p.text);
      }

      // Forward every event to onEvent
      onEvent?.(value);
    }
  } finally {
    reader.releaseLock();
  }
}

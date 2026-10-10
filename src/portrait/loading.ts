/** A resumable queue: disabled motion pauses new decodes, failures don't block other assets. */
export function createDecodeQueue<T>(items: readonly T[], decode: (item: T) => Promise<void>, enabled: () => boolean, concurrency = 3) {
  const pending = [...items];
  let running: Promise<void> | undefined;
  return {
    start(): Promise<void> {
      if (running) return running;
      running = (async () => {
        while (pending.length && enabled()) {
          const batch = pending.splice(0, Math.max(1, concurrency));
          await Promise.allSettled(batch.map(decode));
        }
      })().finally(() => { running = undefined; });
      return running;
    },
  };
}

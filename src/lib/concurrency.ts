export async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput, index: number) => Promise<TOutput>
) {
  if (items.length === 0) {
    return [] as TOutput[];
  }

  const results = new Array<TOutput>(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const nextIndex = currentIndex;
      currentIndex += 1;
      results[nextIndex] = await mapper(items[nextIndex], nextIndex);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );

  await Promise.all(workers);

  return results;
}

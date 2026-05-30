export async function chunk<T, R>(
  items: T[],
  size: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  const safeSize = Math.max(1, size);

  for (let i = 0; i < items.length; i += safeSize) {
    const batch = items.slice(i, i + safeSize);
    const mapped = await Promise.all(
      batch.map((item, batchIndex) => mapper(item, i + batchIndex)),
    );
    results.push(...mapped);
  }

  return results;
}

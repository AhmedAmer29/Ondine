/**
 * Returns the index of the first element in `sortedValues` (ascending, via `keyOf`)
 * whose key is >= `target`. If none qualify, returns `sortedValues.length`.
 */
export function lowerBound<T>(sortedValues: readonly T[], target: number, keyOf: (item: T) => number): number {
  let low = 0;
  let high = sortedValues.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    const item = sortedValues[mid] as T;
    if (keyOf(item) < target) low = mid + 1;
    else high = mid;
  }
  return low;
}

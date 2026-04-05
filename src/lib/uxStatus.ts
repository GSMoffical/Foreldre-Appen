export function buildDailyStatusText(unresolvedCollisionCount: number, remainingCount: number): string {
  if (unresolvedCollisionCount > 0) {
    return `${unresolvedCollisionCount} ${unresolvedCollisionCount === 1 ? 'kollisjon' : 'kollisjoner'} må avklares`
  }
  if (remainingCount > 0) {
    return `${remainingCount} ting igjen i dag`
  }
  return 'Alt klart'
}

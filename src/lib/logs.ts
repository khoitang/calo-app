import type { Food, LogEntry, Nutrition } from '../types'
import { nutritionFor, sumNutrition } from './calc'

export function entriesForDate(logs: LogEntry[], date: string): LogEntry[] {
  return logs.filter((l) => l.date === date).sort((a, b) => a.at - b.at)
}

export function foodMap(foods: Food[]): Map<string, Food> {
  return new Map(foods.map((f) => [f.id, f]))
}

export function dayTotals(entries: LogEntry[], foods: Map<string, Food>): Nutrition {
  return sumNutrition(entries.map((e) => nutritionFor(foods.get(e.foodId), e.grams)))
}

/** Danh sách món vừa ăn, mới nhất trước */
export function recentFoodIds(logs: LogEntry[], limit = 8): string[] {
  const seen = new Set<string>()
  const sorted = [...logs].sort((a, b) => b.at - a.at)
  for (const entry of sorted) {
    if (seen.size >= limit) break
    seen.add(entry.foodId)
  }
  return [...seen]
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

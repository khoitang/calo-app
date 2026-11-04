import type { Meal } from '../types'

export const MEALS: { id: Meal; label: string; short: string; icon: string }[] = [
  { id: 'breakfast', label: 'Bữa sáng', short: 'Sáng', icon: '🌅' },
  { id: 'lunch', label: 'Bữa trưa', short: 'Trưa', icon: '☀️' },
  { id: 'dinner', label: 'Bữa tối', short: 'Tối', icon: '🌙' },
  { id: 'snack', label: 'Ăn vặt', short: 'Vặt', icon: '🍪' },
]

export function mealLabel(id: Meal): string {
  return MEALS.find((m) => m.id === id)?.label ?? id
}

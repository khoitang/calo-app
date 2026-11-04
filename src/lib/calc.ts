import type { ActivityLevel, Food, Goal, Nutrition, Profile } from '../types'

export const ACTIVITY_LEVELS: {
  id: ActivityLevel
  label: string
  hint: string
  factor: number
}[] = [
  {
    id: 'sedentary',
    label: 'Ít vận động',
    hint: 'Ngồi nhiều, hầu như không tập',
    factor: 1.2,
  },
  {
    id: 'light',
    label: 'Vận động nhẹ',
    hint: 'Tập 1–3 buổi/tuần',
    factor: 1.375,
  },
  {
    id: 'moderate',
    label: 'Vừa phải',
    hint: 'Tập 3–5 buổi/tuần',
    factor: 1.55,
  },
  {
    id: 'active',
    label: 'Năng động',
    hint: 'Tập 6–7 buổi/tuần',
    factor: 1.725,
  },
  {
    id: 'veryActive',
    label: 'Rất năng động',
    hint: 'Lao động nặng hoặc tập 2 lần/ngày',
    factor: 1.9,
  },
]

export const GOALS: { id: Goal; label: string }[] = [
  { id: 'lose', label: 'Giảm cân' },
  { id: 'maintain', label: 'Duy trì' },
  { id: 'gain', label: 'Tăng cân' },
]

export const round = (n: number): number => Math.round(n)

/** Mifflin–St Jeor */
export function bmr(p: Pick<Profile, 'sex' | 'weightKg' | 'heightCm' | 'age'>): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age
  return p.sex === 'male' ? base + 5 : base - 161
}

export function activityFactor(level: ActivityLevel): number {
  return ACTIVITY_LEVELS.find((a) => a.id === level)?.factor ?? 1.2
}

export function tdee(p: Profile): number {
  return bmr(p) * activityFactor(p.activity)
}

/** Calo mục tiêu mỗi ngày, đã làm tròn về bội số 10 */
export function calorieTarget(p: Profile): number {
  const base = tdee(p)
  const delta = p.goal === 'maintain' ? 0 : p.goal === 'lose' ? -p.delta : p.delta
  return Math.max(1000, Math.round((base + delta) / 10) * 10)
}

export function macroTargets(p: Profile): Nutrition {
  const kcal = calorieTarget(p)
  const protein = Math.max(0, p.proteinPerKg * p.weightKg)
  const fat = (kcal * 0.25) / 9
  const carb = Math.max(0, (kcal - protein * 4 - fat * 9) / 4)
  return { kcal, protein, carb, fat }
}

export function nutritionFor(food: Food | undefined, grams: number): Nutrition {
  if (!food) return { kcal: 0, protein: 0, carb: 0, fat: 0 }
  const k = grams / 100
  return {
    kcal: food.kcal * k,
    protein: food.protein * k,
    carb: food.carb * k,
    fat: food.fat * k,
  }
}

export function sumNutrition(list: Nutrition[]): Nutrition {
  return list.reduce(
    (acc, n) => ({
      kcal: acc.kcal + n.kcal,
      protein: acc.protein + n.protein,
      carb: acc.carb + n.carb,
      fat: acc.fat + n.fat,
    }),
    { kcal: 0, protein: 0, carb: 0, fat: 0 },
  )
}

export function formatKcal(n: number): string {
  return String(Math.round(n))
}

export function formatGram(n: number): string {
  return n >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10)
}

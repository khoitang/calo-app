export type Sex = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive'
export type Goal = 'lose' | 'maintain' | 'gain'
export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type FoodCategory =
  | 'Món Việt'
  | 'Đạm'
  | 'Rau củ'
  | 'Trái cây'
  | 'Đồ uống'
  | 'Ăn vặt'

export interface Profile {
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  activity: ActivityLevel
  goal: Goal
  /** Mức thâm hụt / thặng dư calo mỗi ngày (kcal) */
  delta: number
  /** Gram protein trên mỗi kg cân nặng */
  proteinPerKg: number
}

export interface Food {
  id: string
  name: string
  category: FoodCategory
  /** Giá trị trên 100 gram */
  kcal: number
  protein: number
  carb: number
  fat: number
  servingGrams: number
  servingLabel: string
  custom?: boolean
}

export interface LogEntry {
  id: string
  date: string // YYYY-MM-DD
  meal: Meal
  foodId: string
  grams: number
  /** Dùng để sắp xếp món gần đây */
  at: number
}

export interface DB {
  profile: Profile | null
  foods: Food[]
  logs: LogEntry[]
}

export type UserRole = 'user' | 'admin'

export interface User {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  hasPassword: boolean
  hasGoogle: boolean
  role: UserRole
  createdAt: number | null
}

export type SyncState = 'loading' | 'saving' | 'saved' | 'offline'

export interface Nutrition {
  kcal: number
  protein: number
  carb: number
  fat: number
}

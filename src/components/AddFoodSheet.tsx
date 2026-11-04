import { useMemo, useState } from 'react'
import type { Food, FoodCategory, Meal } from '../types'
import { FOOD_CATEGORIES } from '../data/seedFoods'
import { formatGram, nutritionFor } from '../lib/calc'
import { recentFoodIds } from '../lib/logs'
import { mealLabel } from '../lib/meals'
import { useStore } from '../lib/store'
import { Icon } from './Icon'
import { NumberInput } from './NumberInput'
import { Sheet } from './Sheet'

interface Props {
  date: string
  meal: Meal
  onClose: () => void
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
}

function servingKcal(food: Food): number {
  return (food.kcal * food.servingGrams) / 100
}

export function AddFoodSheet({ date, meal, onClose }: Props) {
  const { db, addLog } = useStore()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'all' | FoodCategory>('all')
  const [selected, setSelected] = useState<Food | null>(null)

  const foodsById = useMemo(() => new Map(db.foods.map((f) => [f.id, f])), [db.foods])

  const recent = useMemo(
    () =>
      recentFoodIds(db.logs)
        .map((id) => foodsById.get(id))
        .filter((f): f is Food => Boolean(f)),
    [db.logs, foodsById],
  )

  const results = useMemo(() => {
    const q = normalize(query.trim())
    return db.foods.filter((f) => {
      if (category !== 'all' && f.category !== category) return false
      if (!q) return true
      return normalize(f.name).includes(q) || normalize(f.category).includes(q)
    })
  }, [db.foods, query, category])

  const add = (food: Food, grams: number) => {
    addLog({ date, meal, foodId: food.id, grams })
    onClose()
  }

  if (selected) {
    return (
      <PortionSheet
        food={selected}
        meal={meal}
        onBack={() => setSelected(null)}
        onClose={onClose}
        onAdd={(grams) => add(selected, grams)}
      />
    )
  }

  return (
    <Sheet
      title="Thêm món"
      subtitle={mealLabel(meal)}
      onClose={onClose}
    >
      <div className="search-box">
        <Icon name="search" size={18} />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm món ăn..."
          aria-label="Tìm món ăn"
        />
        {query && (
          <button className="icon-btn tiny" onClick={() => setQuery('')} aria-label="Xoá tìm kiếm">
            <Icon name="x" size={16} />
          </button>
        )}
      </div>

      <div className="chips scroll-x">
        <button
          className={`chip ${category === 'all' ? 'active' : ''}`}
          onClick={() => setCategory('all')}
        >
          Tất cả
        </button>
        {FOOD_CATEGORIES.map((c) => (
          <button
            key={c}
            className={`chip ${category === c ? 'active' : ''}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {!query && category === 'all' && recent.length > 0 && (
        <>
          <p className="section-label">Món gần đây</p>
          <div className="food-list">
            {recent.map((food) => (
              <FoodRow key={`recent-${food.id}`} food={food} onClick={() => setSelected(food)} />
            ))}
          </div>
          <p className="section-label">Tất cả món</p>
        </>
      )}

      <div className="food-list">
        {results.map((food) => (
          <FoodRow key={food.id} food={food} onClick={() => setSelected(food)} />
        ))}
      </div>

      {results.length === 0 && (
        <p className="empty">
          Không tìm thấy món phù hợp. Bạn có thể tự thêm món trong tab Thư viện.
        </p>
      )}

      <p className="hint">
        Số liệu mang tính tham khảo. Món nấu tại nhà nên cân nguyên liệu để chính xác hơn.
      </p>
    </Sheet>
  )
}

function FoodRow({ food, onClick }: { food: Food; onClick: () => void }) {
  return (
    <button className="food-row" onClick={onClick}>
      <div className="food-row-main">
        <span className="food-name">{food.name}</span>
        <span className="food-meta">
          {food.servingLabel} · {formatGram(food.servingGrams)}g
        </span>
      </div>
      <div className="food-row-side">
        <strong>{Math.round(servingKcal(food))}</strong>
        <span>kcal</span>
      </div>
    </button>
  )
}

function PortionSheet({
  food,
  meal,
  onBack,
  onClose,
  onAdd,
}: {
  food: Food
  meal: Meal
  onBack: () => void
  onClose: () => void
  onAdd: (grams: number) => void
}) {
  const [grams, setGrams] = useState(food.servingGrams)
  const nutrition = nutritionFor(food, grams)
  const presets = [0.5, 1, 1.5, 2]
  const perServing = servingKcal(food)
  const ratio = grams / food.servingGrams

  return (
    <Sheet
      title={food.name}
      subtitle={`${food.kcal} kcal / 100g · ${food.category}`}
      onClose={onClose}
    >
      <button className="back-link" onClick={onBack}>
        <Icon name="left" size={16} /> Chọn món khác
      </button>

      <div className="portion-hero">
        <span className="portion-kcal">{Math.round(nutrition.kcal)}</span>
        <span className="portion-unit">kcal</span>
        <span className="portion-sub">
          {ratio === 1
            ? `= 1 ${food.servingLabel}`
            : `≈ ${ratio.toFixed(2).replace(/\.?0+$/, '')} ${food.servingLabel} (${formatGram(grams)}g)`}
        </span>
      </div>

      <div className="portion-presets">
        {presets.map((p) => {
          const g = Math.round(food.servingGrams * p)
          return (
            <button
              key={p}
              className={`chip ${Math.round(grams) === g ? 'active' : ''}`}
              onClick={() => setGrams(g)}
            >
              {p === 0.5 ? '½' : p === 1.5 ? '1½' : String(p)} {food.servingLabel}
            </button>
          )
        })}
      </div>

      <label className="field">
        <span>Khối lượng</span>
        <NumberInput
          value={grams}
          onChange={setGrams}
          suffix="gram"
          min={1}
          max={3000}
          ariaLabel="Khối lượng (gram)"
        />
      </label>

      <div className="macro-grid">
        <MacroBox label="Đạm" value={nutrition.protein} tone="protein" />
        <MacroBox label="Tinh bột" value={nutrition.carb} tone="carb" />
        <MacroBox label="Chất béo" value={nutrition.fat} tone="fat" />
      </div>

      <p className="hint">
        1 {food.servingLabel} ≈ {formatGram(food.servingGrams)}g · {Math.round(perServing)} kcal
      </p>

      <button className="btn primary block" onClick={() => onAdd(grams)}>
        Thêm vào {mealLabel(meal).toLowerCase()}
      </button>
    </Sheet>
  )
}

function MacroBox({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`macro-box tone-${tone}`}>
      <span className="macro-value">{Math.round(value * 10) / 10}g</span>
      <span className="macro-label">{label}</span>
    </div>
  )
}

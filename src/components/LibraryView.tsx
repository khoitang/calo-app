import { useMemo, useState } from 'react'
import type { Food, FoodCategory } from '../types'
import { FOOD_CATEGORIES } from '../data/seedFoods'
import { useStore } from '../lib/store'
import { FoodFormSheet } from './FoodFormSheet'
import { Icon } from './Icon'

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
}

export function LibraryView() {
  const { db } = useStore()
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Food | null>(null)

  const groups = useMemo(() => {
    const q = normalize(query.trim())
    const filtered = db.foods.filter((f) => !q || normalize(f.name).includes(q))
    return FOOD_CATEGORIES.map((category) => ({
      category,
      foods: filtered
        .filter((f) => f.category === category)
        .sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    })).filter((g) => g.foods.length > 0)
  }, [db.foods, query])

  const customCount = db.foods.filter((f) => f.custom).length

  return (
    <div className="library-view">
      <div className="page-head">
        <div>
          <h1>Thư viện món</h1>
          <p>
            {db.foods.length} món · {customCount} món của bạn
          </p>
        </div>
        <button className="btn primary small" onClick={() => setAdding(true)}>
          <Icon name="plus" size={16} /> Thêm món
        </button>
      </div>

      <div className="search-box">
        <Icon name="search" size={18} />
        <input
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

      {groups.length === 0 && (
        <p className="empty">
          Không tìm thấy món nào. Thêm món mới với số liệu trên bao bì hoặc công thức của bạn.
        </p>
      )}

      {groups.map((group) => (
        <section key={group.category} className="library-group">
          <h2 className="section-label">{group.category}</h2>
          <div className="card list-card">
            {group.foods.map((food) => {
              const row = (
                <>
                  <span className="food-row-main">
                    <span className="food-name">{food.name}</span>
                    <span className="food-meta">
                      {food.servingLabel} · {Math.round((food.kcal * food.servingGrams) / 100)} kcal
                      <span className="dot-sep">·</span>
                      {food.kcal} kcal/100g
                    </span>
                  </span>
                  {food.custom ? (
                    <span className="edit-badge">
                      <Icon name="edit" size={16} />
                    </span>
                  ) : (
                    <span className="seed-badge">có sẵn</span>
                  )}
                </>
              )
              return food.custom ? (
                <button className="food-row" key={food.id} onClick={() => setEditing(food)}>
                  {row}
                </button>
              ) : (
                <div className="food-row static" key={food.id}>
                  {row}
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <p className="hint">
        Món có sẵn lấy số liệu tham khảo và không sửa được. Bấm vào món của bạn để chỉnh sửa hoặc xoá.
        Để thêm món vào bữa ăn, dùng nút “+” trong tab Hôm nay.
      </p>

      {adding && <FoodFormSheet onClose={() => setAdding(false)} />}
      {editing && <FoodFormSheet initial={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

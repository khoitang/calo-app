import { useState } from 'react'
import type { Food, FoodCategory } from '../types'
import { FOOD_CATEGORIES } from '../data/seedFoods'
import { uid } from '../lib/logs'
import { useStore } from '../lib/store'
import { NumberInput } from './NumberInput'
import { Sheet } from './Sheet'

export function FoodFormSheet({
  initial,
  onClose,
}: {
  initial?: Food
  onClose: () => void
}) {
  const { upsertFood, deleteFood } = useStore()
  const [name, setName] = useState(initial?.name ?? '')
  const [category, setCategory] = useState<FoodCategory>(initial?.category ?? 'Món Việt')
  const [kcal, setKcal] = useState(initial?.kcal ?? 0)
  const [protein, setProtein] = useState(initial?.protein ?? 0)
  const [carb, setCarb] = useState(initial?.carb ?? 0)
  const [fat, setFat] = useState(initial?.fat ?? 0)
  const [servingLabel, setServingLabel] = useState(initial?.servingLabel ?? '1 phần')
  const [servingGrams, setServingGrams] = useState(initial?.servingGrams ?? 100)

  const canSave = name.trim().length > 0 && kcal >= 0 && servingGrams > 0

  const save = () => {
    if (!canSave) return
    upsertFood({
      id: initial?.id ?? `custom-${uid()}`,
      name: name.trim(),
      category,
      kcal,
      protein,
      carb,
      fat,
      servingGrams,
      servingLabel: servingLabel.trim() || '1 phần',
      custom: true,
    })
    onClose()
  }

  return (
    <Sheet
      title={initial ? 'Sửa món' : 'Thêm món của bạn'}
      subtitle="Nhập giá trị trên 100g. Có thể lấy từ bao bì hoặc bảng dinh dưỡng."
      onClose={onClose}
    >
      <label className="field">
        <span>Tên món</span>
        <input
          className="text-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="VD: Cơm gà xối mỡ"
          autoFocus
        />
      </label>

      <label className="field">
        <span>Nhóm</span>
        <select
          className="text-input"
          value={category}
          onChange={(e) => setCategory(e.target.value as FoodCategory)}
        >
          {FOOD_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <div className="field">
        <span>Dinh dưỡng / 100g</span>
        <div className="grid-2">
          <label className="mini-field">
            <NumberInput value={kcal} onChange={setKcal} suffix="kcal" min={0} max={1000} ariaLabel="Calo trên 100g" />
          </label>
          <label className="mini-field">
            <NumberInput value={protein} onChange={setProtein} suffix="đạm" min={0} max={100} ariaLabel="Đạm trên 100g" />
          </label>
          <label className="mini-field">
            <NumberInput value={carb} onChange={setCarb} suffix="carb" min={0} max={100} ariaLabel="Tinh bột trên 100g" />
          </label>
          <label className="mini-field">
            <NumberInput value={fat} onChange={setFat} suffix="béo" min={0} max={100} ariaLabel="Chất béo trên 100g" />
          </label>
        </div>
      </div>

      <div className="field">
        <span>Một phần ăn</span>
        <div className="grid-2">
          <label className="mini-field">
            <input
              className="text-input"
              value={servingLabel}
              onChange={(e) => setServingLabel(e.target.value)}
              placeholder="1 bát"
              aria-label="Tên phần ăn"
            />
          </label>
          <label className="mini-field">
            <NumberInput
              value={servingGrams}
              onChange={setServingGrams}
              suffix="gram"
              min={1}
              max={3000}
              ariaLabel="Gram mỗi phần"
            />
          </label>
        </div>
      </div>

      <button className="btn primary block" disabled={!canSave} onClick={save}>
        {initial ? 'Lưu thay đổi' : 'Thêm vào thư viện'}
      </button>

      {initial && (
        <button
          className="btn ghost danger block"
          onClick={() => {
            if (window.confirm(`Xoá "${initial.name}" và toàn bộ nhật ký liên quan?`)) {
              deleteFood(initial.id)
              onClose()
            }
          }}
        >
          Xoá món này
        </button>
      )}
    </Sheet>
  )
}

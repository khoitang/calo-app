import { useState } from 'react'
import type { Food, LogEntry } from '../types'
import { formatGram, nutritionFor } from '../lib/calc'
import { useStore } from '../lib/store'
import { Icon } from './Icon'
import { NumberInput } from './NumberInput'
import { Sheet } from './Sheet'

export function EditEntrySheet({
  entry,
  food,
  onClose,
}: {
  entry: LogEntry
  food: Food
  onClose: () => void
}) {
  const { updateLog, deleteLog } = useStore()
  const [grams, setGrams] = useState(entry.grams)
  const nutrition = nutritionFor(food, grams)

  return (
    <Sheet
      title={food.name}
      subtitle={`${food.kcal} kcal / 100g`}
      onClose={onClose}
    >
      <div className="portion-hero">
        <span className="portion-kcal">{Math.round(nutrition.kcal)}</span>
        <span className="portion-unit">kcal</span>
        <span className="portion-sub">
          {formatGram(grams)}g · 1 {food.servingLabel} ≈ {formatGram(food.servingGrams)}g
        </span>
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

      <div className="row-2">
        <button
          className="btn primary"
          onClick={() => {
            updateLog(entry.id, grams)
            onClose()
          }}
        >
          Lưu
        </button>
        <button
          className="btn ghost danger"
          onClick={() => {
            if (window.confirm(`Xoá ${food.name} khỏi bữa ăn?`)) {
              deleteLog(entry.id)
              onClose()
            }
          }}
        >
          <Icon name="trash" size={18} /> Xoá
        </button>
      </div>
    </Sheet>
  )
}

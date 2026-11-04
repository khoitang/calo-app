import { useMemo, useState } from 'react'
import type { Meal } from '../types'
import { calorieTarget, formatGram, macroTargets, nutritionFor, round } from '../lib/calc'
import { addDays, dayLabel, isFuture, relativeDayLabel, todayKey } from '../lib/date'
import { dayTotals, entriesForDate, foodMap } from '../lib/logs'
import { MEALS } from '../lib/meals'
import { useStore } from '../lib/store'
import { AddFoodSheet } from './AddFoodSheet'
import { EditEntrySheet } from './EditEntrySheet'
import { Icon } from './Icon'

export function TodayView({
  date,
  onDateChange,
}: {
  date: string
  onDateChange: (date: string) => void
}) {
  const { db, copyDay } = useStore()
  const [addMeal, setAddMeal] = useState<Meal | null>(null)
  const [editId, setEditId] = useState<string | null>(null)

  const profile = db.profile
  const foods = useMemo(() => foodMap(db.foods), [db.foods])
  const entries = useMemo(() => entriesForDate(db.logs, date), [db.logs, date])
  const totals = useMemo(() => dayTotals(entries, foods), [entries, foods])

  if (!profile) return null

  const target = calorieTarget(profile)
  const macro = macroTargets(profile)
  const remaining = target - totals.kcal
  const prevDate = addDays(date, -1)
  const prevEntries = entriesForDate(db.logs, prevDate)
  const editingEntry = entries.find((e) => e.id === editId) ?? null
  const today = todayKey()

  const copyPrevious = () => {
    if (prevEntries.length === 0) return
    if (entries.length > 0 && !window.confirm('Bữa ăn hiện tại sẽ được giữ nguyên và thêm bản sao từ hôm qua. Tiếp tục?')) {
      return
    }
    copyDay(prevDate, date)
  }

  return (
    <div className="day-view">
      <div className="date-nav">
        <button
          className="icon-btn"
          onClick={() => onDateChange(addDays(date, -1))}
          aria-label="Ngày trước"
        >
          <Icon name="left" size={20} />
        </button>
        <div className="date-center">
          <strong>{relativeDayLabel(date)}</strong>
          {relativeDayLabel(date) !== dayLabel(date) && (
            <span>{dayLabel(date)}</span>
          )}
        </div>
        <button
          className="icon-btn"
          onClick={() => onDateChange(addDays(date, 1))}
          aria-label="Ngày sau"
          disabled={isFuture(addDays(date, 1))}
        >
          <Icon name="right" size={20} />
        </button>
        {date !== today && (
          <button className="today-pill" onClick={() => onDateChange(today)}>
            Hôm nay
          </button>
        )}
      </div>

      <section className="card summary-card">
        <div className="ring">
          <CalorieRing eaten={totals.kcal} target={target} />
          <div className="ring-center">
            <strong className={remaining < 0 ? 'bad' : ''}>
              {round(Math.abs(remaining))}
            </strong>
            <span>{remaining < 0 ? 'kcal vượt' : 'kcal còn lại'}</span>
          </div>
        </div>
        <div className="summary-stats">
          <div>
            <span>Mục tiêu</span>
            <strong>{target}</strong>
            <small>kcal</small>
          </div>
          <div>
            <span>Đã ăn</span>
            <strong>{round(totals.kcal)}</strong>
            <small>kcal</small>
          </div>
          <div>
            <span>Protein</span>
            <strong>{round(totals.protein)}</strong>
            <small>/ {round(macro.protein)}g</small>
          </div>
        </div>
      </section>

      <section className="card macro-card">
        <MacroBar
          label="Đạm"
          value={totals.protein}
          target={macro.protein}
          tone="protein"
        />
        <MacroBar label="Tinh bột" value={totals.carb} target={macro.carb} tone="carb" />
        <MacroBar label="Chất béo" value={totals.fat} target={macro.fat} tone="fat" />
      </section>

      <div className="section-head">
        <h2>Bữa ăn</h2>
        {prevEntries.length > 0 && (
          <button className="link-btn" onClick={copyPrevious}>
            Chép bữa hôm qua
          </button>
        )}
      </div>

      {MEALS.map((meal) => {
        const mealEntries = entries.filter((e) => e.meal === meal.id)
        const mealKcal = mealEntries.reduce(
          (sum, e) => sum + nutritionFor(foods.get(e.foodId), e.grams).kcal,
          0,
        )
        return (
          <section className="card meal-card" key={meal.id}>
            <div className="meal-head">
              <span className="meal-icon">{meal.icon}</span>
              <div className="meal-title">
                <h3>{meal.label}</h3>
                <span>{mealEntries.length > 0 ? `${round(mealKcal)} kcal` : 'Chưa có món nào'}</span>
              </div>
              <button
                className="add-btn"
                onClick={() => setAddMeal(meal.id)}
                aria-label={`Thêm món cho ${meal.label.toLowerCase()}`}
              >
                <Icon name="plus" size={18} />
              </button>
            </div>

            {mealEntries.length === 0 ? (
              <button className="meal-empty" onClick={() => setAddMeal(meal.id)}>
                + Thêm món
              </button>
            ) : (
              <div className="entry-list">
                {mealEntries.map((entry) => {
                  const food = foods.get(entry.foodId)
                  const n = nutritionFor(food, entry.grams)
                  return (
                    <button
                      className="entry"
                      key={entry.id}
                      onClick={() => setEditId(entry.id)}
                    >
                      <span className="entry-main">
                        <span className="entry-name">{food?.name ?? 'Món đã xoá'}</span>
                        <span className="entry-meta">{formatGram(entry.grams)}g</span>
                      </span>
                      <span className="entry-kcal">{round(n.kcal)}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}

      <p className="day-footnote">
        {entries.length === 0
          ? 'Hôm nay chưa có món nào. Thêm bữa đầu tiên để bắt đầu theo dõi.'
          : `Đã ghi ${entries.length} món · ${round(totals.kcal)} kcal`}
      </p>

      {addMeal && (
        <AddFoodSheet date={date} meal={addMeal} onClose={() => setAddMeal(null)} />
      )}
      {editingEntry && foods.get(editingEntry.foodId) && (
        <EditEntrySheet
          entry={editingEntry}
          food={foods.get(editingEntry.foodId)!}
          onClose={() => setEditId(null)}
        />
      )}
    </div>
  )
}

function CalorieRing({ eaten, target }: { eaten: number; target: number }) {
  const size = 136
  const stroke = 13
  const r = (size - stroke) / 2 - 1
  const c = 2 * Math.PI * r
  const ratio = target > 0 ? Math.min(eaten / target, 1) : 0
  const over = eaten > target

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <defs>
        <linearGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
        <linearGradient id="ringOver" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#dc2626" />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#e7ede8"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={over ? 'url(#ringOver)' : 'url(#ringGradient)'}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - ratio)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="ring-progress"
      />
    </svg>
  )
}

function MacroBar({
  label,
  value,
  target,
  tone,
}: {
  label: string
  value: number
  target: number
  tone: string
}) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0
  return (
    <div className="macro-bar">
      <div className="macro-bar-top">
        <span>{label}</span>
        <span className="macro-bar-num">
          <strong>{round(value)}</strong> / {round(target)}g
        </span>
      </div>
      <div className="track">
        <div className={`fill tone-${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

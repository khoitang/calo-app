import { useState, type ReactNode } from 'react'
import type { Goal, Profile, Sex } from '../types'
import {
  ACTIVITY_LEVELS,
  bmr,
  calorieTarget,
  macroTargets,
  round,
  tdee,
} from '../lib/calc'
import { NumberInput } from './NumberInput'

export const DEFAULT_PROFILE: Profile = {
  sex: 'male',
  age: 28,
  heightCm: 170,
  weightKg: 65,
  activity: 'light',
  goal: 'lose',
  delta: 400,
  proteinPerKg: 1.6,
}

interface Props {
  initial?: Profile | null
  submitLabel: string
  onSubmit: (profile: Profile) => void
  extra?: ReactNode
}

export function ProfileForm({ initial, submitLabel, onSubmit, extra }: Props) {
  const [p, setP] = useState<Profile>(initial ?? DEFAULT_PROFILE)
  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setP((prev) => ({ ...prev, [key]: value }))

  const valid = p.age >= 10 && p.age <= 100 && p.heightCm >= 100 && p.weightKg >= 25
  const target = calorieTarget(p)
  const macros = macroTargets(p)
  const deltaLabel = p.goal === 'lose' ? 'Thâm hụt mỗi ngày' : 'Thặng dư mỗi ngày'

  return (
    <form
      className="profile-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) onSubmit(p)
      }}
    >
      <section className="card form-card">
        <h2 className="card-title">Thông tin cơ bản</h2>

        <div className="field">
          <span>Giới tính</span>
          <div className="segment">
            {(
              [
                ['male', 'Nam'],
                ['female', 'Nữ'],
              ] as [Sex, string][]
            ).map(([id, label]) => (
              <button
                type="button"
                key={id}
                className={p.sex === id ? 'active' : ''}
                onClick={() => set('sex', id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid-3">
          <label className="field">
            <span>Tuổi</span>
            <NumberInput value={p.age} onChange={(v) => set('age', v)} suffix="tuổi" min={10} max={100} ariaLabel="Tuổi" />
          </label>
          <label className="field">
            <span>Chiều cao</span>
            <NumberInput value={p.heightCm} onChange={(v) => set('heightCm', v)} suffix="cm" min={100} max={230} ariaLabel="Chiều cao" />
          </label>
          <label className="field">
            <span>Cân nặng</span>
            <NumberInput value={p.weightKg} onChange={(v) => set('weightKg', v)} suffix="kg" min={25} max={250} ariaLabel="Cân nặng" />
          </label>
        </div>
      </section>

      <section className="card form-card">
        <h2 className="card-title">Mức vận động</h2>
        <div className="activity-list">
          {ACTIVITY_LEVELS.map((a) => (
            <button
              type="button"
              key={a.id}
              className={`activity ${p.activity === a.id ? 'active' : ''}`}
              onClick={() => set('activity', a.id)}
            >
              <span className="activity-main">
                <span className="activity-label">{a.label}</span>
                <span className="activity-hint">{a.hint}</span>
              </span>
              <span className="radio-dot" />
            </button>
          ))}
        </div>
      </section>

      <section className="card form-card">
        <h2 className="card-title">Mục tiêu</h2>
        <div className="segment">
          {(
            [
              ['lose', 'Giảm cân'],
              ['maintain', 'Duy trì'],
              ['gain', 'Tăng cân'],
            ] as [Goal, string][]
          ).map(([id, label]) => (
            <button
              type="button"
              key={id}
              className={p.goal === id ? 'active' : ''}
              onClick={() => set('goal', id)}
            >
              {label}
            </button>
          ))}
        </div>

        {p.goal !== 'maintain' && (
          <div className="field spaced">
            <span>{deltaLabel}</span>
            <NumberInput value={p.delta} onChange={(v) => set('delta', v)} suffix="kcal" min={100} max={1000} ariaLabel={deltaLabel} />
            <div className="chips">
              {[200, 300, 400, 500].map((d) => (
                <button
                  type="button"
                  key={d}
                  className={`chip ${p.delta === d ? 'active' : ''}`}
                  onClick={() => set('delta', d)}
                >
                  {d} kcal
                </button>
              ))}
            </div>
            <p className="hint">
              Mức an toàn thường là 300–500 kcal/ngày, tương đương giảm/tăng khoảng 0,3–0,5 kg mỗi tuần.
            </p>
          </div>
        )}
      </section>

      <section className="card result-card">
        <h2 className="card-title">Kết quả</h2>
        <div className="result-grid">
          <div>
            <span>BMR</span>
            <strong>{round(bmr(p))}</strong>
            <small>kcal/ngày</small>
          </div>
          <div>
            <span>TDEE</span>
            <strong>{round(tdee(p))}</strong>
            <small>kcal/ngày</small>
          </div>
          <div className="result-highlight">
            <span>Mục tiêu</span>
            <strong>{target}</strong>
            <small>kcal/ngày</small>
          </div>
        </div>
        <div className="macro-preview">
          <span>Đạm {round(macros.protein)}g</span>
          <span>Béo {round(macros.fat)}g</span>
          <span>Carb {round(macros.carb)}g</span>
        </div>
        <p className="hint">
          BMR là calo cơ thể dùng khi nghỉ hoàn toàn. TDEE là calo tiêu hao thực tế mỗi ngày. Đạm mặc định{' '}
          {p.proteinPerKg} g/kg cân nặng.
        </p>
      </section>

      {extra}

      <button className="btn primary block large" type="submit" disabled={!valid}>
        {submitLabel}
      </button>
    </form>
  )
}

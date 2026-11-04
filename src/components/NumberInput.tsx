import { useEffect, useRef, useState } from 'react'

interface Props {
  value: number
  onChange: (value: number) => void
  suffix?: string
  min?: number
  max?: number
  ariaLabel?: string
  align?: 'left' | 'center'
}

/**
 * Ô nhập số cho phép xoá trắng khi đang gõ (khác input[type=number] thuần),
 * chỉ chuẩn hoá và kẹp giá trị khi blur.
 */
export function NumberInput({
  value,
  onChange,
  suffix,
  min = 0,
  max = 100000,
  ariaLabel,
  align = 'left',
}: Props) {
  const [text, setText] = useState(String(value))
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setText(String(value))
  }, [value])

  const clamp = (n: number) => Math.min(max, Math.max(min, n))

  return (
    <div className={`num-wrap ${align === 'center' ? 'num-center' : ''}`}>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={ariaLabel}
        value={text}
        onFocus={(e) => {
          focused.current = true
          e.currentTarget.select()
        }}
        onChange={(e) => {
          const raw = e.target.value
          setText(raw)
          const n = Number(raw.replace(',', '.'))
          if (raw.trim() !== '' && Number.isFinite(n)) onChange(clamp(n))
        }}
        onBlur={(e) => {
          focused.current = false
          const n = Number(e.target.value.replace(',', '.'))
          if (e.target.value.trim() === '' || !Number.isFinite(n)) {
            setText(String(value))
            return
          }
          const next = clamp(n)
          onChange(next)
          setText(String(next))
        }}
      />
      {suffix && <span className="num-suffix">{suffix}</span>}
    </div>
  )
}

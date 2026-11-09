import React, { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from 'react'
import { animate, motion } from 'motion/react'
import * as Icons from 'lucide-react'

/* ---------- motion settings shared across the app ---------- */

export const FxContext = createContext({ reduced: false, level: 'maximum' })
export const useFx = () => useContext(FxContext)

/* ---------- icons ---------- */

export const Icon = ({ name, size = 18, ...props }) => {
  const Component = Icons[name] || Icons.Circle
  return <Component size={size} strokeWidth={1.8} aria-hidden="true" {...props} />
}

/* ---------- logo: three rising candles ---------- */

export function Logo({ size = 36, draw = false }) {
  const { reduced } = useFx()
  const id = useId().replace(/:/g, '')
  const bars = [
    { x: 11, y: 24, h: 12 },
    { x: 21, y: 17, h: 19 },
    { x: 31, y: 10, h: 26 }
  ]
  const animated = draw && !reduced

  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Habitrade">
      <defs>
        <linearGradient id={`lg${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a99bff" />
          <stop offset="1" stopColor="#6a4fe8" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill={`url(#lg${id})`} />
      {bars.map((b, i) => (
        <motion.rect
          key={i}
          x={b.x}
          y={b.y}
          width="6"
          height={b.h}
          rx="3"
          fill="#fff"
          fillOpacity={0.55 + i * 0.22}
          style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}
          initial={animated ? { scaleY: 0 } : false}
          animate={{ scaleY: 1 }}
          transition={{ delay: 0.25 + i * 0.18, type: 'spring', stiffness: 160, damping: 14 }}
        />
      ))}
    </svg>
  )
}

export const Wordmark = ({ className = '' }) => (
  <span className={`wordmark ${className}`}>
    habit<span>rade</span>
  </span>
)

/* ---------- animated number ---------- */

export function CountUp({ value, suffix = '', duration = 0.9 }) {
  const { reduced } = useFx()
  const [shown, setShown] = useState(reduced ? value : 0)
  const previous = useRef(reduced ? value : 0)

  useEffect(() => {
    if (reduced) {
      setShown(value)
      previous.current = value
      return
    }
    const controls = animate(previous.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: v => setShown(Math.round(v))
    })
    previous.current = value
    return () => controls.stop()
  }, [value, reduced, duration])

  return <>{shown}{suffix}</>
}

/* ---------- confetti burst ---------- */

const palette = ['#a99bff', '#3fd6a1', '#ffb454', '#ff7d92', '#6ec6ff']

export function Confetti({ burst }) {
  const { level } = useFx()
  const [active, setActive] = useState(0)

  const pieces = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => {
        const angle = (Math.PI * 2 * i) / 34 + Math.random() * 0.4
        const distance = 90 + Math.random() * 150
        return {
          id: i,
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance - 40,
          rotate: Math.random() * 540 - 270,
          size: 6 + Math.random() * 6,
          color: palette[i % palette.length],
          round: i % 3 === 0
        }
      }),
    [burst]
  )

  useEffect(() => {
    if (!burst || level !== 'maximum') return
    setActive(burst)
    const timer = window.setTimeout(() => setActive(0), 1700)
    return () => window.clearTimeout(timer)
  }, [burst, level])

  if (!active) return null

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map(p => (
        <motion.span
          key={`${active}-${p.id}`}
          style={{
            width: p.size,
            height: p.round ? p.size : p.size * 0.5,
            background: p.color,
            borderRadius: p.round ? '50%' : 2
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.4, rotate: 0 }}
          animate={{ x: p.x, y: p.y + 120, opacity: 0, scale: 1, rotate: p.rotate }}
          transition={{ duration: 1.5, ease: [0.16, 0.84, 0.3, 1] }}
        />
      ))}
    </div>
  )
}

/* ---------- cursor spotlight for cards ---------- */

export const spotlight = event => {
  const rect = event.currentTarget.getBoundingClientRect()
  event.currentTarget.style.setProperty('--mx', `${event.clientX - rect.left}px`)
  event.currentTarget.style.setProperty('--my', `${event.clientY - rect.top}px`)
}

import { useEffect, useState } from 'react'

// Counts up from 0 to `value` once on mount/value-change — used for score
// reveals and streak counts, where a satisfying tick-up reads as a result
// landing rather than just appearing.
export function AnimatedNumber({ value, durationMs = 600 }: { value: number; durationMs?: number }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let frame: number
    const start = performance.now()

    function tick(now: number) {
      const progress = Math.min((now - start) / durationMs, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(value * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, durationMs])

  return <>{display}</>
}

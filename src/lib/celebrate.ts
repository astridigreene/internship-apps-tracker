import confetti from 'canvas-confetti'

const COLORS = ['#0d9488', '#06b6d4', '#2dd4bf', '#38bdf8', '#f97316', '#10b981']

/** Celebration burst for wins / progress (not rejections). */
export function celebrate() {
  const defaults = {
    colors: COLORS,
    disableForReducedMotion: true,
  }

  confetti({
    ...defaults,
    particleCount: 80,
    spread: 70,
    origin: { y: 0.65 },
    startVelocity: 38,
  })

  window.setTimeout(() => {
    confetti({
      ...defaults,
      particleCount: 45,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
    })
    confetti({
      ...defaults,
      particleCount: 45,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
    })
  }, 120)
}

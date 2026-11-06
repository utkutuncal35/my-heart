import { useEffect, useMemo, useRef } from 'react'

const LAYERS = 11
const FLORET_COUNT = 90
const SPARK_MAX = 40
const SPARK_INTERVAL = 110
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

const OUTER_COLOR = [255, 212, 60]
const INNER_COLOR = [232, 138, 18]
const BASE_SHADE = [140, 62, 0]
const TIP_LIGHT = [255, 240, 160]
const FLORET_INNER = [196, 190, 58]
const FLORET_OUTER = [240, 168, 30]
const STEM_DARK = [44, 86, 30]
const STEM_LIGHT = [110, 160, 60]

function lerpColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

function rgba(c, a) {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v))
}

function easeOutBack(t) {
  const c1 = 1.4
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

// İçten dışa açılma: en iç katman önce, dış katman en son
function bloom(tSec, layer) {
  const depth = layer / (LAYERS - 1)
  const delay = 0.3 + (1 - depth) * 1.9
  const t = clamp01((tSec - delay) / 1.5)
  return t === 0 ? 0 : easeOutBack(t)
}

function breathe(tSec) {
  return 1 + 0.025 * Math.sin(tSec * 1.2)
}

function makePetals() {
  const petals = []
  for (let layer = 0; layer < LAYERS; layer++) {
    const depth = layer / (LAYERS - 1)
    const count = Math.round(46 - depth * 20)
    const length = 1 - depth * 0.78
    const color = lerpColor(OUTER_COLOR, INNER_COLOR, depth ** 1.3)
    for (let k = 0; k < count; k++) {
      const len = length * (0.9 + Math.random() * 0.14)
      petals.push({
        layer,
        angle: (k / count) * Math.PI * 2 + layer * GOLDEN_ANGLE + (Math.random() - 0.5) * 0.08,
        length: len,
        width: len * (0.085 + depth * 0.08),
        phase: Math.random() * Math.PI * 2,
        speed: 0.5 + Math.random() * 0.8,
        color,
        base: lerpColor(color, BASE_SHADE, 0.5 + depth * 0.15),
        tip: lerpColor(color, TIP_LIGHT, 0.45 - depth * 0.3),
      })
    }
  }
  return petals
}

function makeFlorets() {
  const florets = []
  for (let k = 0; k < FLORET_COUNT; k++) {
    const r = Math.sqrt(k / FLORET_COUNT)
    florets.push({
      x: Math.cos(k * GOLDEN_ANGLE) * r,
      y: Math.sin(k * GOLDEN_ANGLE) * r,
      size: 0.6 + r * 0.6,
      color: lerpColor(FLORET_INNER, FLORET_OUTER, r),
    })
  }
  return florets
}

function drawPetal(ctx, L, W, p) {
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(L * 0.45, -W, L * 0.9, -W * 0.6)
  ctx.quadraticCurveTo(L * 1.03, 0, L * 0.9, W * 0.6)
  ctx.quadraticCurveTo(L * 0.45, W, 0, 0)
  const grad = ctx.createLinearGradient(0, 0, L, 0)
  grad.addColorStop(0, rgba(p.base, 1))
  grad.addColorStop(0.45, rgba(p.color, 1))
  grad.addColorStop(1, rgba(p.tip, 1))
  ctx.fillStyle = grad
  ctx.fill()
  ctx.strokeStyle = 'rgba(110,50,0,0.28)'
  ctx.lineWidth = 0.7
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(L * 0.12, 0)
  ctx.lineTo(L * 0.82, 0)
  ctx.strokeStyle = 'rgba(255,245,200,0.18)'
  ctx.lineWidth = Math.max(0.6, W * 0.12)
  ctx.stroke()
}

function drawLeaf(ctx, x, y, angle, size, grow) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.scale(grow, grow)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.bezierCurveTo(size * 0.3, -size * 0.38, size * 0.75, -size * 0.3, size, 0)
  ctx.bezierCurveTo(size * 0.75, size * 0.26, size * 0.3, size * 0.3, 0, 0)
  const grad = ctx.createLinearGradient(0, 0, size, 0)
  grad.addColorStop(0, rgba(STEM_DARK, 1))
  grad.addColorStop(1, rgba(STEM_LIGHT, 1))
  ctx.fillStyle = grad
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.quadraticCurveTo(size * 0.5, -size * 0.04, size * 0.95, 0)
  ctx.strokeStyle = 'rgba(200,230,150,0.3)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

function App() {
  const canvasRef = useRef(null)

  const petals = useMemo(makePetals, [])
  const florets = useMemo(makeFlorets, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const stage = canvas.parentElement
    const ctx = canvas.getContext('2d')
    let raf
    let lastSpark = 0
    const start = performance.now()
    const sparks = []
    let w = 0
    let h = 0

    function resize() {
      const rect = stage.getBoundingClientRect()
      w = rect.width
      h = rect.height
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)
    const ro = new ResizeObserver(resize)
    ro.observe(stage)

    function drawStem(cx, cy, R, tSec) {
      const grow = clamp01(tSec / 1.2)
      const sway = Math.sin(tSec * 0.9) * R * 0.03
      const endX = cx - R * 0.12 + sway
      const endY = cy + R * 1.45
      ctx.globalAlpha = grow
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.bezierCurveTo(cx + R * 0.08, cy + R * 0.6, endX + R * 0.1, endY - R * 0.4, endX, endY)
      const grad = ctx.createLinearGradient(0, cy, 0, endY)
      grad.addColorStop(0, rgba(STEM_DARK, 1))
      grad.addColorStop(1, rgba(STEM_LIGHT, 0.9))
      ctx.strokeStyle = grad
      ctx.lineWidth = Math.max(2, R * 0.045)
      ctx.lineCap = 'round'
      ctx.stroke()

      const leafGrow = clamp01((tSec - 0.6) / 1.4)
      const leafSway = Math.sin(tSec * 1.1) * 0.06
      drawLeaf(ctx, cx + R * 0.05, cy + R * 1.05, -0.35 + leafSway, R * 0.5, leafGrow)
      drawLeaf(ctx, cx + R * 0.02, cy + R * 1.22, Math.PI + 0.45 - leafSway, R * 0.42, leafGrow)
      ctx.globalAlpha = 1
    }

    function frame(now) {
      const tSec = (now - start) / 1000
      ctx.clearRect(0, 0, w, h)

      const portrait = h > w * 1.2
      const cx = w / 2
      const cy = h * (portrait ? 0.4 : 0.38)
      const R = Math.min(w * (portrait ? 0.4 : 0.32), h * 0.24) * breathe(tSec)
      const rot = tSec * 0.02

      drawStem(cx, cy, R, tSec)

      ctx.save()
      ctx.translate(cx, cy)
      ctx.scale(1, 0.92)
      ctx.rotate(rot)

      for (const p of petals) {
        const open = bloom(tSec, p.layer)
        if (open <= 0) continue
        const sway = Math.sin(tSec * p.speed + p.phase) * 0.026
        const twist = (1 - Math.min(open, 1)) * 0.6
        const L = p.length * R * open
        const W = p.width * R * (0.4 + 0.6 * Math.min(open, 1))
        ctx.save()
        ctx.globalAlpha = clamp01(open * 2)
        ctx.rotate(p.angle + sway + twist)
        ctx.translate(R * 0.06, 0)
        drawPetal(ctx, L, W, p)
        ctx.restore()
      }
      ctx.globalAlpha = 1

      const core = clamp01(tSec / 0.8)
      const coreR = R * 0.13
      for (const f of florets) {
        ctx.beginPath()
        ctx.fillStyle = rgba(f.color, core)
        ctx.arc(f.x * coreR, f.y * coreR, f.size * R * 0.012, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.globalCompositeOperation = 'lighter'
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.45)
      glow.addColorStop(0, `rgba(255,220,120,${0.35 * core})`)
      glow.addColorStop(1, 'rgba(255,160,40,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(0, 0, R * 0.45, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      if (tSec > 2 && now - lastSpark > SPARK_INTERVAL && sparks.length < SPARK_MAX) {
        lastSpark = now
        const a = Math.random() * Math.PI * 2
        const r = R * (0.55 + Math.random() * 0.4)
        sparks.push({
          x: cx + Math.cos(a) * r,
          y: cy + Math.sin(a) * r * 0.92,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -0.4 - Math.random() * 0.7,
          life: 0,
          maxLife: 1.6 + Math.random() * 1.4,
          size: 0.8 + Math.random() * 1.6,
        })
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.life += 1 / 60
        s.x += s.vx + Math.sin(s.life * 3 + i) * 0.15
        s.y += s.vy
        const lifeT = s.life / s.maxLife
        if (lifeT >= 1) {
          sparks.splice(i, 1)
          continue
        }
        const alpha = (1 - lifeT) * 0.9
        ctx.beginPath()
        ctx.fillStyle = `rgba(255,220,120,${alpha})`
        ctx.arc(s.x, s.y, s.size * (1 - lifeT * 0.5), 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.globalCompositeOperation = 'source-over'
      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      ro.disconnect()
    }
  }, [petals, florets])

  return (
    <div className="stage">
      <div className="glow" />
      <canvas ref={canvasRef} className="flower-canvas" />
      <div className="name-wrap">
        <span className="name-text">Damla</span>
      </div>
    </div>
  )
}

export default App

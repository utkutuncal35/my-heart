import { useEffect, useMemo, useRef } from 'react'

const FILL_COUNT = 650
const EDGE_COUNT = 260
const SPARK_MAX = 45
const SPARK_INTERVAL = 90

const INNER_COLOR = [255, 190, 220]
const OUTER_COLOR = [130, 8, 42]

function heartPoint(t, r) {
  const x = Math.pow(Math.sin(t), 3) * r
  const y =
    (-(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 16) * r
  return [x, y]
}

function lerpColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

function makeParticle(t, r, edge) {
  const [x, y] = heartPoint(t, r)
  const rad = Math.min(1, Math.hypot(x, y) / 1.05)
  return {
    x,
    y,
    edge,
    size: edge ? 1.6 + Math.random() * 2.2 : 1 + Math.random() * 1.8,
    phase: Math.random() * Math.PI * 2,
    speed: 0.6 + Math.random() * 1.2,
    color: lerpColor(INNER_COLOR, OUTER_COLOR, rad),
  }
}

function pulse(tSec) {
  const cycle = 1.1
  const phase = (tSec % cycle) / cycle
  const bump = (c, w) => Math.exp(-(((phase - c) / w) ** 2))
  return 1 + 0.16 * bump(0.09, 0.05) + 0.1 * bump(0.26, 0.06)
}

function App() {
  const canvasRef = useRef(null)

  const particles = useMemo(() => {
    const pts = []
    for (let i = 0; i < FILL_COUNT; i++) {
      const t = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random())
      pts.push(makeParticle(t, r, false))
    }
    for (let i = 0; i < EDGE_COUNT; i++) {
      const t = Math.random() * Math.PI * 2
      const r = 0.94 + Math.random() * 0.07
      pts.push(makeParticle(t, r, true))
    }
    return pts
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let raf
    let lastSpark = 0
    const start = performance.now()
    const sparks = []

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = window.innerWidth + 'px'
      canvas.style.height = window.innerHeight + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    function frame(now) {
      const tSec = (now - start) / 1000
      const w = window.innerWidth
      const h = window.innerHeight
      ctx.clearRect(0, 0, w, h)

      const scale = Math.min(w, h) * 0.34 * pulse(tSec)
      const cx = w / 2
      const cy = h / 2

      ctx.globalCompositeOperation = 'lighter'

      for (const p of particles) {
        const px = cx + p.x * scale + Math.sin(tSec * p.speed * 2 + p.phase) * 2
        const py = cy + p.y * scale + Math.cos(tSec * p.speed * 1.7 + p.phase) * 2
        const flicker = 0.55 + 0.45 * Math.sin(tSec * (2 + p.speed) + p.phase)
        const alpha = (p.edge ? 0.85 : 0.6) * flicker
        ctx.beginPath()
        ctx.fillStyle = `rgba(${p.color[0]},${p.color[1]},${p.color[2]},${alpha})`
        ctx.arc(px, py, p.size * (p.edge ? 1.1 : 1), 0, Math.PI * 2)
        ctx.fill()
      }

      if (now - lastSpark > SPARK_INTERVAL && sparks.length < SPARK_MAX) {
        lastSpark = now
        const base = particles[Math.floor(Math.random() * particles.length)]
        sparks.push({
          x: cx + base.x * scale,
          y: cy + base.y * scale,
          vx: (Math.random() - 0.5) * 0.5,
          vy: -0.6 - Math.random() * 0.9,
          life: 0,
          maxLife: 1.4 + Math.random() * 1.2,
          size: 1 + Math.random() * 1.6,
        })
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.life += 1 / 60
        s.x += s.vx
        s.y += s.vy
        const lifeT = s.life / s.maxLife
        if (lifeT >= 1) {
          sparks.splice(i, 1)
          continue
        }
        const alpha = (1 - lifeT) * 0.9
        ctx.beginPath()
        ctx.fillStyle = `rgba(255,195,220,${alpha})`
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
    }
  }, [particles])

  return (
    <div className="stage">
      <div className="glow" />
      <canvas ref={canvasRef} className="heart-canvas" />
      <div className="name-wrap">
        <span className="name-text">Damla</span>
      </div>
    </div>
  )
}

export default App

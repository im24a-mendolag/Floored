'use client'

import { useEffect } from 'react'

function getScale(w: number): number {
  if (w < 1200) return 1
  if (w < 1500) return 0.9
  if (w < 2000) return 1.0
  return 1.5
}

function applyScale() {
  const scale = getScale(window.innerWidth)
  document.documentElement.style.zoom = String(scale)
  document.documentElement.style.setProperty(
    '--real-vh',
    `${(window.innerHeight / scale) * 0.01}px`,
  )
}

export function ScaleInit() {
  useEffect(() => {
    applyScale()
    window.addEventListener('resize', applyScale)
    return () => window.removeEventListener('resize', applyScale)
  }, [])
  return null
}

// Inlined into <head> before first paint — keep in sync with applyScale above.
export const SCALE_INIT_SCRIPT = `(function(){
  function g(w){return w<1200?1:w<1500?0.9:w<2000?1:1.5}
  function a(){var s=g(window.innerWidth);document.documentElement.style.zoom=s;document.documentElement.style.setProperty('--real-vh',(window.innerHeight/s*0.01)+'px')}
  a();
})()`

'use client'
import { useEffect, useState } from 'react'

/**
 * ReadingProgress — fixed progress bar at the top of the page that
 * fills as the user scrolls through an article. Provides visual
 * feedback of reading progress (like a book page indicator).
 */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const updateProgress = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0
      setProgress(Math.min(100, Math.max(0, pct)))
    }
    updateProgress()
    window.addEventListener('scroll', updateProgress, { passive: true })
    window.addEventListener('resize', updateProgress)
    return () => {
      window.removeEventListener('scroll', updateProgress)
      window.removeEventListener('resize', updateProgress)
    }
  }, [])

  return (
    <div
      className="reading-progress"
      style={{ width: `${progress}%` }}
      aria-hidden="true"
    />
  )
}

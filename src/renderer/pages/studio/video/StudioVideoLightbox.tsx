import { Maximize, Pause, Play, Repeat2, Volume2, VolumeX, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@cherrystudio/ui'
import type { VideoGenerationRecord } from '@shared/types/videoGeneration'

interface StudioVideoLightboxProps {
  record: VideoGenerationRecord
  onClose: () => void
}

export default function StudioVideoLightbox({ record, onClose }: StudioVideoLightboxProps) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [loop, setLoop] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const togglePlayback = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) void video.play()
    else video.pause()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t('studio.video.player_title')}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}>
      <div
        ref={playerRef}
        className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
        <div className="flex items-center justify-between gap-3 bg-black px-4 py-3 text-white">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-medium">{record.prompt}</h2>
            <p className="text-xs text-white/60">{record.modelName}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('common.close')}
            className="text-white hover:bg-white/10 hover:text-white"
            onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
          <video
            ref={videoRef}
            src={record.videoUrl}
            className="max-h-[min(72vh,800px)] w-full object-contain"
            playsInline
            muted={muted}
            loop={loop}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          />
        </div>
        <div className="flex items-center gap-3 bg-black px-4 py-3 text-white">
          <Button
            variant="ghost"
            size="icon"
            aria-label={playing ? t('studio.video.pause') : t('studio.video.play')}
            className="shrink-0 text-white hover:bg-white/10 hover:text-white"
            onClick={togglePlayback}>
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <span className="min-w-10 text-right text-xs tabular-nums text-white/70">{formatTime(currentTime)}</span>
          <input
            aria-label={t('studio.video.seek')}
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(currentTime, duration || currentTime)}
            onChange={(event) => {
              const next = Number(event.target.value)
              if (videoRef.current) videoRef.current.currentTime = next
              setCurrentTime(next)
            }}
            className="h-1 min-w-0 flex-1 accent-white"
          />
          <span className="min-w-10 text-xs tabular-nums text-white/70">{formatTime(duration)}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={muted ? t('studio.video.unmute') : t('studio.video.mute')}
            aria-pressed={muted}
            className="shrink-0 text-white hover:bg-white/10 hover:text-white"
            onClick={() => setMuted((value) => !value)}>
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('studio.video.loop')}
            aria-pressed={loop}
            className="shrink-0 text-white hover:bg-white/10 hover:text-white"
            onClick={() => setLoop((value) => !value)}>
            <Repeat2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('studio.video.fullscreen')}
            className="shrink-0 text-white hover:bg-white/10 hover:text-white"
            onClick={() => void playerRef.current?.requestFullscreen?.()}>
            <Maximize className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const wholeSeconds = Math.floor(seconds)
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`
}

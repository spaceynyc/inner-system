import React, { useEffect, useRef, useState } from 'react'
import { audioState } from '../audioState'
import { controls } from '../controls'
import MotionPermissionButton from './MotionPermissionButton'

const BANDS = ['bass', 'mid', 'high']
const WAVE_BARS = 18
const WAVE_MAX_PX = 36

export default function Overlay({ playState, setPlayState }) {
    const barRefs = useRef([])
    const waveRefs = useRef([])
    const [status, setStatus] = useState('')

    // Screen-reader status line: registered on the shared bus so the scene can
    // announce form changes and App can announce playback problems.
    useEffect(() => {
        controls.announce = (message) => setStatus(message)
        return () => { controls.announce = null }
    }, [])

    useEffect(() => {
        setStatus(playState ? 'Signal active: sound playing.' : 'Signal paused.')
    }, [playState])

    // Drive the spectral HUD straight from the shared audio state via CSS
    // custom properties: no React re-render per frame, transforms only.
    useEffect(() => {
        let frame
        const tick = () => {
            const floor = audioState.isPlaying ? 0.08 : 0
            BANDS.forEach((band, index) => {
                const bar = barRefs.current[index]
                if (bar) bar.style.setProperty('--level', Math.max(audioState[band], floor).toFixed(3))
            })
            waveRefs.current.forEach((bar, index) => {
                if (!bar) return
                const phase = index / (WAVE_BARS - 1)
                const height = 12 + audioState.average * 36 + Math.sin(phase * Math.PI * 2 + audioState.bass * 5) * 5
                bar.style.setProperty('--wave', (Math.max(8, height) / WAVE_MAX_PX).toFixed(3))
            })
            frame = window.requestAnimationFrame(tick)
        }
        tick()
        return () => window.cancelAnimationFrame(frame)
    }, [])

    const signalLabel = playState ? 'SIGNAL ACTIVE' : 'INITIALIZE SIGNAL'

    return (
        <div className="overlay">
            <h1 className="visually-hidden">THE INNER SYSTEM</h1>
            <p className="visually-hidden" aria-live="polite" role="status">{status}</p>

            <div className="signal-panel">
                <button
                    type="button"
                    className={`activation-button ${playState ? 'is-active' : ''}`}
                    onClick={() => setPlayState(prev => !prev)}
                    aria-label={playState ? 'Signal active. Pause sound' : 'Initialize signal. Play sound'}
                    aria-pressed={playState}
                >
                    <span className="activation-orb" aria-hidden="true">
                        <span className="activation-core">
                            {playState ? (
                                <svg viewBox="0 0 12 12" className="activation-glyph">
                                    <rect x="2" y="1.5" width="3" height="9" rx="0.8" />
                                    <rect x="7" y="1.5" width="3" height="9" rx="0.8" />
                                </svg>
                            ) : (
                                <svg viewBox="0 0 12 12" className="activation-glyph">
                                    <path d="M3.2 1.6 L10.4 6 L3.2 10.4 Z" />
                                </svg>
                            )}
                        </span>
                    </span>
                    <span className="activation-copy">
                        <span className="activation-kicker">THE INNER SYSTEM</span>
                        <span className="activation-label">{signalLabel}</span>
                    </span>
                </button>

                <div className={`spectral-hud ${playState ? 'is-active' : ''}`} aria-hidden="true">
                    {BANDS.map((band, index) => (
                        <div className="spectral-row" key={band}>
                            <span>{band.toUpperCase()}</span>
                            <i ref={el => { barRefs.current[index] = el }} />
                        </div>
                    ))}
                    <div className="waveform">
                        {Array.from({ length: WAVE_BARS }, (_, index) => (
                            <span key={index} ref={el => { waveRefs.current[index] = el }} />
                        ))}
                    </div>
                </div>

                <MotionPermissionButton />
            </div>
        </div>
    )
}

import React, { useEffect, useState } from 'react'
import { audioState } from '../audioState'

export default function Overlay({ playState, setPlayState }) {
    const [levels, setLevels] = useState({ bass: 0, mid: 0, high: 0, average: 0 })

    useEffect(() => {
        let frame
        const tick = () => {
            setLevels({
                bass: audioState.bass,
                mid: audioState.mid,
                high: audioState.high,
                average: audioState.average
            })
            frame = window.requestAnimationFrame(tick)
        }
        tick()
        return () => window.cancelAnimationFrame(frame)
    }, [])

    const signalLabel = playState ? 'SIGNAL ACTIVE' : 'INITIALIZE SIGNAL'

    return (
        <div className="overlay">
            <div className="signal-panel" aria-live="polite">
                <button
                    type="button"
                    className={`activation-button ${playState ? 'is-active' : ''}`}
                    onClick={() => setPlayState(prev => !prev)}
                    title={playState ? 'Pause signal' : 'Initialize signal'}
                    aria-label={playState ? 'Pause audio signal' : 'Initialize audio signal'}
                    aria-pressed={playState}
                >
                    <span className="activation-orb" aria-hidden="true">
                        <span className="activation-core" />
                    </span>
                    <span className="activation-copy">
                        <span className="activation-kicker">THE INNER SYSTEM</span>
                        <span className="activation-label">{signalLabel}</span>
                    </span>
                </button>

                <div className={`spectral-hud ${playState ? 'is-active' : ''}`} aria-hidden={!playState}>
                    <div className="spectral-row">
                        <span>BASS</span>
                        <i style={{ '--level': `${Math.max(levels.bass, playState ? 0.08 : 0) * 100}%` }} />
                    </div>
                    <div className="spectral-row">
                        <span>MID</span>
                        <i style={{ '--level': `${Math.max(levels.mid, playState ? 0.08 : 0) * 100}%` }} />
                    </div>
                    <div className="spectral-row">
                        <span>HIGH</span>
                        <i style={{ '--level': `${Math.max(levels.high, playState ? 0.08 : 0) * 100}%` }} />
                    </div>
                    <div className="waveform" aria-hidden="true">
                        {Array.from({ length: 18 }, (_, index) => {
                            const phase = index / 17
                            const height = 12 + levels.average * 36 + Math.sin(phase * Math.PI * 2 + levels.bass * 5) * 5
                            return <span key={index} style={{ height: `${Math.max(8, height)}px` }} />
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}

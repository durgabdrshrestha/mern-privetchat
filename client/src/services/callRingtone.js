let audioContext
let ringInterval
let delayedTone

export const unlockCallAudio = () => {
  if (typeof window === 'undefined') return

  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext
  if (!AudioContextConstructor) return

  audioContext ||= new AudioContextConstructor()
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {})
  }
}

const playTone = (frequencies, duration) => {
  if (!audioContext || audioContext.state !== 'running') return

  const now = audioContext.currentTime
  frequencies.forEach((frequency) => {
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.04)
    gain.gain.setTargetAtTime(0.0001, now + duration * 0.6, 0.09)
    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start(now)
    oscillator.stop(now + duration)
  })
}

export const stopCallRingtone = () => {
  if (ringInterval) clearInterval(ringInterval)
  if (delayedTone) clearTimeout(delayedTone)
  ringInterval = null
  delayedTone = null
}

export const playMessageNotification = () => {
  unlockCallAudio()
  playTone([784, 988], 0.18)
}

export const startCallRingtone = (kind = 'incoming') => {
  stopCallRingtone()
  unlockCallAudio()

  const incoming = kind === 'incoming'
  const playPattern = () => {
    playTone(incoming ? [440, 480] : [480, 620], incoming ? 0.55 : 1.1)
    if (incoming) {
      delayedTone = setTimeout(() => playTone([440, 480], 0.55), 750)
    }
  }

  playPattern()
  ringInterval = setInterval(playPattern, incoming ? 3200 : 5000)
}

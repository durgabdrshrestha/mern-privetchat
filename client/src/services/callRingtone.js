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

const playTone = (frequency) => {
  if (!audioContext || audioContext.state !== 'running') return

  const oscillator = audioContext.createOscillator()
  const gain = audioContext.createGain()
  const now = audioContext.currentTime

  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.025)
  gain.gain.setTargetAtTime(0.0001, now + 0.3, 0.04)
  oscillator.connect(gain)
  gain.connect(audioContext.destination)
  oscillator.start(now)
  oscillator.stop(now + 0.5)
}

export const stopCallRingtone = () => {
  if (ringInterval) clearInterval(ringInterval)
  if (delayedTone) clearTimeout(delayedTone)
  ringInterval = null
  delayedTone = null
}

export const startCallRingtone = (kind = 'incoming') => {
  stopCallRingtone()
  unlockCallAudio()

  const incoming = kind === 'incoming'
  const playPattern = () => {
    playTone(incoming ? 660 : 440)
    if (incoming) {
      delayedTone = setTimeout(() => playTone(880), 180)
    }
  }

  playPattern()
  ringInterval = setInterval(playPattern, incoming ? 1800 : 3000)
}

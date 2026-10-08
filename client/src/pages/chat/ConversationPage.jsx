import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Phone, Video, MoreVertical, Paperclip, Smile, Mic, Send, StopCircle, Trash2, Check, CheckCheck, PhoneOff, MicOff, VideoOff, Volume2, VolumeX } from 'lucide-react'
import { apiFetch, getCurrentUserId } from '../../services/api'
import { getSocket } from '../../services/socket'
import { startCallRingtone, stopCallRingtone } from '../../services/callRingtone'

const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00'

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.floor(seconds % 60)

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

const commonEmojis = ['😀', '😂', '🥰', '😍', '😊', '😉', '😭', '😎', '🤔', '🙏', '👍', '👏', '❤️', '🔥', '🎉', '✨', '💯', '😢', '😅', '🤗', '😘', '🙌', '✅', '👋', '💚', '🤣', '🤝', '😴', '🤩', '😡']

const createPeerConnection = (iceServers = []) => {
  if (typeof window === 'undefined' || !window.RTCPeerConnection) {
    return null
  }

  return new window.RTCPeerConnection({ iceServers })
}

export default function ConversationPage() {
  const params = useParams()
  const { conversationId } = params
  const [searchParams, setSearchParams] = useSearchParams()
  const [messages, setMessages] = useState([])
  const [conversation, setConversation] = useState(null)
  const [draftText, setDraftText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [draftAudioUrl, setDraftAudioUrl] = useState('')
  const [draftAudioDuration, setDraftAudioDuration] = useState(0)
  const [loading, setLoading] = useState(true)
  const [typingUser, setTypingUser] = useState(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [callState, setCallState] = useState(null)
  const [callDuration, setCallDuration] = useState(0)
  const [isMicMuted, setIsMicMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [speakerPlaybackBlocked, setSpeakerPlaybackBlocked] = useState(false)

  const typingTimeoutRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const fileInputRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const remoteAudioRef = useRef(null)
  const remoteStreamRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const messageInputRef = useRef(null)
  const pendingIceCandidatesRef = useRef([])
  const callStateRef = useRef(null)
  const autoCallRef = useRef('')

  const currentUserId = getCurrentUserId()
  const otherParticipantInfo = conversation?.participants?.find((person) => person._id !== currentUserId)
  const participantName = conversation?.type === 'group' ? conversation.name || 'Group chat' : otherParticipantInfo?.name || 'Chat'
  const participantInitial = participantName.charAt(0).toUpperCase() || 'C'
  const unreadMessageIds = messages
    .filter((message) => message.senderId?._id !== currentUserId && !message.readAt)
    .map((message) => message._id)
    .filter(Boolean)
    .join(',')

  useEffect(() => {
    if (callState?.type !== 'video') return

    const localVideo = localVideoRef.current
    if (localVideo && streamRef.current) {
      localVideo.srcObject = streamRef.current
      localVideo.muted = true
      localVideo.playsInline = true
      localVideo.play().catch(() => {})
    }

    const remoteVideo = remoteVideoRef.current
    if (remoteVideo && callState.remoteStream) {
      remoteVideo.srcObject = callState.remoteStream
      remoteVideo.muted = true
      remoteVideo.playsInline = true
      remoteVideo.play().catch(() => {})
    }
  }, [callState?.type, callState?.remoteStream])

  useEffect(() => {
    if (!conversationId) return

    const loadConversation = async () => {
      try {
        const conversations = await apiFetch('/conversations')
        const matchedConversation = conversations.find((item) => item._id === conversationId)
        setConversation(matchedConversation || null)

        const data = await apiFetch(`/conversations/${conversationId}/messages`)
        setMessages(data)
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    loadConversation()
  }, [conversationId])

  useEffect(() => {
    if (!conversationId || !unreadMessageIds) return

    const markMessagesAsRead = async () => {
      try {
        await apiFetch(`/conversations/${conversationId}/messages/read`, { method: 'POST' })
      } catch (error) {
        console.error('Could not mark messages as read:', error)
      }
    }

    markMessagesAsRead()
  }, [conversationId, unreadMessageIds])

  useEffect(() => {
    if (!isRecording) return undefined

    const interval = setInterval(() => {
      setRecordingSeconds((current) => current + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [isRecording])

  useEffect(() => {
    if (!callState || callState.phase !== 'connected') return undefined

    const interval = setInterval(() => {
      setCallDuration((current) => current + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [callState])

  useEffect(() => {
    if (callState?.phase === 'incoming') {
      startCallRingtone('incoming')
      return stopCallRingtone
    }
    if (callState?.phase === 'ringing' || callState?.phase === 'dialing') {
      startCallRingtone('outgoing')
      return stopCallRingtone
    }
    stopCallRingtone()
    return undefined
  }, [callState?.phase])

  useEffect(() => {
    if (!draftAudioUrl) return undefined

    const audio = new Audio(draftAudioUrl)
    const handleMetadata = () => {
      setDraftAudioDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    }

    audio.addEventListener('loadedmetadata', handleMetadata)
    return () => {
      audio.removeEventListener('loadedmetadata', handleMetadata)
    }
  }, [draftAudioUrl])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
      }
    }
  }, [])

  useEffect(() => {
    const audioUrl = draftAudioUrl
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [draftAudioUrl])

  const clearDraftAudio = () => {
    if (draftAudioUrl) {
      URL.revokeObjectURL(draftAudioUrl)
    }

    setDraftAudioUrl('')
    setDraftAudioDuration(0)
  }

  const stopCurrentStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }

  const startRecording = async () => {
    if (isRecording) return
    if (callStateRef.current) {
      alert('End the call before recording a voice note.')
      return
    }

    if (!window.MediaRecorder) {
      alert('Voice recording is not supported by this browser. Try a current version of Chrome, Edge, or Safari.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const supportedMimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac']
        .find((mimeType) => MediaRecorder.isTypeSupported?.(mimeType))
      const recorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream)
      const mimeType = recorder.mimeType || supportedMimeType || 'audio/webm'
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType })
        if (!audioBlob.size) {
          stopCurrentStream()
          alert('No audio was recorded. Check microphone permission and try again.')
          return
        }
        const url = URL.createObjectURL(audioBlob)

        setDraftAudioUrl((current) => {
          if (current) URL.revokeObjectURL(current)
          return url
        })

        setRecordingSeconds(0)
        stopCurrentStream()
      }

      recorder.start()
      setIsRecording(true)
      setRecordingSeconds(0)
    } catch (error) {
      console.error('Microphone access failed:', error)
      alert('Microphone access is required to record an audio message.')
    }
  }

  const stopRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return

    mediaRecorderRef.current.stop()
    setIsRecording(false)
  }

  const uploadAttachment = async (file) => {
    const formData = new FormData()
    formData.append('file', file)

    const result = await apiFetch(`/conversations/${conversationId}/upload`, {
      method: 'POST',
      body: formData,
      isFormData: true,
    })

    return result.file
  }

  const handleSendText = async () => {
    if (!conversationId || !draftText.trim()) return

    try {
      const payload = { text: draftText.trim(), type: 'text' }
      const message = await apiFetch(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: payload,
      })

      setMessages((current) => {
        if (current.some((item) => item._id === message._id)) {
          return current
        }
        return [...current, message]
      })

      setDraftText('')
      if (messageInputRef.current) messageInputRef.current.style.height = '42px'
      setTypingUser(null)
    } catch (error) {
      console.error(error)
    }
  }

  const handleSendAudio = async () => {
    if (!conversationId || !draftAudioUrl) return

    try {
      const audioFile = await fetch(draftAudioUrl).then((response) => response.blob())
      const mimeType = audioFile.type || 'audio/webm'
      const extension = mimeType.includes('mp4') || mimeType.includes('aac') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm'
      const file = new File([audioFile], `voice-note.${extension}`, { type: mimeType })
      const attachment = await uploadAttachment(file)

      const message = await apiFetch(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: {
          text: 'Voice note',
          type: 'audio',
          attachment,
        },
      })

      setMessages((current) => {
        if (current.some((item) => item._id === message._id)) {
          return current
        }
        return [...current, message]
      })

      clearDraftAudio()
    } catch (error) {
      console.error(error)
      alert('Unable to upload the voice note.')
    }
  }

  const handleFileAttach = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !conversationId) return

    try {
      const attachment = await uploadAttachment(file)
      const message = await apiFetch(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: {
          text: file.name,
          type: file.type.startsWith('image/') ? 'image' : 'file',
          attachment,
        },
      })

      setMessages((current) => {
        if (current.some((item) => item._id === message._id)) {
          return current
        }
        return [...current, message]
      })

    } catch (error) {
      console.error(error)
      alert('Unable to upload the attachment.')
    } finally {
      event.target.value = ''
    }
  }

  const handleTyping = (nextValue) => {
    setDraftText(nextValue)
    const socket = getSocket()

    if (!socket || !conversationId) return

    if (nextValue.trim()) {
      socket.emit('typing:start', { conversationId })
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing:stop', { conversationId })
      }, 1200)
      return
    }

    socket.emit('typing:stop', { conversationId })
  }

  const insertEmoji = (emoji) => {
    const input = messageInputRef.current
    const start = input?.selectionStart ?? draftText.length
    const end = input?.selectionEnd ?? draftText.length
    const nextDraft = `${draftText.slice(0, start)}${emoji}${draftText.slice(end)}`
    setDraftText(nextDraft)
    setShowEmojiPicker(false)
    requestAnimationFrame(() => {
      if (!input) return
      input.focus()
      input.setSelectionRange(start + emoji.length, start + emoji.length)
      input.style.height = 'auto'
      input.style.height = `${Math.min(input.scrollHeight, 112)}px`
    })
  }

  const updateCallState = (nextState) => {
    setCallState((current) => {
      const updated = typeof nextState === 'function' ? nextState(current) : nextState
      callStateRef.current = updated
      return updated
    })
  }

  const toggleMicrophone = () => {
    const track = streamRef.current?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setIsMicMuted(!track.enabled)
  }

  const toggleCamera = () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setIsCameraOff(!track.enabled)
  }

  const attachRemoteMedia = (remoteStream) => {
    if (!remoteStream) return
    remoteStreamRef.current = remoteStream

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream
      remoteVideoRef.current.muted = true
      remoteVideoRef.current.playsInline = true
      remoteVideoRef.current.play().catch(() => {})
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream
      remoteAudioRef.current.muted = false
      remoteAudioRef.current.volume = 1
      remoteAudioRef.current.autoplay = true
      remoteAudioRef.current.play()
        .then(() => setSpeakerPlaybackBlocked(false))
        .catch((error) => {
          console.warn('Remote audio playback needs user interaction:', error.name)
          setSpeakerPlaybackBlocked(true)
        })
    }

    setCallState((current) => ({ ...current, remoteStream }))
  }

  const enableRemoteAudio = async () => {
    const audio = remoteAudioRef.current
    const remoteStream = callStateRef.current?.remoteStream || remoteStreamRef.current
    if (!audio || !remoteStream) return

    audio.srcObject = remoteStream
    audio.muted = false
    audio.volume = 1
    try {
      await audio.play()
      setSpeakerPlaybackBlocked(false)
    } catch (error) {
      console.error('Could not play remote call audio:', error)
      setSpeakerPlaybackBlocked(true)
    }
  }

  const setupCallPeer = async (remoteUserId, type) => {
    const { iceServers } = await apiFetch('/calls/ice-servers')
    const peerConnection = createPeerConnection(iceServers)
    if (!peerConnection) {
      alert('This browser does not support WebRTC calls.')
      return null
    }

    peerConnectionRef.current = peerConnection

    const stream = await navigator.mediaDevices.getUserMedia({
      video: type === 'video' ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      audio: true,
    })
    streamRef.current = stream

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream
      localVideoRef.current.muted = true
      localVideoRef.current.play().catch(() => {})
    }

    stream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, stream)
    })

    peerConnection.ontrack = (event) => {
      let remoteStream = event.streams?.[0]
      if (remoteStream) {
        remoteStreamRef.current = remoteStream
      } else if (event.track) {
        remoteStream = remoteStreamRef.current || new MediaStream()
        if (!remoteStream.getTracks().some((track) => track.id === event.track.id)) {
          remoteStream.addTrack(event.track)
        }
      }
      attachRemoteMedia(remoteStream)
    }

    peerConnection.onicecandidate = ({ candidate }) => {
      if (!candidate) return
      const socket = getSocket()
      socket?.emit('call:ice-candidate', {
        toUserId: remoteUserId,
        conversationId,
        candidate,
      })
    }

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'connected') {
        updateCallState((current) => current ? { ...current, active: true, phase: 'connected' } : current)
      }
      if (peerConnection.connectionState === 'failed') {
        const failedCall = callStateRef.current
        endCall(false)
        if (failedCall) updateCallState({ ...failedCall, active: false, phase: 'unavailable', remoteStream: null, offer: null })
      } else if (peerConnection.connectionState === 'closed') {
        endCall()
      }
    }

    return peerConnection
  }

  const endCall = (notifyRemote = true) => {
    stopCallRingtone()
    const socket = getSocket()
    const currentCall = callStateRef.current
    if (notifyRemote && currentCall?.remoteUserId) {
      socket?.emit('call:end', {
        toUserId: currentCall.remoteUserId,
        conversationId,
      })
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    stopCurrentStream()

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null
    }
    remoteStreamRef.current = null
    setSpeakerPlaybackBlocked(false)

    pendingIceCandidatesRef.current = []
    setCallDuration(0)
    setIsMicMuted(false)
    setIsCameraOff(false)
    updateCallState(null)
    window.dispatchEvent(new CustomEvent('privet:incoming-call-finished'))
  }

  const endCallFromEffect = useEffectEvent(() => endCall(false))
  const endUnansweredCall = useEffectEvent(() => endCall(true))

  useEffect(() => {
    if (!['incoming', 'ringing', 'dialing'].includes(callState?.phase)) return undefined
    const timeout = setTimeout(() => endUnansweredCall(), 45000)
    return () => clearTimeout(timeout)
  }, [callState?.phase, callState?.remoteUserId])

  const startCall = async (type) => {
    if (callStateRef.current) return
    if (!otherParticipantInfo?._id) {
      alert('Please select a valid contact to start a call.')
      return
    }

    try {
      const peerConnection = await setupCallPeer(otherParticipantInfo._id, type)
      if (!peerConnection) return

      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)

      updateCallState({
        active: true,
        incoming: false,
        phase: 'ringing',
        type,
        remoteUserId: otherParticipantInfo._id,
        remoteUserName: participantName,
      })

      const socket = getSocket()
      socket?.emit('call:offer', {
        toUserId: otherParticipantInfo._id,
        conversationId,
        offer,
        type,
      })
    } catch (error) {
      console.error('Could not start call:', error)
      endCall(false)
      alert('Could not access your microphone or camera. Check browser permissions and try again.')
    }
  }

  const startCallFromEffect = useEffectEvent((type) => startCall(type))

  useEffect(() => {
    const callType = searchParams.get('call')
    if (!callType) {
      autoCallRef.current = ''
      return
    }
    if (!['audio', 'video'].includes(callType) || !otherParticipantInfo?._id) return

    const requestKey = `${conversationId}:${callType}`
    if (autoCallRef.current === requestKey) return
    autoCallRef.current = requestKey
    setSearchParams({}, { replace: true })
    startCallFromEffect(callType)
  }, [conversationId, otherParticipantInfo?._id, searchParams, setSearchParams])

  const acceptCall = async () => {
    const incomingCall = callStateRef.current
    if (!incomingCall?.offer) return

    try {
      const peerConnection = await setupCallPeer(incomingCall.remoteUserId, incomingCall.type)
      if (!peerConnection) return

      await peerConnection.setRemoteDescription(new window.RTCSessionDescription(incomingCall.offer))
      for (const candidate of pendingIceCandidatesRef.current) {
        await peerConnection.addIceCandidate(new window.RTCIceCandidate(candidate))
      }
      pendingIceCandidatesRef.current = []

      const answer = await peerConnection.createAnswer()
      await peerConnection.setLocalDescription(answer)
      updateCallState((current) => ({ ...current, active: true, incoming: false, phase: 'connecting', offer: null }))

      getSocket()?.emit('call:answer', {
        toUserId: incomingCall.remoteUserId,
        conversationId,
        answer,
      })
    } catch (error) {
      console.error('Could not accept call:', error)
      endCall()
      alert('Could not connect the call. Check browser permissions and try again.')
    }
  }

  useEffect(() => {
    if (!conversationId) return undefined

    const socket = getSocket()
    if (!socket) return undefined

    socket.emit('conversation:join', conversationId)

    const handleIncomingMessage = (message) => {
      if (message.conversationId !== conversationId) return
      setMessages((current) => {
        if (current.some((item) => item._id === message._id)) {
          return current
        }
        return [...current, message]
      })
    }

    const handleTypingStart = ({ conversationId: roomId, userId }) => {
      if (roomId === conversationId && userId !== getCurrentUserId()) {
        setTypingUser('typing...')
      }
    }

    const handleTypingStop = ({ conversationId: roomId, userId }) => {
      if (roomId === conversationId && userId !== getCurrentUserId()) {
        setTypingUser(null)
      }
    }

    const updateReceipt = (messageIds, status, timestampField, timestamp) => {
      setMessages((current) =>
        current.map((message) => {
          if (!messageIds.some((id) => String(id) === message._id)) return message
          return { ...message, status, [timestampField]: timestamp }
        }),
      )
    }

    const handleMessageRead = ({ conversationId: roomId, messageIds = [], readAt }) => {
      if (roomId !== conversationId) return
      updateReceipt(messageIds, 'read', 'readAt', readAt || new Date().toISOString())
    }

    const handleMessageDelivered = ({ conversationId: roomId, messageIds = [], deliveredAt }) => {
      if (roomId !== conversationId) return
      updateReceipt(messageIds, 'delivered', 'deliveredAt', deliveredAt || new Date().toISOString())
    }

    const handleCallOffer = ({ fromUserId, conversationId: callConversationId, offer, type }) => {
      if (!fromUserId || !offer || callConversationId !== conversationId) return
      sessionStorage.removeItem('privet_pending_call')
      if (callStateRef.current) {
        socket.emit('call:end', { toUserId: fromUserId, conversationId })
        return
      }

      updateCallState({
        active: false,
        incoming: true,
        phase: 'incoming',
        type,
        offer,
        remoteUserId: fromUserId,
        remoteUserName: participantName,
      })
      window.dispatchEvent(new CustomEvent('privet:incoming-call-finished'))
    }

    const handleCallStatus = ({ conversationId: callConversationId, status: callStatus }) => {
      if (callConversationId !== conversationId || callStateRef.current?.incoming) return
      if (callStatus === 'ringing') {
        updateCallState((current) => current ? { ...current, phase: 'ringing' } : current)
      } else if (callStatus === 'unavailable') {
        stopCallRingtone()
        updateCallState((current) => current ? { ...current, phase: 'unavailable' } : current)
      }
    }

    const handleCallAnswer = async ({ fromUserId, conversationId: callConversationId, answer }) => {
      if (!peerConnectionRef.current || !answer || callConversationId !== conversationId) return
      await peerConnectionRef.current.setRemoteDescription(new window.RTCSessionDescription(answer))
      for (const candidate of pendingIceCandidatesRef.current) {
        await peerConnectionRef.current.addIceCandidate(new window.RTCIceCandidate(candidate))
      }
      pendingIceCandidatesRef.current = []
      updateCallState((current) => ({ ...current, active: true, phase: 'connecting', remoteUserId: fromUserId }))
    }

    const handleCallIce = async ({ conversationId: callConversationId, candidate }) => {
      if (!candidate || callConversationId !== conversationId) return
      if (!peerConnectionRef.current?.remoteDescription) {
        pendingIceCandidatesRef.current.push(candidate)
        return
      }
      try {
        await peerConnectionRef.current.addIceCandidate(new window.RTCIceCandidate(candidate))
      } catch (error) {
        console.error('Candidate error:', error)
      }
    }

    const handleCallEnd = ({ conversationId: callConversationId }) => {
      if (callConversationId === conversationId) endCallFromEffect()
    }

    socket.on('message:new', handleIncomingMessage)
    socket.on('typing:start', handleTypingStart)
    socket.on('typing:stop', handleTypingStop)
    socket.on('message:read', handleMessageRead)
    socket.on('message:delivered', handleMessageDelivered)
    socket.on('call:offer', handleCallOffer)
    socket.on('call:status', handleCallStatus)
    socket.on('call:answer', handleCallAnswer)
    socket.on('call:ice-candidate', handleCallIce)
    socket.on('call:end', handleCallEnd)

    try {
      const pendingCall = JSON.parse(sessionStorage.getItem('privet_pending_call') || 'null')
      if (pendingCall?.conversationId === conversationId) {
        handleCallOffer(pendingCall)
      }
    } catch {
      sessionStorage.removeItem('privet_pending_call')
    }

    return () => {
      socket.off('message:new', handleIncomingMessage)
      socket.off('typing:start', handleTypingStart)
      socket.off('typing:stop', handleTypingStop)
      socket.off('message:read', handleMessageRead)
      socket.off('message:delivered', handleMessageDelivered)
      socket.off('call:offer', handleCallOffer)
      socket.off('call:status', handleCallStatus)
      socket.off('call:answer', handleCallAnswer)
      socket.off('call:ice-candidate', handleCallIce)
      socket.off('call:end', handleCallEnd)
      socket.emit('typing:stop', { conversationId })
    }
  }, [conversationId, participantName])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-50">
      {callState && (
        <div className="fixed inset-0 z-50 h-[100dvh] overflow-hidden bg-slate-950 text-white shadow-inner shadow-slate-900/60">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.25),_transparent_35%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(17,24,39,0.92))]" />
          <audio ref={remoteAudioRef} autoPlay playsInline />

          <div className="relative flex h-full flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:py-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-200">
                  {callState.incoming ? 'Incoming call' : callState.phase === 'connected' ? 'Connected' : callState.phase === 'ringing' ? 'Ringing' : callState.phase === 'unavailable' ? 'Unavailable' : callState.phase === 'dialing' ? 'Calling' : 'Connecting'}
                </p>
                <h4 className="mt-1 text-xl font-semibold text-white">{callState.remoteUserName || participantName}</h4>
              </div>
              {callState.phase !== 'incoming' && (
                <button onClick={endCall} className="rounded-full bg-red-500 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-red-900/40 transition hover:scale-[1.03]">End</button>
              )}
            </div>

            <div className={`relative mx-auto mt-2 flex min-h-0 w-full max-w-5xl flex-1 items-center justify-center overflow-hidden bg-slate-900/70 shadow-[0_30px_80px_rgba(2,6,23,0.7)] transition-all duration-300 ${callState.type === 'video' ? 'rounded-2xl border border-white/10 p-0 sm:rounded-3xl' : 'min-h-[260px] rounded-3xl border border-white/10 p-4 sm:min-h-[320px]'}`}>
              {callState.type === 'video' ? (
                <>
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-sky-500/10" />
                  <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 h-full w-full bg-slate-900 object-cover" />
                  <video ref={localVideoRef} autoPlay muted playsInline className="absolute bottom-3 right-3 h-20 w-16 rounded-xl border-2 border-white/70 bg-slate-800 object-cover shadow-lg shadow-slate-950/60 sm:bottom-5 sm:right-5 sm:h-32 sm:w-24" />
                </>
              ) : (
                <div className="relative flex w-full flex-col items-center justify-center py-8 text-center">
                  <div className={`relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 text-5xl font-bold text-white shadow-[0_0_40px_rgba(16,185,129,0.5)] ${callState.phase === 'incoming' || callState.phase === 'dialing' ? 'animate-pulse' : ''}`}>
                    <span className="absolute inset-0 rounded-full border-4 border-emerald-300/60 animate-ping" />
                    {callState.remoteUserName?.charAt(0)?.toUpperCase() || participantInitial}
                  </div>
                  <p className="mt-6 text-2xl font-semibold text-slate-100">
                    {callState.phase === 'incoming' ? 'Incoming audio call' : callState.phase === 'connected' ? 'Audio call connected' : callState.phase === 'ringing' ? 'Ringing...' : callState.phase === 'unavailable' ? 'Contact is unavailable' : callState.phase === 'dialing' ? 'Calling...' : 'Connecting...'}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {callState.phase === 'incoming' ? 'Tap to answer' : callState.phase === 'connected' ? callState.remoteStream?.getAudioTracks().some((track) => track.readyState === 'live') ? `Audio connected · ${formatDuration(callDuration)}` : `Waiting for contact audio · ${formatDuration(callDuration)}` : callState.phase === 'unavailable' ? 'Try again later' : 'Waiting for your contact'}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 flex shrink-0 items-center justify-center gap-3 pb-1">
              {callState.incoming ? (
                <>
                  <button onClick={acceptCall} aria-label="Accept call" className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 transition hover:scale-[1.04]"><Phone size={22} /></button>
                  <button onClick={() => endCall()} aria-label="Decline call" className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-900/40 transition hover:scale-[1.04]"><PhoneOff size={22} /></button>
                </>
              ) : callState.phase === 'connected' ? (
                <>
                  <button onClick={enableRemoteAudio} aria-label={speakerPlaybackBlocked ? 'Enable call sound' : 'Retry call sound'} title={speakerPlaybackBlocked ? 'Enable call sound' : 'Retry call sound'} className={`flex h-12 w-12 items-center justify-center rounded-full transition ${speakerPlaybackBlocked ? 'bg-amber-300 text-slate-900' : 'bg-white/15 text-white hover:bg-white/25'}`}>
                    {speakerPlaybackBlocked ? <VolumeX size={19} /> : <Volume2 size={19} />}
                  </button>
                  <button onClick={toggleMicrophone} aria-label={isMicMuted ? 'Unmute microphone' : 'Mute microphone'} title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'} className={`flex h-12 w-12 items-center justify-center rounded-full transition ${isMicMuted ? 'bg-white text-slate-900' : 'bg-white/15 text-white hover:bg-white/25'}`}>
                    {isMicMuted ? <MicOff size={19} /> : <Mic size={19} />}
                  </button>
                  {callState.type === 'video' && (
                    <button onClick={toggleCamera} aria-label={isCameraOff ? 'Turn camera on' : 'Turn camera off'} title={isCameraOff ? 'Turn camera on' : 'Turn camera off'} className={`flex h-12 w-12 items-center justify-center rounded-full transition ${isCameraOff ? 'bg-white text-slate-900' : 'bg-white/15 text-white hover:bg-white/25'}`}>
                      {isCameraOff ? <VideoOff size={19} /> : <Video size={19} />}
                    </button>
                  )}
                  <div className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white">
                    {formatDuration(callDuration)}
                  </div>
                  <button onClick={endCall} aria-label="End call" className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-900/40 transition hover:scale-[1.04]"><PhoneOff size={22} /></button>
                </>
              ) : (
                <button onClick={endCall} aria-label="Cancel call" className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-900/40 transition hover:scale-[1.04]"><PhoneOff size={22} /></button>
              )}
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-emerald-100 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur-sm sm:px-4 sm:py-3">
        <div className="flex items-center gap-3">
          <button className="rounded-xl p-2 text-slate-600 hover:bg-slate-100" aria-label="Back" onClick={() => window.history.back()}>
            <ArrowLeft size={18} />
          </button>

          <div className="relative">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 font-semibold text-white">
              {participantInitial}
            </div>
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
          </div>

          <div>
            <h3 className="font-semibold text-slate-800">{participantName}</h3>
            <p className="text-xs text-emerald-600">{conversation?.type === 'group' ? `${conversation.participants.length} members` : otherParticipantInfo?.isOnline ? 'Online now' : 'Offline'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => startCall('audio')} disabled={conversation?.type === 'group'} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40" aria-label="Audio call">
            <Phone size={18} />
          </button>
          <button onClick={() => startCall('video')} disabled={conversation?.type === 'group'} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40" aria-label="Video call">
            <Video size={18} />
          </button>
          <button onClick={() => setIsMobileMenuOpen((current) => !current)} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100" aria-label="More options">
            <MoreVertical size={18} />
          </button>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="border-b border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
          <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
            <span>Chat options</span>
            <button onClick={() => startCall('audio')} className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">
              Call
            </button>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4 sm:py-5">
        {loading ? (
          <div className="text-sm text-slate-500">Loading messages…</div>
        ) : (
          messages.map((message, index) => {
            const isMine = message.senderId?._id === getCurrentUserId()
            const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

            return (
              <div key={message._id || `${message.createdAt}-${index}`} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[84%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm sm:max-w-[72%] ${
                    isMine ? 'rounded-br-md bg-[#d9fdd3] text-slate-800' : 'rounded-bl-md bg-white text-slate-700'
                  }`}
                >
                  {message.type === 'audio' || message.attachment?.mimeType?.startsWith('audio/') ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-medium opacity-90">
                        <Mic size={14} />
                        Voice note
                      </div>
                      <audio controls src={message.attachment?.storageUrl} className="w-full max-w-[220px]" />
                      <div className="text-[10px] opacity-80">{time}</div>
                    </div>
                  ) : message.type === 'video' || message.attachment?.mimeType?.startsWith('video/') ? (
                    <div className="space-y-2">
                      <video controls src={message.attachment?.storageUrl} className="max-h-60 max-w-full rounded-xl" />
                      <div className="text-[10px] text-slate-500">{time}</div>
                    </div>
                  ) : message.type === 'image' || message.attachment?.mimeType?.startsWith('image/') ? (
                    <div className="space-y-2">
                      <img src={message.attachment?.storageUrl} alt={message.text || 'Attachment'} className="max-h-60 rounded-xl object-cover" />
                      {message.text && <div>{message.text}</div>}
                      <div className="text-[10px] text-slate-500">
                        {time}
                      </div>
                    </div>
                  ) : message.type === 'file' || message.attachment ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-medium opacity-90">
                        <Paperclip size={14} />
                        <a href={message.attachment?.storageUrl} target="_blank" rel="noreferrer" download={message.attachment?.filename} className="underline underline-offset-2">
                          {message.attachment?.filename || message.text || 'File'}
                        </a>
                      </div>
                      {message.text && <div>{message.text}</div>}
                      <div className="text-[10px] text-slate-500">
                        {time}
                      </div>
                    </div>
                  ) : (
                    <>
                      {message.text}
                      <div className="mt-1 text-[10px] text-slate-500">
                        {time}
                      </div>
                    </>
                  )}

                  {isMine && (
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500">
                      <span>{time}</span>
                      {message.status === 'read' ? <CheckCheck size={15} className="text-sky-600" aria-label="Read" /> : message.status === 'delivered' ? <CheckCheck size={15} aria-label="Delivered" /> : <Check size={15} aria-label="Sent" />}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}

        {draftAudioUrl && (
          <div className="flex justify-end">
            <div className="w-full max-w-[280px] rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-slate-700 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700">
                  <Mic size={14} />
                  Recorded audio
                </div>
                <button onClick={clearDraftAudio} className="rounded-lg p-1 text-slate-500 hover:bg-white" aria-label="Discard audio">
                  <Trash2 size={14} />
                </button>
              </div>
              <audio controls src={draftAudioUrl} className="w-full" />
              <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                <span>{formatDuration(draftAudioDuration)}</span>
                <div className="flex gap-2">
                  <button onClick={clearDraftAudio} className="rounded-xl border border-slate-200 bg-white px-2 py-1 font-medium text-slate-600">
                    Delete
                  </button>
                  <button onClick={handleSendAudio} className="rounded-xl bg-indigo-600 px-2 py-1 font-medium text-white hover:bg-indigo-500">
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="z-20 shrink-0 border-t border-slate-200 bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 sm:px-4">
        <div className="mb-2 flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100"
          >
            <Paperclip size={12} /> Attach
          </button>
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition ${isRecording ? 'bg-red-500 text-white hover:bg-red-400' : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
          >
            {isRecording ? <StopCircle size={12} /> : <Mic size={12} />}
            {isRecording ? 'Stop' : 'Voice'}
          </button>
          <button onClick={() => setShowEmojiPicker((current) => !current)} aria-label="Choose emoji" aria-expanded={showEmojiPicker} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100">
            <Smile size={12} /> Emojis
          </button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileAttach} />
        </div>

        {showEmojiPicker && (
          <div className="mb-2 grid grid-cols-8 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg" aria-label="Emoji picker">
            {commonEmojis.map((emoji) => (
              <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} className="rounded-lg p-1.5 text-xl hover:bg-emerald-50" aria-label={`Insert ${emoji}`}>{emoji}</button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2.5 rounded-[22px] border border-slate-200 bg-slate-50 px-2.5 py-2 shadow-inner shadow-slate-200/40">
          <textarea
            ref={messageInputRef}
            rows={1}
            className="max-h-28 min-h-[42px] flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 text-slate-700 outline-none placeholder:text-slate-400"
            placeholder="Type a message"
            value={draftText}
            onChange={(event) => {
              const nextValue = event.target.value
              handleTyping(nextValue)
              event.target.style.height = 'auto'
              event.target.style.height = `${Math.min(event.target.scrollHeight, 112)}px`
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                handleSendText()
              }
            }}
            onFocus={() => {
              const socket = getSocket()
              if (socket && conversationId && draftText.trim()) {
                socket.emit('typing:start', { conversationId })
              }
            }}
          />
          <button onClick={handleSendText} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-200 transition hover:from-emerald-600 hover:to-emerald-500" aria-label="Send message">
            <Send size={18} />
          </button>
        </div>

        {typingUser && <div className="mt-2 text-sm font-medium text-emerald-600">{typingUser}</div>}

        {isRecording && (
          <div className="mt-2 flex items-center gap-2 text-sm font-medium text-red-600">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            Recording {formatDuration(recordingSeconds)}
          </div>
        )}
      </div>
    </div>
  )
}

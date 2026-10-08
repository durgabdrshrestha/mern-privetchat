import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { MessageSquareText, UserRound, Settings, Phone, Video, Bell, LogOut, Check, MoreVertical, Users, CircleDot, Wrench, PhoneOff } from 'lucide-react'
import { getCurrentUser, getCurrentUserId, logout } from '../../services/api'
import { getSocket, disconnectSocket } from '../../services/socket'
import { playMessageNotification, startCallRingtone, stopCallRingtone, unlockCallAudio } from '../../services/callRingtone'
import BrandLogo from '../brand/BrandLogo'

const navItems = [
  { to: '/chats', label: 'Chats', icon: MessageSquareText },
  { to: '/calls', label: 'Calls', icon: Phone },
  { to: '/tools', label: 'Tools', icon: Wrench },
  { to: '/updates', label: 'Updates', icon: CircleDot },
]

export default function AppShell({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [showNotifications, setShowNotifications] = useState(false)
  const [showAppMenu, setShowAppMenu] = useState(false)
  const [incomingCall, setIncomingCall] = useState(null)
  const [status, setStatus] = useState('Ready to chat')
  const [notifications, setNotifications] = useState([])
  const [currentUser, setCurrentUserState] = useState(() => getCurrentUser())

  useEffect(() => {
    const handleUserUpdated = (event) => setCurrentUserState(event.detail || getCurrentUser())
    window.addEventListener('privet:user-updated', handleUserUpdated)
    return () => window.removeEventListener('privet:user-updated', handleUserUpdated)
  }, [])

  useEffect(() => {
    const unlockAudio = () => unlockCallAudio()
    window.addEventListener('pointerdown', unlockAudio, { once: true })
    window.addEventListener('keydown', unlockAudio, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
    }
  }, [])

  useEffect(() => {
    const handleIncomingCallFinished = () => {
      setIncomingCall(null)
      stopCallRingtone()
    }
    window.addEventListener('privet:incoming-call-finished', handleIncomingCallFinished)
    return () => window.removeEventListener('privet:incoming-call-finished', handleIncomingCallFinished)
  }, [])

  useEffect(() => {
    if (!incomingCall) return undefined

    const timeout = setTimeout(() => {
      getSocket()?.emit('call:end', {
        toUserId: incomingCall.fromUserId,
        conversationId: incomingCall.conversationId,
      })
      sessionStorage.removeItem('privet_pending_call')
      setIncomingCall(null)
      stopCallRingtone()
      setStatus('Missed call')
    }, 45000)

    return () => clearTimeout(timeout)
  }, [incomingCall])

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return undefined

    const handleIncomingMessage = (message) => {
      if (message.senderId?._id === getCurrentUserId()) return
      if (getCurrentUser()?.preferences?.notifications?.messages === false) return
      playMessageNotification()
      const notification = {
        id: message._id,
        label: `${message.senderId?.name || 'A contact'} sent a message`,
        conversationId: message.conversationId,
      }
      setNotifications((current) => current.some((item) => item.id === notification.id)
        ? current
        : [notification, ...current].slice(0, 8))
      setStatus('New message received')
    }

    const handleIncomingCall = (payload) => {
      if (!payload?.conversationId) return
      if (location.pathname !== `/chats/${payload.conversationId}`) {
        sessionStorage.setItem('privet_pending_call', JSON.stringify(payload))
      }
      setIncomingCall(payload)
      startCallRingtone('incoming')
      const notification = {
        id: `call-${payload.conversationId}-${payload.fromUserId}`,
        label: `Incoming ${payload.type || 'audio'} call${payload.fromUserName ? ` from ${payload.fromUserName}` : ''}`,
        conversationId: payload.conversationId,
      }
      if (getCurrentUser()?.preferences?.notifications?.calls !== false) {
        setNotifications((current) => [notification, ...current.filter((item) => item.id !== notification.id)].slice(0, 8))
      }
      setStatus(`Incoming ${payload.type || 'audio'} call`)
    }

    const handleCallEnd = ({ conversationId: endedConversationId, fromUserId }) => {
      setIncomingCall((current) => {
        if (current?.conversationId !== endedConversationId || (fromUserId && current.fromUserId !== fromUserId)) return current
        stopCallRingtone()
        sessionStorage.removeItem('privet_pending_call')
        return null
      })
    }

    socket.on('message:new', handleIncomingMessage)
    socket.on('call:offer', handleIncomingCall)
    socket.on('call:end', handleCallEnd)

    return () => {
      socket.off('message:new', handleIncomingMessage)
      socket.off('call:offer', handleIncomingCall)
      socket.off('call:end', handleCallEnd)
    }
  }, [location.pathname])

  const answerIncomingCall = () => {
    if (!incomingCall) return
    stopCallRingtone()
    const conversationId = incomingCall.conversationId
    setIncomingCall(null)
    navigate(`/chats/${conversationId}`)
  }

  const declineIncomingCall = () => {
    if (!incomingCall) return
    getSocket()?.emit('call:end', {
      toUserId: incomingCall.fromUserId,
      conversationId: incomingCall.conversationId,
    })
    sessionStorage.removeItem('privet_pending_call')
    setIncomingCall(null)
    stopCallRingtone()
  }

  const handleCallAction = (type) => {
    setStatus(`Open a conversation to start an ${type} call`)
    navigate('/chats')
  }

  const handleLogout = () => {
    sessionStorage.removeItem('privet_pending_call')
    logout()
    disconnectSocket()
    navigate('/')
  }

  return (
    <div className="h-[100dvh] overflow-hidden bg-[linear-gradient(180deg,_#eefaf4_0%,_#f8faf9_100%)] text-slate-800">
      <div className="mx-auto flex h-full min-h-0 max-w-7xl flex-col lg:flex-row">
        <header className="z-30 shrink-0 border-b border-emerald-100 bg-white shadow-sm lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <div className="flex items-center gap-2.5">
              <BrandLogo className="h-9 w-9" />
              <h1 className="text-lg font-bold text-emerald-800">Privet Chat</h1>
            </div>
            <div className="flex items-center gap-1 text-slate-600">
              <button onClick={() => navigate('/calls')} className="rounded-full p-2.5 hover:bg-emerald-50" aria-label="Start a video call"><Video size={20} /></button>
              <button onClick={() => setShowAppMenu((current) => !current)} className="rounded-full p-2.5 hover:bg-slate-100" aria-label="Open app menu" aria-expanded={showAppMenu}><MoreVertical size={20} /></button>
            </div>
          </div>
          {showAppMenu && (
            <div className="absolute right-3 top-12 z-50 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
              <button onClick={() => { setShowAppMenu(false); navigate('/chats?newGroup=1') }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"><Users size={17} /> New group</button>
              <button onClick={() => { setShowAppMenu(false); navigate('/chats') }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"><MessageSquareText size={17} /> Chat list</button>
              <button onClick={() => { setShowAppMenu(false); navigate('/profile') }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"><UserRound size={17} /> Profile</button>
              <button onClick={() => { setShowAppMenu(false); navigate('/settings') }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"><Settings size={17} /> Settings</button>
              <div className="my-1 border-t border-slate-100" />
              <button onClick={() => { setShowAppMenu(false); handleLogout() }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-red-700 hover:bg-red-50"><LogOut size={17} /> Log out</button>
            </div>
          )}
        </header>
        <aside className="hidden border-b border-emerald-100 bg-[#f4faf7] shadow-sm shadow-emerald-100/60 lg:block lg:min-h-screen lg:w-80 lg:border-b-0 lg:border-r">
          <div className="sticky top-0 z-20 flex items-center justify-between border-b border-emerald-100 bg-white/90 px-4 py-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <BrandLogo className="h-11 w-11" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-emerald-600">Privet</p>
                <h1 className="text-xl font-extrabold text-slate-800">Connect</h1>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <button onClick={() => handleCallAction('audio')} className="rounded-xl p-2.5 transition hover:bg-emerald-50 hover:text-emerald-700" aria-label="Calls"><Phone size={18} /></button>
              <button onClick={() => handleCallAction('video')} className="rounded-xl p-2.5 transition hover:bg-emerald-50 hover:text-emerald-700" aria-label="Video calls"><Video size={18} /></button>
              <button onClick={() => setShowNotifications((current) => !current)} className="relative rounded-xl p-2.5 transition hover:bg-emerald-50 hover:text-emerald-700" aria-label="Notifications">
                <Bell size={18} />
                {notifications.length > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">{notifications.length}</span>
                )}
              </button>
            </div>
          </div>

          {showNotifications && (
            <div className="mx-4 mt-3 rounded-2xl border border-emerald-100 bg-white p-3 shadow-lg shadow-slate-200/40">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Notifications</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setNotifications([])} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Clear notifications">
                    <Check size={16} />
                  </button>
                  <button onClick={handleLogout} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Logout">
                    <LogOut size={16} />
                  </button>
                </div>
              </div>
              <div className="space-y-2 text-sm text-slate-600">
                {notifications.length ? notifications.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setShowNotifications(false)
                      if (item.conversationId) navigate(`/chats/${item.conversationId}`)
                    }}
                    className="block w-full rounded-xl bg-emerald-50 px-3 py-2 text-left transition hover:bg-emerald-100"
                  >
                    {item.label}
                  </button>
                )) : (
                  <p className="px-2 py-3 text-sm text-slate-500">You are all caught up.</p>
                )}
              </div>
            </div>
          )}

          <div className="px-4 pb-3 pt-3 text-sm text-slate-600">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-3 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 font-bold text-white shadow-lg shadow-emerald-300/40">
                  {(currentUser?.name || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{currentUser?.name || 'User'}</p>
                  <p className="text-xs text-emerald-600">Online</p>
                </div>
              </div>
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]" />
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto px-4 py-4 lg:flex-col">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-200'
                      : 'text-slate-600 hover:bg-emerald-50'
                  }`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="px-4 pb-4">
            <NavLink to="/profile" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-600 hover:bg-emerald-50"><UserRound size={18} /> Profile</NavLink>
            <NavLink to="/settings" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-600 hover:bg-emerald-50"><Settings size={18} /> Settings</NavLink>
          </div>
        </aside>

        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
          <div className="sticky top-0 z-10 hidden shrink-0 border-b border-emerald-100 bg-white/85 px-4 py-3 text-sm font-medium text-emerald-700 backdrop-blur-sm lg:block">
            {status}
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children || null}</div>
        </main>
      </div>
      <nav aria-label="Primary navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="grid h-16 grid-cols-4">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `flex flex-col items-center justify-center gap-1 text-[11px] ${isActive || (to === '/chats' && location.pathname.startsWith('/chats/')) ? 'text-emerald-700' : 'text-slate-500'}`}>
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
      {incomingCall && location.pathname !== `/chats/${incomingCall.conversationId}` && (
        <div className="fixed inset-x-3 top-16 z-[60] mx-auto max-w-md rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xl shadow-slate-900/20 sm:top-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 animate-pulse items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Phone size={20} /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Incoming {incomingCall.type || 'audio'} call</p>
              <p className="truncate font-semibold text-slate-900">{incomingCall.fromUserName || 'A contact is calling'}</p>
            </div>
            <button onClick={answerIncomingCall} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Answer</button>
            <button onClick={declineIncomingCall} aria-label="Decline call" className="rounded-full bg-red-50 p-2.5 text-red-700 hover:bg-red-100"><PhoneOff size={18} /></button>
          </div>
        </div>
      )}
    </div>
  )
}

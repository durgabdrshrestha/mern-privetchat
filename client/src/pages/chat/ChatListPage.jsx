import { useEffect, useMemo, useState } from 'react'
import { MessageCircleMore, Search, Phone, Video, Users, Settings, UserRound, X, Plus, Archive, ArchiveRestore, Trash2 } from 'lucide-react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch, getCurrentUser, getCurrentUserId } from '../../services/api'

const getRelativeTime = (value) => {
  if (!value) return ''

  const date = new Date(value)
  const diffMinutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000))

  if (diffMinutes < 1) return 'now'
  if (diffMinutes < 60) return `${diffMinutes}m`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h`

  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d`

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const getPreviewText = (message) => {
  if (!message) return 'No messages yet'
  if (message.type === 'audio') return 'Voice note'
  if (message.type === 'image') return 'Photo'
  if (message.type === 'video') return 'Video'
  if (message.type === 'file') return message.attachment?.filename || 'File'
  return message.text || 'New message'
}

export default function ChatListPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const currentUser = getCurrentUser()
  const [conversations, setConversations] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [hiddenUserIds, setHiddenUserIds] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [groupName, setGroupName] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState([])
  const [groupError, setGroupError] = useState('')
  const view = location.pathname === '/calls' ? 'calls' : location.pathname === '/updates' ? 'updates' : location.pathname === '/tools' ? 'tools' : 'chats'
  const archivedView = view === 'chats' && searchParams.get('filter') === 'archived'
  const showGroupDialog = searchParams.get('newGroup') === '1'

  useEffect(() => {
    let isCurrent = true

    Promise.all([
      apiFetch(`/conversations${archivedView ? '?view=archived' : ''}`),
      apiFetch('/conversations/users/search?query=' + encodeURIComponent(search || '')),
    ])
      .then(([conversationData, usersData]) => {
        if (!isCurrent) return
        setConversations(conversationData)
        setAllUsers(usersData)
      })
      .catch((error) => console.error(error))
      .finally(() => {
        if (isCurrent) setLoading(false)
      })

    return () => {
      isCurrent = false
    }
  }, [search, archivedView])

  const visibleUsers = useMemo(() => {
    const conversationUserIds = new Set(conversations.flatMap((conversation) => conversation.participants.map((person) => person._id || person)))
    const hiddenUsers = new Set(hiddenUserIds)
    return allUsers.filter((user) => !conversationUserIds.has(user._id) && (!hiddenUsers.has(user._id) || search.trim()))
  }, [allUsers, conversations, hiddenUserIds, search])

  const startConversation = async (receiverId, callType = '') => {
    try {
      const conversation = await apiFetch('/conversations', {
        method: 'POST',
        body: { receiverId },
      })

      const conversationId = conversation._id || conversation.id
      setHiddenUserIds((current) => current.filter((id) => id !== receiverId))
      navigate(`/chats/${conversationId}${callType ? `?call=${callType}` : ''}`)
    } catch (error) {
      console.error('Could not start conversation:', error)
    }
  }

  const createGroup = async () => {
    setGroupError('')
    try {
      const conversation = await apiFetch('/conversations/groups', {
        method: 'POST',
        body: { name: groupName, participantIds: selectedUserIds },
      })
      setGroupName('')
      setSelectedUserIds([])
      setSearchParams({})
      navigate(`/chats/${conversation._id}`)
    } catch (error) {
      setGroupError(error.message || 'Could not create group')
    }
  }

  const toggleGroupMember = (userId) => {
    setSelectedUserIds((current) => current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId])
  }

  const updateArchivedChat = async (conversation, archived) => {
    try {
      await apiFetch(`/conversations/${conversation._id}/archive`, {
        method: 'PATCH',
        body: { archived },
      })
      setConversations((current) => current.filter((item) => item._id !== conversation._id))
    } catch (error) {
      console.error('Could not update archived chat:', error)
    }
  }

  const hideChat = async (conversation) => {
    if (!window.confirm('Delete this chat from your list? Other members keep their copy.')) return

    try {
      await apiFetch(`/conversations/${conversation._id}`, { method: 'DELETE' })
      setConversations((current) => current.filter((item) => item._id !== conversation._id))
      const otherIds = conversation.participants
        .map((person) => String(person._id || person))
        .filter((id) => id !== String(getCurrentUserId()))
      setHiddenUserIds((current) => [...new Set([...current, ...otherIds])])
    } catch (error) {
      console.error('Could not remove chat:', error)
    }
  }

  const title = view === 'calls' ? 'Calls' : view === 'updates' ? 'Updates' : view === 'tools' ? 'Tools' : 'Chats'

  return (
    <div className="flex h-full flex-col bg-[#f8faf9]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-emerald-100 bg-[#f5faf7]/95 px-4 py-3 backdrop-blur-sm sm:px-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-600">Privet Chat</p>
          <h2 className="text-lg font-bold text-slate-800 sm:text-2xl">{archivedView ? 'Archived' : title}</h2>
        </div>
        <button onClick={() => { setGroupError(''); setSearchParams({ newGroup: '1' }) }} className="rounded-2xl bg-emerald-600 p-2.5 text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-500" aria-label="Create new group">
          <MessageCircleMore size={18} />
        </button>
      </header>

      <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-500 shadow-sm shadow-slate-200/40">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => {
              setLoading(true)
              setSearch(event.target.value)
            }}
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            placeholder="Search conversations or people"
          />
        </div>
      </div>

      {view === 'chats' && (
        <div className="flex shrink-0 gap-2 border-b border-slate-200 px-4 py-2 sm:px-5">
          <button onClick={() => setSearchParams({})} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${!archivedView ? 'bg-emerald-100 text-emerald-800' : 'text-slate-500 hover:bg-slate-100'}`}>Chats</button>
          <button onClick={() => setSearchParams({ filter: 'archived' })} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${archivedView ? 'bg-emerald-100 text-emerald-800' : 'text-slate-500 hover:bg-slate-100'}`}><Archive size={13} className="mr-1 inline" />Archived</button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Loading conversations…</div>
      ) : view === 'calls' ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Start a call</div>
          {allUsers.map((user) => (
            <div key={user._id} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100 font-semibold text-emerald-800">{user.profilePhoto ? <img src={user.profilePhoto} alt="" className="h-full w-full object-cover" /> : (user.name || 'U').charAt(0).toUpperCase()}</div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{user.name}</p><p className="text-xs text-slate-500">{user.isOnline ? 'Available now' : 'Call by message'}</p></div>
              <button onClick={() => startConversation(user._id, 'audio')} className="rounded-full p-2 text-emerald-700 hover:bg-emerald-50" aria-label={`Audio call ${user.name}`}><Phone size={19} /></button>
              <button onClick={() => startConversation(user._id, 'video')} className="rounded-full p-2 text-emerald-700 hover:bg-emerald-50" aria-label={`Video call ${user.name}`}><Video size={19} /></button>
            </div>
          ))}
        </div>
      ) : view === 'updates' ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <button onClick={() => navigate('/profile')} className="flex w-full items-center gap-3 border-b border-slate-200 bg-white px-4 py-4 text-left">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-lg font-semibold text-emerald-800">{currentUser?.profilePhoto ? <img src={currentUser.profilePhoto} alt="" className="h-full w-full object-cover" /> : (currentUser?.name || 'U').charAt(0).toUpperCase()}</div>
            <div><p className="text-sm font-semibold text-slate-800">{currentUser?.name || 'My profile status'}</p><p className="text-xs text-slate-500">{currentUser?.bio || currentUser?.status || 'Edit your availability and about text'}</p></div>
            <Plus size={18} className="ml-auto text-emerald-700" />
          </button>
          <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Contacts</div>
          {allUsers.map((user) => (
            <button key={user._id} onClick={() => startConversation(user._id)} className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-white">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100 font-semibold text-emerald-800">{user.profilePhoto ? <img src={user.profilePhoto} alt="" className="h-full w-full object-cover" /> : (user.name || 'U').charAt(0).toUpperCase()}</div>
              <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{user.name}</p><p className="truncate text-xs text-slate-500">{user.bio || user.status || (user.isOnline ? 'Online' : 'Offline')}</p></div>
            </button>
          ))}
        </div>
      ) : view === 'tools' ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            <button onClick={() => { setGroupError(''); setSearchParams({ newGroup: '1' }) }} className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-slate-50"><Users size={19} className="text-emerald-700" /><span><span className="block text-sm font-semibold text-slate-800">New group</span><span className="text-xs text-slate-500">Start a group conversation</span></span></button>
            <button onClick={() => navigate('/profile')} className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-slate-50"><UserRound size={19} className="text-emerald-700" /><span><span className="block text-sm font-semibold text-slate-800">Profile</span><span className="text-xs text-slate-500">Edit your name, photo, and about</span></span></button>
            <button onClick={() => navigate('/settings')} className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-slate-50"><Settings size={19} className="text-emerald-700" /><span><span className="block text-sm font-semibold text-slate-800">Settings</span><span className="text-xs text-slate-500">Notifications, privacy, and password</span></span></button>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain divide-y divide-slate-200">
          {!archivedView && visibleUsers.length > 0 && (
            <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:px-5">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                <Users size={14} /> People online & offline
              </div>
              <div className="space-y-2.5">
                {visibleUsers.map((user) => {
                  const isOnline = user.isOnline && user.preferences?.privacy?.showOnlineStatus !== false

                  return (
                    <div key={user._id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm shadow-slate-200/30">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 text-sm font-bold text-white">
                            {(user.name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{user.name}</p>
                          <p className="text-xs text-slate-500">{isOnline ? 'Online' : 'Offline'} • @{user.username}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => startConversation(user._id)}
                        className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500"
                      >
                        Message
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {conversations.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-500">
              {archivedView ? 'No archived chats.' : 'No conversations yet. Start messaging someone from the people list above.'}
            </div>
          ) : (
            conversations.map((conversation) => {
              const currentUserId = getCurrentUserId()
              const otherUser = conversation.participants.find((person) => person._id !== currentUserId)
              const conversationTitle = conversation.type === 'group' ? conversation.name : otherUser?.name
              const lastMessage = conversation.lastMessage
              const isOnline = otherUser?.isOnline && otherUser?.preferences?.privacy?.showOnlineStatus !== false
              const previewText = getPreviewText(lastMessage)
              const unreadCount = conversation.unreadCount || 0

              return (
                <div key={conversation._id} className="flex items-center gap-2 px-3 py-3 transition hover:bg-slate-50 sm:px-5">
                  <Link to={`/chats/${conversation._id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="relative shrink-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white shadow-sm shadow-emerald-200">
                      {conversation.type === 'group' ? <Users size={19} /> : (otherUser?.name || 'U').charAt(0).toUpperCase()}
                    </div>
                    {isOnline && <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[15px] font-semibold text-slate-800">{conversationTitle || 'Unknown user'}</p>
                      <span className="shrink-0 text-[11px] text-slate-400">{getRelativeTime(lastMessage?.createdAt)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <p className="truncate text-sm text-slate-500">{previewText}</p>
                      {unreadCount > 0 && (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="hidden gap-2 text-slate-500 sm:flex">
                    <button onClick={(event) => { event.preventDefault(); event.stopPropagation(); navigate(`/chats/${conversation._id}`) }} className="rounded-lg p-2 hover:bg-slate-100"><Phone size={15} /></button>
                    <button onClick={(event) => { event.preventDefault(); event.stopPropagation(); navigate(`/chats/${conversation._id}`) }} className="rounded-lg p-2 hover:bg-slate-100"><Video size={15} /></button>
                  </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1 text-slate-500">
                    <button onClick={() => updateArchivedChat(conversation, !archivedView)} className="rounded-lg p-2 hover:bg-emerald-50 hover:text-emerald-700" aria-label={archivedView ? 'Restore chat' : 'Archive chat'} title={archivedView ? 'Restore chat' : 'Archive chat'}>
                      {archivedView ? <ArchiveRestore size={17} /> : <Archive size={17} />}
                    </button>
                    <button onClick={() => hideChat(conversation)} className="rounded-lg p-2 hover:bg-red-50 hover:text-red-700" aria-label="Delete chat for me" title="Delete chat for me"><Trash2 size={17} /></button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {showGroupDialog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="new-group-title">
          <div className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-xl">
            <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div><h3 id="new-group-title" className="font-semibold text-slate-900">New group</h3><p className="text-xs text-slate-500">Select at least two people</p></div>
              <button onClick={() => setSearchParams({})} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
            </header>
            <div className="space-y-3 p-4">
              <input value={groupName} onChange={(event) => setGroupName(event.target.value)} maxLength={60} placeholder="Group name" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
              {groupError && <p role="alert" className="text-sm text-red-600">{groupError}</p>}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto border-y border-slate-100">
              {allUsers.map((user) => (
                <label key={user._id} className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  <input type="checkbox" checked={selectedUserIds.includes(user._id)} onChange={() => toggleGroupMember(user._id)} className="h-4 w-4 accent-emerald-700" />
                  <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800">{user.profilePhoto ? <img src={user.profilePhoto} alt="" className="h-full w-full object-cover" /> : (user.name || 'U').charAt(0).toUpperCase()}</span>
                  <span className="text-sm font-medium text-slate-800">{user.name}</span>
                </label>
              ))}
            </div>
            <footer className="flex items-center justify-between gap-3 p-4">
              <span className="text-xs text-slate-500">{selectedUserIds.length} selected</span>
              <button onClick={createGroup} disabled={groupName.trim().length < 2 || selectedUserIds.length < 2} className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Create group</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}

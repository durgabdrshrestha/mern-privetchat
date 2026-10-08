import { useEffect, useRef, useState } from 'react'
import { Camera, Save, UserRound } from 'lucide-react'
import { apiFetch, getCurrentUser, setCurrentUser } from '../../services/api'

const getInitials = (name) => (name || 'User')
  .split(' ')
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0].toUpperCase())
  .join('') || 'U'

export default function ProfilePage() {
  const [user, setUser] = useState(getCurrentUser())
  const [form, setForm] = useState({ name: '', username: '', bio: '', status: 'Online' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [feedback, setFeedback] = useState('')
  const fileInputRef = useRef(null)

  const applyUser = (nextUser) => {
    const cachedUser = {
      id: nextUser.id || nextUser._id,
      name: nextUser.name,
      username: nextUser.username,
      email: nextUser.email,
      profilePhoto: nextUser.profilePhoto || '',
      bio: nextUser.bio || '',
      status: nextUser.status || 'Online',
      preferences: nextUser.preferences,
    }
    setCurrentUser(cachedUser)
    setUser(cachedUser)
    setForm({
      name: cachedUser.name || '',
      username: cachedUser.username || '',
      bio: cachedUser.bio || '',
      status: cachedUser.status,
    })
  }

  useEffect(() => {
    const loadUser = async () => {
      try {
        const profile = await apiFetch('/auth/me')
        applyUser(profile.user)
      } catch (error) {
        console.error('Could not load profile:', error)
        setUser(getCurrentUser())
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [])

  const handleSave = async (event) => {
    event.preventDefault()
    setSaving(true)
    setFeedback('')

    try {
      const result = await apiFetch('/auth/profile', { method: 'PATCH', body: form })
      applyUser(result.user)
      setFeedback('Profile saved.')
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      setFeedback('Choose an image smaller than 5 MB.')
      return
    }

    const body = new FormData()
    body.append('file', file)
    setUploading(true)
    setFeedback('')

    try {
      const result = await apiFetch('/auth/profile/photo', { method: 'POST', body, isFormData: true })
      applyUser({ ...user, profilePhoto: result.profilePhoto })
      setFeedback('Profile photo updated.')
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setUploading(false)
    }
  }

  const displayName = user?.name || 'Your profile'
  const username = user?.username ? `@${user.username}` : '@username'
  const status = user?.status || 'Online'

  return (
    <div className="h-full overflow-y-auto overscroll-contain bg-[#f0f2f5] p-3 sm:p-6">
      <form onSubmit={handleSave} className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-emerald-100 bg-[#e7f5ec] p-4 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="relative h-24 w-24 shrink-0">
              {user?.profilePhoto ? (
                <img src={user.profilePhoto} alt={`${displayName} profile`} className="h-20 w-20 rounded-full object-cover ring-4 ring-white shadow-sm sm:h-24 sm:w-24" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-600 text-2xl font-bold text-white shadow-sm sm:h-24 sm:w-24">
                  {getInitials(displayName)}
                </div>
              )}
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="absolute bottom-0 right-0 rounded-full border-2 border-white bg-emerald-700 p-2 text-white shadow-lg shadow-emerald-200 disabled:opacity-50" aria-label="Upload profile photo">
                <Camera size={16} />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">Your account</p>
              <h2 className="mt-1 break-words text-2xl font-bold text-slate-900">{loading ? 'Loading profile...' : displayName}</h2>
              <p className="text-slate-500">{username}</p>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                {status}
              </div>
              <p className="mt-2 text-xs text-slate-500">{uploading ? 'Uploading photo...' : 'Profile photos up to 5 MB'}</p>
            </div>
          </div>
        </header>

        <div className="space-y-6 p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium text-slate-700">
              Display name
              <input required maxLength={80} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">
              Username
              <input required minLength={3} maxLength={24} value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
              About
              <textarea maxLength={280} rows={3} value={form.bio} onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))} placeholder="A few words about you" className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
              <span className="block text-right text-xs font-normal text-slate-500">{form.bio.length}/280</span>
            </label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">
              Availability
              <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100">
                {['Online', 'Away', 'Busy', 'Invisible', 'Offline'].map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-medium text-slate-700">
              Email
              <input value={user?.email || ''} readOnly className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-slate-500" />
            </label>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
            <p role="status" className="text-sm text-slate-600">{feedback}</p>
            <button type="submit" disabled={saving || loading} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:from-emerald-700 hover:to-emerald-600 disabled:opacity-50">
              {saving ? <UserRound size={16} /> : <Save size={16} />}
              {saving ? 'Saving...' : 'Save profile'}
            </button>
          </footer>
        </div>
      </form>
    </div>
  )
}

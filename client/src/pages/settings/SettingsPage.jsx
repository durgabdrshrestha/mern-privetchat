import { useEffect, useState } from 'react'
import { Bell, Eye, KeyRound, Save } from 'lucide-react'
import { apiFetch, getCurrentUser, setCurrentUser } from '../../services/api'

const defaultPreferences = {
  notifications: { messages: true, calls: true },
  privacy: { showOnlineStatus: true, readReceipts: true },
}

const normalizePreferences = (preferences) => ({
  notifications: { ...defaultPreferences.notifications, ...preferences?.notifications },
  privacy: { ...defaultPreferences.privacy, ...preferences?.privacy },
})

export default function SettingsPage() {
  const [preferences, setPreferences] = useState(defaultPreferences)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordSaving, setPasswordSaving] = useState(false)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const result = await apiFetch('/auth/me')
        const savedPreferences = normalizePreferences(result.user.preferences)
        setPreferences(savedPreferences)
        setCurrentUser({ ...getCurrentUser(), ...result.user, id: result.user.id })
      } catch (error) {
        setFeedback(error.message)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  const setPreference = (group, key, value) => {
    setPreferences((current) => ({
      ...current,
      [group]: { ...current[group], [key]: value },
    }))
    setFeedback('')
  }

  const savePreferences = async (event) => {
    event.preventDefault()
    setSaving(true)
    setFeedback('')

    try {
      const result = await apiFetch('/auth/preferences', { method: 'PATCH', body: preferences })
      const savedPreferences = normalizePreferences(result.preferences)
      setPreferences(savedPreferences)
      setCurrentUser({ ...getCurrentUser(), preferences: savedPreferences })
      setFeedback('Preferences saved.')
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async (event) => {
    event.preventDefault()
    setFeedback('')

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setFeedback('The new passwords do not match.')
      return
    }

    setPasswordSaving(true)
    try {
      await apiFetch('/auth/password', {
        method: 'PATCH',
        body: {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        },
      })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setFeedback('Password updated.')
    } catch (error) {
      setFeedback(error.message)
    } finally {
      setPasswordSaving(false)
    }
  }

  const settings = [
    {
      group: 'notifications',
      title: 'Message notifications',
      description: 'Show alerts when a new message arrives.',
      key: 'messages',
      icon: Bell,
    },
    {
      group: 'notifications',
      title: 'Call notifications',
      description: 'Show alerts for incoming audio and video calls.',
      key: 'calls',
      icon: Bell,
    },
    {
      group: 'privacy',
      title: 'Online visibility',
      description: 'Let contacts see when you are online.',
      key: 'showOnlineStatus',
      icon: Eye,
    },
    {
      group: 'privacy',
      title: 'Read receipts',
      description: 'Let contacts know when you have read their messages.',
      key: 'readReceipts',
      icon: Eye,
    },
  ]

  return (
    <div className="h-full overflow-y-auto overscroll-contain bg-[#f0f2f5] p-3 sm:p-6">
      <div className="mx-auto max-w-3xl space-y-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="rounded-t-xl border-b border-emerald-100 bg-[#e7f5ec] px-4 py-4 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">Account</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Settings</h2>
        </header>

        <div className="space-y-6 px-4 pb-4 sm:px-6 sm:pb-6">
          <form onSubmit={savePreferences} className="space-y-4">
            <div>
              <h3 className="font-semibold text-slate-900">Notifications and privacy</h3>
              <p className="text-sm text-slate-500">Choose what is shared and when you are alerted.</p>
            </div>

            <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
              {settings.map(({ group, title, description, key, icon: Icon }) => (
                <label key={key} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-4 transition hover:bg-white/80">
                  <span className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                      <Icon size={18} />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">{title}</span>
                      <span className="mt-0.5 block text-sm text-slate-500">{description}</span>
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={preferences[group][key]}
                    onChange={(event) => setPreference(group, key, event.target.checked)}
                    disabled={loading}
                    className="h-5 w-5 shrink-0 accent-emerald-700"
                  />
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p role="status" className="text-sm text-slate-600">{feedback}</p>
              <button type="submit" disabled={saving || loading} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition hover:from-emerald-700 hover:to-emerald-600 disabled:opacity-50">
                <Save size={16} />
                {saving ? 'Saving...' : 'Save settings'}
              </button>
            </div>
          </form>

          <form onSubmit={changePassword} className="space-y-4 border-t border-slate-200 pt-6">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <KeyRound size={18} />
              </span>
              <h3 className="font-semibold text-slate-900">Change password</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium text-slate-700 sm:col-span-2">
                Current password
                <input required type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                New password
                <input required minLength={8} type="password" autoComplete="new-password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
              </label>
              <label className="space-y-1.5 text-sm font-medium text-slate-700">
                Confirm new password
                <input required minLength={8} type="password" autoComplete="new-password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" />
              </label>
            </div>
            <button type="submit" disabled={passwordSaving} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
              {passwordSaving ? 'Updating...' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

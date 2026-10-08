import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, ArrowRight } from 'lucide-react'
import { apiFetch, setAuthToken, setCurrentUser } from '../../services/api'
import { getSocket } from '../../services/socket'
import BrandLogo from '../../components/brand/BrandLogo'

export default function LoginPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await apiFetch('/auth/login', {
        method: 'POST',
        body: form,
      })

      setAuthToken(result.token)
      setCurrentUser({
        id: result.user.id,
        name: result.user.name,
        username: result.user.username,
        email: result.user.email,
        profilePhoto: result.user.profilePhoto || '',
        bio: result.user.bio || '',
        status: result.user.status || 'Online',
        preferences: result.user.preferences,
      })

      getSocket()
      navigate('/chats')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center overflow-y-auto bg-slate-100 px-4 py-8 text-slate-800">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/80">
        <div className="mb-8 text-center">
          <BrandLogo className="mx-auto mb-4 h-14 w-14" />
          <h1 className="text-3xl font-bold tracking-tight">Privet Connect</h1>
          <p className="mt-2 text-sm text-slate-500">Secure real-time communication</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
              <Mail size={16} className="text-indigo-600" /> Email
            </span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
              <Lock size={16} className="text-indigo-600" /> Password
            </span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
            />
          </label>

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Logging in...' : 'Login'}
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-500">
            Create account
          </Link>
        </div>
      </div>
    </div>
  )
}

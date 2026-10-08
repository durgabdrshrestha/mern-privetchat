import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ChatListPage from './pages/chat/ChatListPage'
import ConversationPage from './pages/chat/ConversationPage'
import ProfilePage from './pages/profile/ProfilePage'
import SettingsPage from './pages/settings/SettingsPage'
import { isAuthenticated } from './services/api'

function ProtectedLayout() {
  const authenticated = isAuthenticated()

  if (!authenticated) {
    return <Navigate to="/" replace />
  }

  return <AppShell><Outlet /></AppShell>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<ProtectedLayout />}>
          <Route path="/chats" element={<ChatListPage />} />
          <Route path="/calls" element={<ChatListPage />} />
          <Route path="/tools" element={<ChatListPage />} />
          <Route path="/updates" element={<ChatListPage />} />
          <Route path="/chats/:conversationId" element={<ConversationPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

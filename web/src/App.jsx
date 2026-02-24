import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './store/AuthContext';
import { LoginPage }        from './pages/LoginPage';
import { DashboardPage }    from './pages/DashboardPage';
import { ConversationPage } from './pages/ConversationPage';
import { ReceiptPage }      from './pages/ReceiptPage';
import { SRSPage }          from './pages/SRSPage';
import { ProfilePage }      from './pages/ProfilePage';

function Guard({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner />
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

function Spinner() {
  return (
    <div style={{ width: 36, height: 36, border: '3px solid #DBEAFE', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Guard><DashboardPage /></Guard>} />
          <Route path="/conversation/:sessionId" element={<Guard><ConversationPage /></Guard>} />
          <Route path="/receipt/:sessionId"      element={<Guard><ReceiptPage /></Guard>} />
          <Route path="/srs"                     element={<Guard><SRSPage /></Guard>} />
          <Route path="/profile"                 element={<Guard><ProfilePage /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

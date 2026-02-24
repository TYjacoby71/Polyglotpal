import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import styles from './Layout.module.css';

const NAV = [
  { to: '/',        icon: '🎙️', label: 'Practice' },
  { to: '/srs',     icon: '📚', label: 'Flashcards' },
  { to: '/profile', icon: '👤', label: 'Profile'  },
];

export function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>P</div>
          <span className={styles.brandName}>PolyglotPal</span>
        </div>
        <nav className={styles.nav}>
          {NAV.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
            >
              <span className={styles.navIcon}>{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className={styles.sidebarBottom}>
          <div className={styles.userChip}>
            <div className={styles.avatar}>{user?.email?.[0]?.toUpperCase()}</div>
            <span className={styles.userEmail}>{user?.email}</span>
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout}>Sign out</button>
        </div>
      </aside>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}

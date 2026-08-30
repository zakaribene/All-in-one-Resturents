import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

function getInitialTheme() {
  const saved = localStorage.getItem('miis_theme');
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('miis_theme', theme);
  }, [theme]);

  return (
    <button
      className="theme-btn"
      title={theme === 'dark' ? 'Iftiin · Light mode' : 'Mugdi · Dark mode'}
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
    >
      {theme === 'dark' ? <Sun size={16} strokeWidth={2.25} /> : <Moon size={16} strokeWidth={2.25} />}
    </button>
  );
}

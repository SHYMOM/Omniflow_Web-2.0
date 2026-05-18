'use client';

import { useEffect } from 'react';
import { useUserStore } from '@/store/userStore';

export default function ThemeManager() {
  const { settings } = useUserStore();
  const theme = settings?.theme || 'midnight';
  const brandColor = settings?.brandColor || '#00E676';

  useEffect(() => {
    // 1. Apply Brand Accent Color
    document.documentElement.style.setProperty('--accent-primary', brandColor);

    // 2. Clear previous themes
    document.documentElement.classList.remove('theme-light', 'theme-dark', 'theme-midnight');
    document.documentElement.classList.add(`theme-${theme}`);

    // 3. Update dynamic color variables to achieve dynamic themes
    if (theme === 'light') {
      document.documentElement.style.setProperty('--color-void', '#f8f9fa');
      document.documentElement.style.setProperty('--color-surface', '#ffffff');
      document.documentElement.style.setProperty('--color-surface-hover', '#f1f3f5');
      document.documentElement.style.setProperty('--color-surface-elevated', '#e9ecef');
      document.documentElement.style.setProperty('--color-border', '#dee2e6');
      document.documentElement.style.setProperty('--color-badge', '#e9ecef');
      document.documentElement.style.setProperty('--color-text-primary', '#1a1a1a');
      document.documentElement.style.setProperty('--color-text-secondary', '#495057');
      document.documentElement.style.setProperty('--color-text-muted', '#868e96');
      document.documentElement.style.setProperty('color-scheme', 'light');
      document.body.style.background = '#f8f9fa';
      document.body.style.color = '#1a1a1a';
    } else if (theme === 'dark') {
      document.documentElement.style.setProperty('--color-void', '#121212');
      document.documentElement.style.setProperty('--color-surface', '#1e1e1e');
      document.documentElement.style.setProperty('--color-surface-hover', '#2a2a2a');
      document.documentElement.style.setProperty('--color-surface-elevated', '#333333');
      document.documentElement.style.setProperty('--color-border', '#3a3a3a');
      document.documentElement.style.setProperty('--color-badge', '#444444');
      document.documentElement.style.setProperty('--color-text-primary', '#ffffff');
      document.documentElement.style.setProperty('--color-text-secondary', '#b0b0b0');
      document.documentElement.style.setProperty('--color-text-muted', '#777777');
      document.documentElement.style.setProperty('color-scheme', 'dark');
      document.body.style.background = '#121212';
      document.body.style.color = '#ffffff';
    } else {
      // Midnight (default)
      document.documentElement.style.setProperty('--color-void', '#0a0a0a');
      document.documentElement.style.setProperty('--color-surface', '#141414');
      document.documentElement.style.setProperty('--color-surface-hover', '#1a1a1a');
      document.documentElement.style.setProperty('--color-surface-elevated', '#1e1e1e');
      document.documentElement.style.setProperty('--color-border', '#2a2a2a');
      document.documentElement.style.setProperty('--color-badge', '#333333');
      document.documentElement.style.setProperty('--color-text-primary', '#ffffff');
      document.documentElement.style.setProperty('--color-text-secondary', '#a0a0a0');
      document.documentElement.style.setProperty('--color-text-muted', '#666666');
      document.documentElement.style.setProperty('color-scheme', 'dark');
      document.body.style.background = '#0a0a0a';
      document.body.style.color = '#ffffff';
    }
  }, [theme, brandColor]);

  return null;
}

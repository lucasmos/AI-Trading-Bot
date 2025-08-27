'use client';

import { Moon, Sun, Contrast } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark' | 'amoled';

export function ThemeToggle() {
  // Initialize state to undefined to prevent hydration mismatch, will be set in useEffect
  const [theme, setTheme] = useState<ThemeMode | undefined>(undefined);

  // Helper function to apply theme to DOM and localStorage
  const applyTheme = (chosenTheme: ThemeMode) => {
    // Remove all theme classes first
    document.documentElement.classList.remove('dark', 'amoled');
    
    // Apply the appropriate class
    if (chosenTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (chosenTheme === 'amoled') {
      document.documentElement.classList.add('amoled');
    }
    // For 'light', no class is needed (default styles)
    
    localStorage.setItem('theme', chosenTheme);
    setTheme(chosenTheme);
  };

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') as ThemeMode | null;
    
    if (storedTheme && ['light', 'dark', 'amoled'].includes(storedTheme)) {
      // Apply stored theme preference
      applyTheme(storedTheme);
    } else {
      // Fall back to system preference (never auto-select AMOLED)
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(prefersDark ? 'dark' : 'light');
    }

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      // Only update if no theme is explicitly set by user in localStorage
      if (!localStorage.getItem('theme')) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, []);

  const toggleTheme = () => {
    if (!theme) return;
    
    // Cycle through: light → dark → amoled → light
    let newTheme: ThemeMode;
    if (theme === 'light') {
      newTheme = 'dark';
    } else if (theme === 'dark') {
      newTheme = 'amoled';
    } else {
      newTheme = 'light';
    }
    
    applyTheme(newTheme);
  };

  // Get appropriate icon for current theme
  const getThemeIcon = () => {
    if (theme === 'light') {
      return <Moon className="h-5 w-5" />;
    } else if (theme === 'dark') {
      return <Contrast className="h-5 w-5" />;
    } else {
      // AMOLED mode - use a distinctive icon
      return <Sun className="h-5 w-5" />;
    }
  };

  // Get appropriate aria-label
  const getAriaLabel = () => {
    if (theme === 'light') {
      return 'Switch to dark mode';
    } else if (theme === 'dark') {
      return 'Switch to AMOLED black mode';
    } else {
      return 'Switch to light mode';
    }
  };
  
  // Prevent rendering button until theme is determined to avoid hydration errors
  if (theme === undefined) {
    return (
      <Button 
        variant="ghost" 
        size="icon" 
        aria-label="Toggle theme" 
        disabled
      >
        <Sun className="h-5 w-5" />
      </Button>
    ); 
  }

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={toggleTheme} 
      aria-label={getAriaLabel()}
      title={getAriaLabel()}
    >
      {getThemeIcon()}
    </Button>
  );
}

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeToggle } from './theme-toggle';

// Mock localStorage
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('ThemeToggle', () => {
  beforeEach(() => {
    // Clear localStorage and reset DOM
    localStorageMock.clear();
    jest.clearAllMocks();
    document.documentElement.classList.remove('dark', 'amoled');
  });

  it('renders with default light theme when no preference is stored', async () => {
    render(<ThemeToggle />);
    
    await waitFor(() => {
      const button = screen.getByRole('button', { name: /switch to dark mode/i });
      expect(button).toBeInTheDocument();
    });

    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('amoled')).toBe(false);
  });

  it('cycles through themes in correct order: light → dark → amoled → light', async () => {
    render(<ThemeToggle />);
    
    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    const button = screen.getByRole('button');

    // Initial state: light
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument();
    expect(localStorageMock.setItem).toHaveBeenLastCalledWith('theme', 'light');

    // Click 1: light → dark
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /switch to amoled black mode/i })).toBeInTheDocument();
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('amoled')).toBe(false);
    expect(localStorageMock.setItem).toHaveBeenLastCalledWith('theme', 'dark');

    // Click 2: dark → amoled
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument();
    });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('amoled')).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenLastCalledWith('theme', 'amoled');

    // Click 3: amoled → light
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument();
    });
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.classList.contains('amoled')).toBe(false);
    expect(localStorageMock.setItem).toHaveBeenLastCalledWith('theme', 'light');
  });

  it('persists theme preference in localStorage', async () => {
    render(<ThemeToggle />);
    
    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    const button = screen.getByRole('button');

    // Set to dark mode
    fireEvent.click(button);
    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark');
    });

    // Set to amoled mode
    fireEvent.click(button);
    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'amoled');
    });
  });

  it('loads saved theme preference from localStorage on mount', async () => {
    localStorageMock.getItem = jest.fn().mockReturnValue('amoled');
    
    render(<ThemeToggle />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument();
    });

    expect(document.documentElement.classList.contains('amoled')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('respects system dark mode preference when no theme is stored', async () => {
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    render(<ThemeToggle />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /switch to amoled black mode/i })).toBeInTheDocument();
    });

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('never auto-selects AMOLED mode', async () => {
    // Even with system dark mode, should not auto-select AMOLED
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    render(<ThemeToggle />);
    
    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    // Should be dark, not AMOLED
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('amoled')).toBe(false);
  });

  it('ensures only one theme class is applied at a time', async () => {
    render(<ThemeToggle />);
    
    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    const button = screen.getByRole('button');

    // Cycle through all themes and check exclusivity
    for (let i = 0; i < 6; i++) {
      fireEvent.click(button);
      await waitFor(() => {
        const darkClass = document.documentElement.classList.contains('dark');
        const amoledClass = document.documentElement.classList.contains('amoled');
        
        // At most one class should be present
        expect(Number(darkClass) + Number(amoledClass)).toBeLessThanOrEqual(1);
      });
    }
  });

  it('provides accessible aria-labels for each theme state', async () => {
    render(<ThemeToggle />);
    
    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    const button = screen.getByRole('button');

    // Light mode
    expect(button).toHaveAttribute('aria-label', 'Switch to dark mode');
    expect(button).toHaveAttribute('title', 'Switch to dark mode');

    // Dark mode
    fireEvent.click(button);
    await waitFor(() => {
      expect(button).toHaveAttribute('aria-label', 'Switch to AMOLED black mode');
      expect(button).toHaveAttribute('title', 'Switch to AMOLED black mode');
    });

    // AMOLED mode
    fireEvent.click(button);
    await waitFor(() => {
      expect(button).toHaveAttribute('aria-label', 'Switch to light mode');
      expect(button).toHaveAttribute('title', 'Switch to light mode');
    });
  });
});

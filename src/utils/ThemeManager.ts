/**
 * Theme Manager
 * Handles theme switching between light and dark modes
 */

export type Theme = 'light' | 'dark';

export class ThemeManager {
  private static instance: ThemeManager;
  private currentTheme: Theme;
  private listeners: Set<(theme: Theme) => void> = new Set();
  private storageKey = 'app-theme';

  private constructor() {
    // Load saved theme or default to light
    this.currentTheme = this.loadTheme();
    this.applyTheme(this.currentTheme);
  }

  static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  /**
   * Load theme from localStorage
   */
  private loadTheme(): Theme {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved === 'dark' || saved === 'light') {
        return saved;
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
    return 'light'; // Default to light theme
  }

  /**
   * Save theme to localStorage
   */
  private saveTheme(theme: Theme): void {
    try {
      localStorage.setItem(this.storageKey, theme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  }

  /**
   * Apply theme to document body
   */
  private applyTheme(theme: Theme): void {
    const body = document.body;
    const html = document.documentElement;
    
    // Remove existing theme classes
    body.classList.remove('light-theme', 'dark-theme');
    
    // Add new theme class
    body.classList.add(`${theme}-theme`);
    
    // Also set data-theme attribute for additional CSS targeting
    html.setAttribute('data-theme', theme);
    
    // Inject dynamic styles to override inline styles in dark mode
    if (theme === 'dark') {
      this.injectDarkModeOverrideStyles();
    } else {
      this.removeDarkModeOverrideStyles();
    }
    
    // Also update mm class if it exists
    if (body.classList.contains('mm')) {
      // The CSS will apply based on body.mm.dark-theme or body.mm.light-theme
    }
  }

  /**
   * Inject dynamic styles to override inline styles for dark mode
   */
  private injectDarkModeOverrideStyles(): void {
    // Remove existing override styles if any
    this.removeDarkModeOverrideStyles();

    // Create a style element for overriding inline styles
    const styleId = 'dark-mode-inline-override';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement;
    
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    // Inject CSS that targets inline styles with maximum specificity
    styleEl.textContent = `
      /* Override annotation popup list items - target by structure */
      body.dark-theme .annotation-popup h3 + div > div[style],
      body.mm.dark-theme .annotation-popup h3 + div > div[style] {
        background-color: var(--color-bg-input) !important;
        color: var(--color-text-primary) !important;
        border-color: var(--color-border-light) !important;
      }
      
      /* Override annotation list item buttons */
      body.dark-theme .annotation-popup h3 + div > div[style] button[style],
      body.mm.dark-theme .annotation-popup h3 + div > div[style] button[style] {
        background-color: var(--color-bg-tertiary) !important;
        color: var(--color-text-primary) !important;
        border: 1px solid var(--color-border-light) !important;
      }
    `;
  }

  /**
   * Remove dark mode override styles
   */
  private removeDarkModeOverrideStyles(): void {
    const styleEl = document.getElementById('dark-mode-inline-override');
    if (styleEl) {
      styleEl.remove();
    }
  }

  /**
   * Get current theme
   */
  getTheme(): Theme {
    return this.currentTheme;
  }

  /**
   * Set theme
   */
  setTheme(theme: Theme): void {
    if (this.currentTheme !== theme) {
      this.currentTheme = theme;
      this.applyTheme(theme);
      this.saveTheme(theme);
      this.notifyListeners(theme);
    }
  }

  /**
   * Toggle between light and dark themes
   */
  toggleTheme(): void {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  /**
   * Subscribe to theme changes
   */
  subscribe(callback: (theme: Theme) => void): () => void {
    this.listeners.add(callback);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of theme change
   */
  private notifyListeners(theme: Theme): void {
    this.listeners.forEach(callback => {
      try {
        callback(theme);
      } catch (error) {
        console.error('Error in theme listener:', error);
      }
    });
  }

  /**
   * Check if dark mode is active
   */
  isDarkMode(): boolean {
    return this.currentTheme === 'dark';
  }

  /**
   * Initialize theme on app load
   */
  initialize(): void {
    // Apply theme immediately
    this.applyTheme(this.currentTheme);
    console.log('Theme Manager initialized with theme:', this.currentTheme);
  }
}

// Export singleton instance
export const themeManager = ThemeManager.getInstance();


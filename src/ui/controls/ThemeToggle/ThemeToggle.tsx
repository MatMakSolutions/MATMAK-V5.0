/** @jsx h */
/** @jsxFrag f */
import { BaseComponent, h, f } from "@ekkojs/web-controls";
import { themeManager, Theme } from "../../../utils/ThemeManager";

/**
 * Theme Toggle Button Component
 * Allows users to switch between light and dark modes
 */
export class ThemeToggle extends BaseComponent {
  private currentTheme: Theme;

  constructor() {
    super("ThemeToggle");
    this.currentTheme = themeManager.getTheme();
    this.registerTemplate("default", this.render.bind(this));
    
    // Subscribe to theme changes
    themeManager.subscribe((theme) => {
      this.currentTheme = theme;
      this.update();
    });
  }

  private handleToggle() {
    themeManager.toggleTheme();
  }

  render() {
    const isDark = this.currentTheme === 'dark';
    
    return (
      <button 
        class="theme-toggle-button"
        onClick={() => this.handleToggle()}
        title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      >
        {isDark ? (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 3V4M12 20V21M4 12H3M6.31412 6.31412L5.5 5.5M17.6859 6.31412L18.5 5.5M6.31412 17.69L5.5 18.5M17.6859 17.69L18.5 18.5M21 12H20M16 12C16 14.2091 14.2091 16 12 16C9.79086 16 8 14.2091 8 12C8 9.79086 9.79086 8 12 8C14.2091 8 16 9.79086 16 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Light</span>
          </>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Dark</span>
          </>
        )}
      </button>
    );
  }
}


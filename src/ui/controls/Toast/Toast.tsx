/** @jsx h */
/** @jsxfrag f */
import {
    BaseComponent,
    TRenderHandler,
    h, f
  } from "@ekkojs/web-controls";
  import { MainFrame } from "../../layout/Frame";
  import { getUow } from "../../../uof/UnitOfWork";
  import "../../../utils/css/toast.css";
  
  export type ToastType = "success" | "error" | "info" | "warning";
  
  export interface ToastMessage {
    id: string;
    message: string;
    type: ToastType;
    duration: number;
  }
  
  export class ToastContainer extends BaseComponent {
    toasts: ToastMessage[] = [];
    domElement: HTMLDivElement | null = null;
  
    constructor() {
      super("ToastContainer");
      this.registerTemplate("default", _default);
    }
  
    addToast(message: string, type: ToastType = "info", duration: number = 3000) {
      const id = `toast-${Date.now()}-${Math.random()}`;
      const toast: ToastMessage = { id, message, type, duration };
      
      this.toasts.push(toast);
      this.renderToDOM();
  
      // Auto-remove after duration
      setTimeout(() => {
        this.removeToast(id);
      }, duration);
    }
  
    removeToast(id: string) {
      this.toasts = this.toasts.filter(t => t.id !== id);
      this.renderToDOM();
    }
  
    renderToDOM() {
      if (!this.domElement) {
        this.domElement = document.createElement('div');
        this.domElement.className = 'toast-container';
        document.body.appendChild(this.domElement);
      }
  
      // Render toasts directly to DOM element
      this.domElement.innerHTML = '';
      this.toasts.forEach(toast => {
        const toastEl = document.createElement('div');
        toastEl.className = `toast toast-${toast.type}`;
        toastEl.innerHTML = `
          <div class="toast-icon">${getToastIcon(toast.type)}</div>
          <div class="toast-message">${toast.message}</div>
          <div class="toast-close">×</div>
        `;
        
        // Add click handlers
        toastEl.addEventListener('click', () => this.removeToast(toast.id));
        const closeBtn = toastEl.querySelector('.toast-close');
        if (closeBtn) {
          closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeToast(toast.id);
          });
        }
  
        this.domElement!.appendChild(toastEl);
      });
    }
  }
  
  const _default: TRenderHandler = ($this: ToastContainer) => {
    // Return empty since we render directly to DOM
    return <></>;
  };
  
  function getToastIcon(type: ToastType): string {
    switch (type) {
      case "success": return "✓";
      case "error": return "✕";
      case "warning": return "⚠";
      case "info": return "ℹ";
      default: return "ℹ";
    }
  }
  
  // Singleton instance for easy access
  let toastInstance: ToastContainer | null = null;
  
  export function initToastContainer() {
    if (!toastInstance) {
      toastInstance = new ToastContainer();
      // Don't add to MainFrame, it will render to document.body directly
      console.log('✅ Toast container initialized (renders to body)');
    }
    return toastInstance;
  }
  
  // Helper functions to show toasts
  export function showToast(message: string, type: ToastType = "info", duration: number = 3000) {
    try {
      if (!toastInstance) {
        console.warn('Toast instance not found, initializing now...');
        toastInstance = initToastContainer();
      }
      
      if (toastInstance) {
        toastInstance.addToast(message, type, duration);
        console.log('✅ Toast shown:', message, type);
      } else {
        console.error('❌ Failed to initialize toast container');
      }
    } catch (error) {
      console.error('❌ Error showing toast:', error);
    }
  }
  
  export function toastSuccess(message: string, duration: number = 3000) {
    showToast(message, "success", duration);
  }
  
  export function toastError(message: string, duration: number = 4000) {
    showToast(message, "error", duration);
  }
  
  export function toastInfo(message: string, duration: number = 3000) {
    showToast(message, "info", duration);
  }
  
  export function toastWarning(message: string, duration: number = 3500) {
    showToast(message, "warning", duration);
  }
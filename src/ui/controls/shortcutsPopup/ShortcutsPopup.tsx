/** @jsx h */
/** @jsxFrag f */
import { BaseComponent, TRenderHandler, h, f } from "@ekkojs/web-controls";
import { systemDesign } from "../../SystemDesign";
import "../../../utils/css/shortcuts-popup.css";

export class ShortcutsPopup extends BaseComponent {
  isVisible: boolean = false;

  constructor() {
    super("ShortcutsPopup");
    this.registerTemplate("default", _default);
    this.registerDependencyProperties(["isVisible"]);
  }

  show() {
    this.isVisible = true;
    this.update();
  }

  hide() {
    this.isVisible = false;
    this.update();
  }
}

const _default: TRenderHandler = ($this: ShortcutsPopup) => {
  if (!$this.isVisible) {
    return <></>;
  }

  return (
    <div class="shortcuts-overlay" onClick={() => $this.hide()}>
      <div class="shortcuts-popup" onClick={(e) => e.stopPropagation()}>
        <div class="shortcuts-header">
          <h2>Keyboard & Mouse Shortcuts</h2>
          <button class="shortcuts-close-btn" onClick={() => $this.hide()}>×</button>
        </div>
        <div class="shortcuts-content">
          {renderCategory("🖱️ Selection & Navigation", [
            { keys: "Left Click", action: "Select Item" },
            { keys: "Ctrl + Left Click", action: "Select Multiple / Select Points" },
            { keys: "Shift + Left Click", action: "Select Nested Path" },
            { keys: "Ctrl + Shift + Left Click", action: "Select Multiple Nested Paths" },
            { keys: "Space + Drag", action: "Pan / Move Board" },
            { keys: "Right Click + Drag", action: "Pan / Move Board" },
            { keys: "Mouse Wheel", action: "Zoom In / Out" },
            { keys: "Ctrl + Mouse Wheel", action: "Rotate Selected Item" },
          ])}
          {renderCategory("🔍 Zoom", [
            { keys: "Ctrl + Plus", action: "Zoom In" },
            { keys: "Ctrl + Minus", action: "Zoom Out" },
          ])}
          {renderCategory("⌨️ Editing & Arrangement", [
            { keys: "Ctrl + C", action: "Copy" },
            { keys: "Ctrl + V", action: "Paste" },
            { keys: "Ctrl + G", action: "Group Items" },
            { keys: "Ctrl + U", action: "Ungroup Items" },
            { keys: "Ctrl + B", action: "Center Board View" },
            { keys: "Ctrl + Shift + C", action: "Align Center" },
            { keys: "Shift + Arrow Keys", action: "Move Selected Points (Edit Mode)" },
          ])}
          {renderCategory("🔄 Transform", [
            { keys: "R", action: "Rotate Selected Pattern" },
            { keys: "M", action: "Mirror Pattern" },
          ])}
          {renderCategory("🔧 Modify Tools", [
            { keys: "W", action: "Weld Two Patterns" },
            { keys: "P", action: "Partial Wrap (Toggle)" },
            { keys: "B", action: "Bump / Segment Mode (Toggle)" },
            { keys: "O", action: "Outward" },
            { keys: "I", action: "Inward" },
            { keys: "S", action: "Split Pattern (Toggle)" },
            { keys: "Ctrl + Shift + P", action: "Remove Sub Patterns" },
          ])}
          {renderCategory("🔄 Undo & Redo", [
            { keys: "Ctrl + Z", action: "Undo" },
            { keys: "Ctrl + Y", action: "Redo" },
          ])}
          {renderCategory("🗑️ Deletion", [
            { keys: "Delete", action: "Delete Selected Items/Points" },
          ])}
          {renderCategory("🚫 Cancel Operations", [
            { keys: "Escape", action: "Cancel Paste/Nesting/Current Operation" },
          ])}
          {renderCategory("❓ Help", [
            { keys: "F1", action: "Show Keyboard Shortcuts" },
          ])}
        </div>
      </div>
    </div>
  );
};

// Helper to render a single key or a new, better icon
const renderKey = (key: string) => {
  switch (key.trim().toLowerCase()) {
    case 'left click':
      return (
        <span class="shortcut-icon" title="Left Click">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="4" width="8" height="16" rx="4" stroke="currentColor" stroke-width="1.5"/>
            <path d="M12 4V11" stroke="currentColor" stroke-width="1.5"/>
            <path d="M8 8C8 5.79086 9.79086 4 12 4V11H8V8Z" fill="currentColor"/>
          </svg>
        </span>
      );
    case 'right click':
      return (
        <span class="shortcut-icon" title="Right Click">
           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="4" width="8" height="16" rx="4" stroke="currentColor" stroke-width="1.5"/>
            <path d="M12 4V11" stroke="currentColor" stroke-width="1.5"/>
            <path d="M16 8C16 5.79086 14.2091 4 12 4V11H16V8Z" fill="currentColor"/>
          </svg>
        </span>
      );
    case 'mouse wheel':
      return (
        <span class="shortcut-icon" title="Mouse Wheel">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="4" width="8" height="16" rx="4" stroke="currentColor" stroke-width="1.5"/>
            <rect x="11.25" y="7" width="1.5" height="4" rx="0.75" fill="currentColor"/>
          </svg>
        </span>
      );
    case 'drag':
      return (
        <span class="shortcut-icon" title="Drag/Pan">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 13.4444V8.5C5 7.67157 5.67157 7 6.5 7H11.5C12.3284 7 13 7.67157 13 8.5V15.9444M5 13.4444C5 14.8239 6.17614 16 7.55556 16H8M5 13.4444H3.5M13 15.9444C13 17.3239 14.1761 18.5 15.5556 18.5H17.5C18.8807 18.5 20 17.3807 20 16V10.5C20 9.11929 18.8807 8 17.5 8C16.1193 8 15 9.11929 15 10.5V15.9444M13 15.9444H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      );
    default:
      return <kbd>{key}</kbd>;
  }
};

// Helper to render a category of shortcuts
const renderCategory = (title: string, shortcuts: { keys: string, action:string }[]) => {
  return (
    <div class="shortcuts-category">
      <h3>{title}</h3>
      <div class="shortcuts-grid">
        {shortcuts.map(sc => (
          <>
            <div class="shortcut-keys">
              {sc.keys.split('+').map(k => renderKey(k))}
            </div>
            <div class="shortcut-action">{sc.action}</div>
          </>
        ))}
      </div>
    </div>
  );
};

ShortcutsPopup.registerSystemDesign(systemDesign);
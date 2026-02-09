# Bump Segment Enhancements - Integration Guide
## Technical Implementation Roadmap

---

## 📋 Overview

This guide provides step-by-step instructions for integrating the proposed bump segment enhancements into the existing MATMAK V3.5 Next codebase.

---

## 🏗️ Architecture Overview

### Current Structure
```
src/
├── Pattern/
│   └── SegmentManager.ts          # Main segment management logic
├── Graphics/
│   ├── Segment.ts                 # Individual segment class
│   └── Surface.ts                 # Surface event handlers
├── ui/layout/TopBar/
│   └── TopBar.tsx                 # Toolbar buttons
└── core/
    ├── LiveConfig.ts              # Global settings
    └── UndoRedoManager.ts         # Undo/redo system
```

### Enhanced Structure
```
src/
├── Pattern/
│   ├── SegmentManager.ts          # ⚠️ MODIFIED - Core enhancements
│   ├── SegmentNudge.ts            # 🆕 NEW - Keyboard nudging
│   ├── SegmentTemplates.ts        # 🆕 NEW - Template system
│   └── SegmentPreview.ts          # 🆕 NEW - Preview mode
├── Graphics/
│   ├── Segment.ts                 # ⚠️ MODIFIED - Visual updates
│   └── Surface.ts                 # (no changes)
├── ui/
│   ├── layout/TopBar/
│   │   └── TopBar.tsx             # ⚠️ MODIFIED - New controls
│   └── components/
│       └── DistanceInput.tsx      # 🆕 NEW - Distance input UI
└── core/
    └── LiveConfig.ts              # ⚠️ MODIFIED - New settings
```

---

## 📅 Phase 1: Variable Distance Input (Week 1-2)

### Implementation Steps

#### Step 1.1: Add Distance Input UI Component
**File**: `src/ui/components/DistanceInput.tsx`

```typescript
import React, { useState, useEffect } from 'react';

interface DistanceInputProps {
  defaultValue: number;
  unit: 'mm' | 'in';
  onValueChange: (value: number) => void;
  onClose: () => void;
}

export const DistanceInput: React.FC<DistanceInputProps> = ({
  defaultValue,
  unit,
  onValueChange,
  onClose
}) => {
  const [value, setValue] = useState(defaultValue.toFixed(2));

  const handleSubmit = () => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      onValueChange(numValue);
    }
    onClose();
  };

  return (
    <div className="distance-input-overlay">
      <div className="distance-input-container">
        <label>Bump Distance ({unit})</label>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') onClose();
          }}
          autoFocus
          step={unit === 'mm' ? '0.1' : '0.01'}
          min="0.1"
        />
        <div className="button-group">
          <button onClick={handleSubmit}>Apply</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};
```

**CSS**: Add to main stylesheet
```css
.distance-input-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.distance-input-container {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  min-width: 250px;
}

.distance-input-container label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  color: #333;
}

.distance-input-container input {
  width: 100%;
  padding: 8px;
  font-size: 16px;
  border: 2px solid #FF9800;
  border-radius: 4px;
  margin-bottom: 12px;
}

.button-group {
  display: flex;
  gap: 8px;
}

.button-group button {
  flex: 1;
  padding: 8px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.button-group button:first-child {
  background: #FF9800;
  color: white;
}

.button-group button:last-child {
  background: #ddd;
  color: #333;
}
```

#### Step 1.2: Modify SegmentManager
**File**: `src/Pattern/SegmentManager.ts`

Add new properties:
```typescript
export class SegmentManager {
  // ... existing properties ...
  
  // NEW: Custom distance
  private customDistance: number | null = null;
  
  // ... rest of code ...
}
```

Add methods:
```typescript
/**
 * Set custom distance for next bump operation
 */
setCustomDistance(distance: number | null): void {
  this.customDistance = distance;
  this.updateArrows(); // Refresh visual display
}

/**
 * Get current effective distance
 */
getCurrentDistance(): number {
  return this.customDistance ?? liveConfig.wrapDistance;
}

/**
 * Reset to default distance
 */
resetCustomDistance(): void {
  this.customDistance = null;
  this.updateArrows();
}
```

Modify `moveSelected` method:
```typescript
moveSelected(direction: 'inward' | 'outward'): void {
  if (!this.pattern || this.selectedSegments.size === 0) {
    console.warn('SegmentManager: No pattern or no selected segments');
    return;
  }

  // Capture state BEFORE movement for undo/redo
  const beforeState = undoRedoManager?.capturePatternState(this.pattern._guid);

  // Get wrap distance: use custom if set, otherwise use global
  let distance = this.customDistance ?? liveConfig.wrapDistance;
  
  if (liveConfig.unitOfMeasure === 3) {
    distance *= 25.4; // Convert inches to mm
  }

  console.log(`SegmentManager: Moving ${this.selectedSegments.size} segments ${direction} by ${distance}mm`);

  // ... rest of existing logic ...
  
  // After successful move, reset custom distance (optional behavior)
  // this.customDistance = null;
}
```

Modify `updateArrows` to show distance:
```typescript
private updateArrows(): void {
  // ... existing arrow drawing code ...
  
  // Add distance indicator
  const distance = this.getCurrentDistance();
  const unit = liveConfig.unitOfMeasure === 3 ? 'in' : 'mm';
  const isCustom = this.customDistance !== null;
  
  // Draw distance badge between arrows
  const midX = (outwardX + inwardX) / 2;
  const midY = (outwardY + inwardY) / 2;
  
  const badgeColor = isCustom ? 0xFFEB3B : 0xFFFFFF;
  const borderColor = isCustom ? 0xFF9800 : 0x0096c8;
  
  this.arrowsContainer.setFillStyle({ color: badgeColor, alpha: 0.95 });
  this.arrowsContainer.setStrokeStyle({ color: borderColor, width: 2 });
  this.arrowsContainer.roundRect(midX - 30, midY - 14, 60, 28, 6);
  this.arrowsContainer.fill();
  this.arrowsContainer.stroke();
  
  // Add text
  const textStyle = new TextStyle({
    fontFamily: 'Arial',
    fontSize: 12,
    fontWeight: isCustom ? 'bold' : 'normal',
    fill: isCustom ? '#FF6F00' : '#0096c8',
  });
  
  const text = new Text(`${distance.toFixed(2)}${unit}`, textStyle);
  text.anchor.set(0.5);
  text.x = midX;
  text.y = midY;
  
  this.arrowsContainer.addChild(text);
}
```

#### Step 1.3: Add UI Controls
**File**: `src/ui/layout/TopBar/TopBar.tsx`

Add distance input button (appears when segment mode active):
```typescript
{segmentManager.isActive() && (
  <div className="segment-distance-controls">
    <button
      onClick={() => {
        // Show distance input modal
        const currentDistance = segmentManager.getCurrentDistance();
        const unit = liveConfig.unitOfMeasure === 3 ? 'in' : 'mm';
        
        // Use React portal or state to show DistanceInput component
        setShowDistanceInput(true);
      }}
      title="Set custom bump distance"
    >
      {segmentManager.getCurrentDistance().toFixed(2)}
      {liveConfig.unitOfMeasure === 3 ? 'in' : 'mm'}
    </button>
    
    {segmentManager.customDistance !== null && (
      <button
        onClick={() => segmentManager.resetCustomDistance()}
        title="Reset to default distance"
      >
        ↺ Reset
      </button>
    )}
  </div>
)}
```

#### Step 1.4: Testing Checklist
- [ ] Distance input appears when segments selected
- [ ] Custom distance persists across multiple bumps
- [ ] Reset button returns to default distance
- [ ] Visual indicator shows custom vs. default
- [ ] Undo/redo works correctly with custom distances
- [ ] Distance input validates min/max values

---

## 📅 Phase 2: Keyboard Nudging (Week 2-3)

### Implementation Steps

#### Step 2.1: Create Nudge Module
**File**: `src/Pattern/SegmentNudge.ts`

```typescript
import { Segment } from "../Graphics/Segment";
import { liveConfig } from "../core/LiveConfig";
import { toastInfo } from "../ui/controls/Toast/Toast";

export interface NudgeConfig {
  coarse: number;      // Shift + Arrow
  fine: number;        // Ctrl + Shift + Arrow
  ultraFine: number;   // Alt + Shift + Arrow
}

export class SegmentNudge {
  private static readonly CONFIG_MM: NudgeConfig = {
    coarse: 1.0,
    fine: 0.1,
    ultraFine: 0.01,
  };
  
  private static readonly CONFIG_INCH: NudgeConfig = {
    coarse: 0.039,
    fine: 0.004,
    ultraFine: 0.0004,
  };
  
  static getNudgeAmount(event: KeyboardEvent): number {
    const config = liveConfig.unitOfMeasure === 3 
      ? this.CONFIG_INCH 
      : this.CONFIG_MM;
    
    if (event.altKey && event.shiftKey) {
      return config.ultraFine;
    } else if (event.ctrlKey && event.shiftKey) {
      return config.fine;
    } else if (event.shiftKey) {
      return config.coarse;
    }
    
    return 0;
  }
  
  static isNudgeKey(event: KeyboardEvent): boolean {
    return event.shiftKey && 
           ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key);
  }
  
  static showNudgeFeedback(direction: string, amount: number): void {
    const unit = liveConfig.unitOfMeasure === 3 ? 'in' : 'mm';
    
    let sizeIndicator = '';
    const config = liveConfig.unitOfMeasure === 3 
      ? this.CONFIG_INCH 
      : this.CONFIG_MM;
    
    if (amount === config.ultraFine) {
      sizeIndicator = '•';
    } else if (amount === config.fine) {
      sizeIndicator = '••';
    } else {
      sizeIndicator = '•••';
    }
    
    const message = `Nudge ${direction} ${amount.toFixed(amount < 0.1 ? 3 : 2)}${unit} ${sizeIndicator}`;
    toastInfo(message, 800);
  }
}
```

#### Step 2.2: Integrate into SegmentManager
**File**: `src/Pattern/SegmentManager.ts`

Add keyboard listener setup:
```typescript
import { SegmentNudge } from './SegmentNudge';

export class SegmentManager {
  // ... existing properties ...
  
  private nudgeKeyHandler: ((e: KeyboardEvent) => void) | null = null;
  private nudgeUndoTimer: NodeJS.Timeout | null = null;
  private lastNudgeBeforeState: any = null;
  
  activate(pattern: _Pattern): void {
    // ... existing activation code ...
    
    // Setup keyboard nudging
    this.setupKeyboardNudge();
  }
  
  private setupKeyboardNudge(): void {
    this.nudgeKeyHandler = (e: KeyboardEvent) => {
      if (!this.pattern || this.selectedSegments.size === 0) return;
      
      if (!SegmentNudge.isNudgeKey(e)) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const amount = SegmentNudge.getNudgeAmount(e);
      const direction = this.getNudgeDirection(e.key as any);
      
      this.applyNudge(direction, amount);
      SegmentNudge.showNudgeFeedback(direction, amount);
    };
    
    window.addEventListener('keydown', this.nudgeKeyHandler);
  }
  
  private getNudgeDirection(key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'): 'inward' | 'outward' {
    // Simplified: Up = outward, Down = inward
    // Left/Right could be context-sensitive based on segment orientation
    return key === 'ArrowUp' || key === 'ArrowRight' ? 'outward' : 'inward';
  }
  
  private applyNudge(direction: 'inward' | 'outward', amount: number): void {
    // Capture before state on first nudge
    if (!this.lastNudgeBeforeState) {
      this.lastNudgeBeforeState = undoRedoManager.capturePatternState(this.pattern!._guid);
    }
    
    // Convert to mm if using inches
    let distanceMM = amount;
    if (liveConfig.unitOfMeasure === 3) {
      distanceMM *= 25.4;
    }
    
    // Use existing movement logic
    this.moveSelectedInternal(direction, distanceMM);
    
    // Debounced undo recording
    this.scheduleNudgeUndo();
  }
  
  private scheduleNudgeUndo(): void {
    if (this.nudgeUndoTimer) {
      clearTimeout(this.nudgeUndoTimer);
    }
    
    this.nudgeUndoTimer = setTimeout(() => {
      this.recordNudgeUndo();
    }, 500);
  }
  
  private recordNudgeUndo(): void {
    if (!this.pattern || !this.lastNudgeBeforeState) return;
    
    const afterState = undoRedoManager.capturePatternState(this.pattern._guid);
    
    if (afterState) {
      undoRedoManager.recordPatternAction({
        type: 'edit_nodes',
        patternGuid: this.pattern._guid,
        beforeState: this.lastNudgeBeforeState,
        afterState: afterState,
        metadata: { action: 'keyboard_nudge' }
      });
    }
    
    this.lastNudgeBeforeState = null;
    this.nudgeUndoTimer = null;
  }
  
  // Extract existing moveSelected logic to separate method
  private moveSelectedInternal(direction: 'inward' | 'outward', distanceMM: number): void {
    // ... existing moveSelected logic, but takes distance as parameter ...
  }
  
  deactivate(): void {
    // ... existing deactivation code ...
    
    // Clean up nudge handlers
    if (this.nudgeUndoTimer) {
      clearTimeout(this.nudgeUndoTimer);
      this.recordNudgeUndo();
    }
    
    if (this.nudgeKeyHandler) {
      window.removeEventListener('keydown', this.nudgeKeyHandler);
      this.nudgeKeyHandler = null;
    }
  }
}
```

#### Step 2.3: Testing Checklist
- [ ] Shift + Arrow keys trigger nudge
- [ ] Different modifier combinations produce different amounts
- [ ] Multiple nudges group into single undo action
- [ ] Visual feedback appears for each nudge
- [ ] Works with multiple selected segments
- [ ] Doesn't interfere with other keyboard shortcuts

---

## 📅 Phase 3: Preview Mode (Week 3-4)

### Implementation Steps

#### Step 3.1: Create Preview Module
**File**: `src/Pattern/SegmentPreview.ts`

```typescript
import { Graphics, Container } from "pixi.js";
import { Segment } from "../Graphics/Segment";
import { _Pattern } from "./Pattern";

export class SegmentPreview {
  private previewContainer: Container | null = null;
  private previewGraphics: Graphics | null = null;
  
  constructor(private pattern: _Pattern) {
    this.previewContainer = new Container();
    this.previewGraphics = new Graphics();
    this.previewContainer.addChild(this.previewGraphics);
    this.pattern.container.addChild(this.previewContainer);
  }
  
  show(
    segments: Set<Segment>,
    direction: 'inward' | 'outward',
    distance: number
  ): void {
    if (!this.previewGraphics) return;
    
    this.previewGraphics.clear();
    
    // Calculate preview positions without modifying actual commands
    const previewPath = this.calculatePreviewPath(segments, direction, distance);
    
    // Draw preview as semi-transparent overlay
    this.previewGraphics.setStrokeStyle({
      color: direction === 'outward' ? 0xff4444 : 0x44ff44,
      width: 3,
      alpha: 0.6
    });
    
    this.previewGraphics.setFillStyle({
      color: direction === 'outward' ? 0xff4444 : 0x44ff44,
      alpha: 0.1
    });
    
    // Draw the preview path
    if (previewPath.length > 0) {
      this.previewGraphics.moveTo(previewPath[0].x, previewPath[0].y);
      for (let i = 1; i < previewPath.length; i++) {
        this.previewGraphics.lineTo(previewPath[i].x, previewPath[i].y);
      }
      this.previewGraphics.stroke();
    }
  }
  
  hide(): void {
    if (this.previewGraphics) {
      this.previewGraphics.clear();
    }
  }
  
  destroy(): void {
    this.hide();
    if (this.previewContainer) {
      this.pattern.container.removeChild(this.previewContainer);
      this.previewContainer.destroy();
      this.previewContainer = null;
    }
    this.previewGraphics = null;
  }
  
  private calculatePreviewPath(
    segments: Set<Segment>,
    direction: 'inward' | 'outward',
    distance: number
  ): Array<{ x: number, y: number }> {
    // Calculate what the path would look like after movement
    // without actually modifying the pattern
    
    // ... implementation similar to moveSelected but returns points instead ...
    
    return [];
  }
}
```

#### Step 3.2: Add to SegmentManager
```typescript
import { SegmentPreview } from './SegmentPreview';

export class SegmentManager {
  private preview: SegmentPreview | null = null;
  private previewMode: boolean = false;
  
  activate(pattern: _Pattern): void {
    // ... existing code ...
    
    this.preview = new SegmentPreview(pattern);
  }
  
  enablePreview(direction: 'inward' | 'outward'): void {
    if (!this.preview || this.selectedSegments.size === 0) return;
    
    const distance = this.getCurrentDistance();
    this.preview.show(this.selectedSegments, direction, distance);
    this.previewMode = true;
    
    // Show accept/cancel UI
    // ... implementation ...
  }
  
  acceptPreview(): void {
    if (!this.previewMode) return;
    
    // Apply the actual movement
    // ... implementation ...
    
    this.preview?.hide();
    this.previewMode = false;
  }
  
  cancelPreview(): void {
    this.preview?.hide();
    this.previewMode = false;
  }
  
  deactivate(): void {
    // ... existing code ...
    
    this.preview?.destroy();
    this.preview = null;
  }
}
```

---

## 🧪 Testing Strategy

### Unit Tests
Create `src/Pattern/__tests__/SegmentManager.test.ts`:

```typescript
describe('SegmentManager', () => {
  describe('Variable Distance', () => {
    it('should use custom distance when set', () => {
      // ... test implementation ...
    });
    
    it('should fall back to default distance when custom is null', () => {
      // ... test implementation ...
    });
  });
  
  describe('Keyboard Nudge', () => {
    it('should calculate correct nudge amount based on modifiers', () => {
      // ... test implementation ...
    });
  });
});
```

### Integration Tests
Test scenarios:
1. Set custom distance → Apply bump → Verify distance used
2. Multiple keyboard nudges → Verify grouped undo
3. Preview mode → Accept → Verify changes applied
4. Preview mode → Cancel → Verify no changes

### Manual Testing
- [ ] Test with simple rectangle pattern
- [ ] Test with complex curved pattern
- [ ] Test with multiple segments selected
- [ ] Test undo/redo for all new features
- [ ] Test with both mm and inch units
- [ ] Test keyboard shortcuts don't conflict

---

## 📝 Documentation Updates

### User Documentation
1. Update user manual with new features
2. Create video tutorials for each enhancement
3. Add tooltips to new UI elements
4. Update keyboard shortcut reference

### Developer Documentation
1. Update API documentation
2. Add inline code comments
3. Create architecture diagrams
4. Document configuration options

---

## 🚀 Deployment Checklist

### Pre-deployment
- [ ] All tests passing
- [ ] Code review completed
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Migration script created (if needed)

### Deployment
- [ ] Create feature branch
- [ ] Merge to development
- [ ] Beta testing with select users
- [ ] Gather feedback
- [ ] Fix any issues
- [ ] Merge to production

### Post-deployment
- [ ] Monitor for errors
- [ ] Gather user feedback
- [ ] Create support materials
- [ ] Plan next iteration

---

## 📊 Success Metrics

Track these metrics to measure success:

1. **Usage Metrics**
   - % of patterns using bump segment feature
   - Average bumps per pattern
   - Custom distance usage rate

2. **Performance Metrics**
   - Time to complete bump operation
   - Undo/redo performance
   - Memory usage

3. **Quality Metrics**
   - Bug reports for new features
   - User satisfaction scores
   - Training time reduction

---

## 🔧 Maintenance Plan

### Regular Tasks
- Monitor error logs
- Review user feedback
- Update documentation
- Optimize performance

### Quarterly Reviews
- Analyze usage patterns
- Identify enhancement opportunities
- Plan feature updates
- Review and update tests

---

**Integration Guide Version**: 1.0  
**Last Updated**: December 1, 2025  
**For**: MATMAK V3.5 Next


















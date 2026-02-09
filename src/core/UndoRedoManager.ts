// Add these imports at the top of globals.ts
import { TSurfaceDataPattern } from '../data/repository/SurfaceData';
import { guid } from "../core/Guid";
import { surfaceManager } from "../Graphics/SurfaceManager";
import {Pattern,_Pattern} from "../Pattern/Pattern";
import { surfaceCollection } from "../data/repository/SurfaceCollection";
import { IPoint } from "../VectorPath/Utils/IPoint";
import { waitForElt, waitForMs } from "../core/Dom";

import { splitPattern } from "../shared/Substract";
import { nestingEvents } from "../core/EventBus";


import { VectorPath } from "../VectorPath/VectorPath";
import { config, TConfig } from "../core/Constant";
import { ppInfo, ppNesting, ppWait,ppNestingProgress,ppNestingQuality ,ppChooseNesting,ppCutOrPreview } from "../ui/controls/popup/Popup";
import paper from "paper";
import { curProjectId, sFetch } from "../uof/Globals";
import { createPolygonFromSVGPaths } from "../cutboard/PrepareCut";

import { boardManager } from "../cutboard/BoardManager";
import { getUow } from "../uof/UnitOfWork";
import { AnnotationPopup } from "../ui/controls/AnnotationPopup/AnnotationPopup";
import * as PIXI from 'pixi.js'; /// new for nesting
import { TEditionPattern } from "../Pattern/Extentions/PatternEdition";
import { CutPreviewPopup } from "../ui/controls/popup/CutPreviewPopup";
import { convertMm, liveConfig } from "../core/LiveConfig";
import { Matrix } from "pixi.js"


// Add these interfaces and classes at the end of globals.ts

export interface PatternAction {
  type: 'move' | 'copy' | 'split' | 'group' | 'ungroup' | 'delete' | 'outward' | 'inward' | 'partial_wrap' | 'weld' | 'rotate' | 'mirror' | 'edit_nodes' | 'align_center';
  patternGuid: string;
  beforeState?: TSurfaceDataPattern;
  afterState?: TSurfaceDataPattern;
  metadata?: any;
  timestamp: number;
}


export class UndoRedo<T = PatternAction> {
    private history: T[] = [];
    private currentIndex: number = -1;
    private maxHistorySize: number = 50;
  
    constructor(maxHistorySize: number = 50) {
      this.maxHistorySize = maxHistorySize;
    }
  
    addAction(action: T): void {
      // Remove any actions after the current index
      if (this.currentIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.currentIndex + 1);
      }
  
      this.history.push(action);
      this.currentIndex = this.history.length - 1;
  
      // Limit history size
      if (this.history.length > this.maxHistorySize) {
        this.history.shift();
        this.currentIndex--;
      }
    }
  
    undo(): T | null {
        if (!this.canUndo()) return null;
        const action = this.history[this.currentIndex];
        this.currentIndex--; // Move index back before returning action
        return action;
      }
    
      redo(): T | null {
        if (!this.canRedo()) return null;
        this.currentIndex++; // Move index forward before returning action
        const action = this.history[this.currentIndex];
        return action;
      }
  
    canUndo(): boolean {
      return this.currentIndex >= 0;
    }
  
    canRedo(): boolean {
      return this.currentIndex < this.history.length - 1;
    }
  
    clear(): void {
      this.history = [];
      this.currentIndex = -1;
    }
  
    getHistorySize(): number {
      return this.history.length;
    }
  
    getCurrentIndex(): number {
      return this.currentIndex;
    }
  }

export class UndoRedoManager {
    private undoRedo: UndoRedo<PatternAction>;
    private isPerformingUndoRedo: boolean = false;
  
    constructor() {
      this.undoRedo = new UndoRedo<PatternAction>(50);
      console.log('UndoRedoManager initialized');
    }
  
  /**
   * Record a pattern modification action for a single pattern
   */
  recordPatternAction(action: Omit<PatternAction, 'timestamp'>): void {
    if (this.isPerformingUndoRedo) return;
    
    console.log('Recording pattern action:', action);
    
    const actionWithTimestamp: PatternAction = {
      ...action,
      timestamp: Date.now()
    };
    
    this.undoRedo.addAction(actionWithTimestamp);
    console.log('Action recorded. History size:', this.undoRedo.getHistorySize());
  }

  /**
   * Record multiple pattern actions (for operations affecting multiple patterns)
   */
  recordMultiplePatternActions(actions: Omit<PatternAction, 'timestamp'>[]): void {
    if (this.isPerformingUndoRedo) return;
    
    // Record all actions as a batch
    actions.forEach(action => {
      const actionWithTimestamp: PatternAction = {
        ...action,
        timestamp: Date.now()
      };
      this.undoRedo.addAction(actionWithTimestamp);
    });
  }
  
    /**
     * Undo the last action
     */
    undo(): PatternAction | null {
      console.log('Attempting undo. Can undo:', this.undoRedo.canUndo());
      if (!this.undoRedo.canUndo()) return null;
      
      this.isPerformingUndoRedo = true;
      const action = this.undoRedo.undo();
      console.log('Undo action:', action);
      this.isPerformingUndoRedo = false;
      return action;
    }
  
    /**
     * Redo the last undone action
     */
    redo(): PatternAction | null {
      console.log('Attempting redo. Can redo:', this.undoRedo.canRedo());
      if (!this.undoRedo.canRedo()) return null;
      
      this.isPerformingUndoRedo = true;
      const action = this.undoRedo.redo();
      console.log('Redo action:', action);
      this.isPerformingUndoRedo = false;
      return action;
    }
  

  canUndo(): boolean {
    return this.undoRedo.canUndo();
  }

  canRedo(): boolean {
    return this.undoRedo.canRedo();
  }

   /**
   * Apply an action to restore a specific pattern
   */
   applyPatternAction(action: PatternAction, isUndo: boolean): void {
    const surface = surfaceManager.currentSurface;
    if (!surface) return;

   
    const existingPattern = surface._Patterns.find((p: any) => p._guid === action.patternGuid);

    if (action.type === 'delete') {
      // Check if this is a nested path deletion
      const isNestedPathDeletion = action.metadata?.isNestedPathDeletion === true;
      
      if (isNestedPathDeletion) {
        // Handle nested path deletion undo/redo
        if (isUndo) { // Undo: restore nested paths to parent pattern
          if (existingPattern && action.beforeState) {
            // Clear existing subpatterns first
            existingPattern.clearSubPatterns();
            
            // Update the parent pattern's vector to include the deleted nested paths
            const newVector = new VectorPath();
            newVector.parse(action.beforeState.paths[0]);
            newVector.normalize();
            newVector.paths = action.beforeState.paths.slice(1);
            existingPattern._vector = newVector;
            
            // Reinitialize subpatterns (including the restored ones)
            if (action.beforeState.paths.length > 1) {
              existingPattern.initializeNestedPatterns();
            }
            
            // Set position
            const newOriginalPos = existingPattern._vector.originalPosition;
            existingPattern.x = existingPattern.zoomed(action.beforeState.boardPosition.x + newOriginalPos.x);
            existingPattern.y = existingPattern.zoomed(action.beforeState.boardPosition.y + newOriginalPos.y);
            existingPattern._rotation = action.beforeState.boardAngle;
            
            // Refresh display
            existingPattern.display();
            
            // Update data layer
            const patternData = surfaceCollection?.selectedSurfaceData?.getPattern(action.patternGuid);
            if (patternData) {
              patternData.boardPosition = action.beforeState.boardPosition;
              patternData.boardAngle = action.beforeState.boardAngle;
              patternData.paths = action.beforeState.paths;
              surfaceCollection.selectedSurfaceData.setPattern(patternData);
            }
          }
        } else { // Redo: remove nested paths from parent pattern again
          if (existingPattern && action.afterState) {
            // Clear existing subpatterns first
            existingPattern.clearSubPatterns();
            
            // Update the parent pattern's vector without the deleted nested paths
            const newVector = new VectorPath();
            newVector.parse(action.afterState.paths[0]);
            newVector.normalize();
            newVector.paths = action.afterState.paths.slice(1);
            existingPattern._vector = newVector;
            
            // Reinitialize remaining subpatterns
            if (action.afterState.paths.length > 1) {
              existingPattern.initializeNestedPatterns();
            }
            
            // Set position
            const newOriginalPos = existingPattern._vector.originalPosition;
            existingPattern.x = existingPattern.zoomed(action.afterState.boardPosition.x + newOriginalPos.x);
            existingPattern.y = existingPattern.zoomed(action.afterState.boardPosition.y + newOriginalPos.y);
            existingPattern._rotation = action.afterState.boardAngle;
            
            // Refresh display
            existingPattern.display();
            
            // Update data layer
            const patternData = surfaceCollection?.selectedSurfaceData?.getPattern(action.patternGuid);
            if (patternData) {
              patternData.boardPosition = action.afterState.boardPosition;
              patternData.boardAngle = action.afterState.boardAngle;
              patternData.paths = action.afterState.paths;
              surfaceCollection.selectedSurfaceData.setPattern(patternData);
            }
          }
        }
      } else {
        // Handle main pattern deletion (existing logic)
        if (isUndo) { // Undo delete: restore the pattern
          if (action.beforeState) {
            const pattern = surface.addPath(action.beforeState.paths[0], {
              guid: action.beforeState.guid,
              nestedPaths: action.beforeState.paths.slice(1),
              noNormilize: true,
            });
            if (pattern) {
              pattern.x = pattern.zoomed(action.beforeState.boardPosition.x);
              pattern.y = pattern.zoomed(action.beforeState.boardPosition.y);
              pattern._rotation = action.beforeState.boardAngle;
              pattern.display();
              surfaceCollection?.selectedSurfaceData?.addPattern(action.beforeState);
            }
          }
        } else { // Redo delete: remove the pattern
          if (existingPattern) {
            surface.removePattern(existingPattern);
            surfaceCollection?.selectedSurfaceData?.removePattern(action.patternGuid);
          }
        }
      }
    } else if (action.type === 'group') {
        if (isUndo) { // Undo group: remove the grouped pattern and restore original patterns
          // First, completely dispose of the grouped pattern
          if (existingPattern) {
            existingPattern.dispose();
            surface.removePattern(existingPattern);
            surfaceCollection?.selectedSurfaceData?.removePattern(action.patternGuid);
          }
         
          // Then restore the original patterns with their ORIGINAL GUIDs
          if (action.metadata?.originalPatterns) {
            action.metadata.originalPatterns.forEach((originalPatternData: TSurfaceDataPattern) => {
              // Use the ORIGINAL GUID instead of generating a new one
              const originalGuid = originalPatternData.guid;
              const newPatternData = originalPatternData;

              const newPattern = surface.addPath(newPatternData.paths[0], {
                guid: originalGuid, // Use original GUID, not a new one
                nestedPaths: newPatternData.paths.slice(1),
                noNormilize: false,
              });

              const originalX = originalPatternData.boardPosition.x;
              const originalY = originalPatternData.boardPosition.y;
              const normalizeOffsetX = newPattern._vector.originalPosition.x;
              const normalizeOffsetY = newPattern._vector.originalPosition.y;
              
              newPattern.x = newPattern.zoomed(originalX + normalizeOffsetX);
              newPattern.y = newPattern.zoomed(originalY + normalizeOffsetY);
              newPattern._rotation = originalPatternData.boardAngle;
              newPattern.display();


              surfaceCollection.selectedSurfaceData.addPattern({
                ...newPatternData,
                guid: originalGuid, // Use original GUID
                boardPosition: { x: newPattern.x, y: newPattern.y },
                boardAngle: newPattern._rotation,
                patternColor: originalPatternData.patternColor,
                patternName: originalPatternData.patternName,
                patternId: originalPatternData.patternId,
                
              });


              surfaceManager.updateSelectedSurfaceData();

              
            });
          }
          
          // Save the changes
        
   
            surfaceManager.updateSelectedSurfaceData();
        
        } else { // Redo group: remove original patterns and restore grouped pattern
          // Remove original patterns completely using the ORIGINAL GUIDs
          if (action.metadata?.originalPatternGuids) {
            action.metadata.originalPatternGuids.forEach((guid: string) => {
              const p = surface._Patterns.find((pat: any) => pat._guid === guid);
              if (p) {
                p.dispose(); // Dispose completely
                surface.removePattern(p);
                surfaceCollection?.selectedSurfaceData?.removePattern(guid);
              }
            });
          }
          
          // Restore grouped pattern
          if (action.afterState) {
            const pattern = surface.addPath(action.afterState.paths[0], {
              guid: action.afterState.guid, // Use the grouped pattern's GUID
              nestedPaths: action.afterState.paths.slice(1),
              noNormilize: false, // Force normalization
            });
            
            if (pattern) {
              pattern.x = pattern.zoomed(action.afterState.boardPosition.x);
              pattern.y = pattern.zoomed(action.afterState.boardPosition.y);
              pattern._rotation = action.afterState.boardAngle;
              pattern.display();
              surfaceCollection?.selectedSurfaceData?.addPattern(action.afterState);
            }
          }
          
          // Save the changes
      
            surfaceManager.updateSelectedSurfaceData();
         
        }
      
    } else if (action.type === 'ungroup') {
      // Check if this is a nested path ungroup (selected via Shift+Click)
      const isNestedPathUngroup = action.metadata?.isNestedPathUngroup === true;
      
      if (isNestedPathUngroup) {
        // Special handling for nested path ungrouping (Shift+Click selected nested path)
        if (isUndo) { // Undo: remove the newly created standalone pattern and restore nested path to parent
          if (action.metadata?.newlyCreatedPatternGuids) {
            action.metadata.newlyCreatedPatternGuids.forEach((guid: string) => {
              const p = surface._Patterns.find((pat: any) => pat._guid === guid);
              if (p) {
                p.dispose();
                surface.removePattern(p);
                surfaceCollection?.selectedSurfaceData?.removePattern(guid);
              }
            });
          }
          
          // Restore the parent pattern to its original state (with the nested path)
          if (existingPattern && action.beforeState) {
            // Clear existing subpatterns first
            existingPattern.clearSubPatterns();
            
            // Update the parent pattern's vector to include the nested path
            const newVector = new VectorPath();
            newVector.parse(action.beforeState.paths[0]);
            newVector.normalize();
            newVector.paths = action.beforeState.paths.slice(1);
            existingPattern._vector = newVector;
            
            // Reinitialize subpatterns
            if (action.beforeState.paths.length > 1) {
              existingPattern.initializeNestedPatterns();
            }
            
            // Set position
            const newOriginalPos = existingPattern._vector.originalPosition;
            existingPattern.x = existingPattern.zoomed(action.beforeState.boardPosition.x + newOriginalPos.x);
            existingPattern.y = existingPattern.zoomed(action.beforeState.boardPosition.y + newOriginalPos.y);
            existingPattern._rotation = action.beforeState.boardAngle;
            
            // Refresh display
            existingPattern.display();
            
            // Update data layer
            const patternData = surfaceCollection?.selectedSurfaceData?.getPattern(action.patternGuid);
            if (patternData) {
              patternData.boardPosition = action.beforeState.boardPosition;
              patternData.boardAngle = action.beforeState.boardAngle;
              patternData.paths = action.beforeState.paths;
              surfaceCollection.selectedSurfaceData.setPattern(patternData);
            }
          }
        } else { // Redo: remove the nested path from parent and recreate the standalone pattern
          // Restore the parent pattern to its after state (without the nested path)
          if (existingPattern && action.afterState) {
            // Clear existing subpatterns first
            existingPattern.clearSubPatterns();
            
            // Update the parent pattern's vector without the ungrouped nested path
            const newVector = new VectorPath();
            newVector.parse(action.afterState.paths[0]);
            newVector.normalize();
            newVector.paths = action.afterState.paths.slice(1);
            existingPattern._vector = newVector;
            
            // Reinitialize remaining subpatterns
            if (action.afterState.paths.length > 1) {
              existingPattern.initializeNestedPatterns();
            }
            
            // Set position
            const newOriginalPos = existingPattern._vector.originalPosition;
            existingPattern.x = existingPattern.zoomed(action.afterState.boardPosition.x + newOriginalPos.x);
            existingPattern.y = existingPattern.zoomed(action.afterState.boardPosition.y + newOriginalPos.y);
            existingPattern._rotation = action.afterState.boardAngle;
            
            // Refresh display
            existingPattern.display();
            
            // Update data layer
            const patternData = surfaceCollection?.selectedSurfaceData?.getPattern(action.patternGuid);
            if (patternData) {
              patternData.boardPosition = action.afterState.boardPosition;
              patternData.boardAngle = action.afterState.boardAngle;
              patternData.paths = action.afterState.paths;
              surfaceCollection.selectedSurfaceData.setPattern(patternData);
            }
          }
          
          // Recreate the ungrouped standalone pattern
          if (action.metadata?.newlyCreatedPatterns) {
            action.metadata.newlyCreatedPatterns.forEach((newPatternData: TSurfaceDataPattern) => {
              const pattern = surface.addPath(newPatternData.paths[0], {
                guid: newPatternData.guid,
                nestedPaths: newPatternData.paths.slice(1),
                noNormilize: false,
              });
              if (pattern) {
                const normalizeOffsetX = pattern._vector.originalPosition.x;
                const normalizeOffsetY = pattern._vector.originalPosition.y;
                pattern.x = pattern.zoomed(newPatternData.boardPosition.x + normalizeOffsetX);
                pattern.y = pattern.zoomed(newPatternData.boardPosition.y + normalizeOffsetY);
                pattern._rotation = newPatternData.boardAngle;
                pattern.display();
                surfaceCollection?.selectedSurfaceData?.addPattern(newPatternData);
              }
            });
          }
        }
        
        surfaceManager.updateSelectedSurfaceData();
        return;
      }
      
      // Check if this is an edit-mode subpattern ungroup (special case)
      const isEditModeUngroup = action.metadata?.isEditModeUngroup === true;
      
      if (isEditModeUngroup) {
        // Special handling for edit-mode subpattern ungrouping
        if (isUndo) { // Undo: remove the newly created pattern and restore parent pattern's original state
          if (action.metadata?.newlyCreatedPatternGuids) {
            action.metadata.newlyCreatedPatternGuids.forEach((guid: string) => {
              const p = surface._Patterns.find((pat: any) => pat._guid === guid);
              if (p) {
                p.dispose();
                surface.removePattern(p);
                surfaceCollection?.selectedSurfaceData?.removePattern(guid);
              }
            });
          }
          
          // Restore the parent pattern to its original state (with the subpattern)
          if (existingPattern && action.beforeState) {
            const wasInEditionMode = existingPattern._state === 'edition';
            
            // Clear existing subpatterns first
            existingPattern.clearSubPatterns();
            
            // Update the parent pattern's vector to include the subpattern
            const newVector = new VectorPath();
            newVector.parse(action.beforeState.paths[0]);
            newVector.normalize();
            newVector.paths = action.beforeState.paths.slice(1);
            existingPattern._vector = newVector;
            
            // Reinitialize subpatterns
            if (action.beforeState.paths.length > 1) {
              existingPattern.initializeNestedPatterns();
            }
            
            // Set position
            const newOriginalPos = existingPattern._vector.originalPosition;
            existingPattern.x = existingPattern.zoomed(action.beforeState.boardPosition.x + newOriginalPos.x);
            existingPattern.y = existingPattern.zoomed(action.beforeState.boardPosition.y + newOriginalPos.y);
            existingPattern._rotation = action.beforeState.boardAngle;
            
            // Refresh display
            if (wasInEditionMode) {
              existingPattern.setState('');
              existingPattern.setState('edition');
            } else {
              existingPattern.display();
            }
            
            // Update data layer
            const patternData = surfaceCollection?.selectedSurfaceData?.getPattern(action.patternGuid);
            if (patternData) {
              patternData.boardPosition = action.beforeState.boardPosition;
              patternData.boardAngle = action.beforeState.boardAngle;
              patternData.paths = action.beforeState.paths;
              surfaceCollection.selectedSurfaceData.setPattern(patternData);
            }
          }
        } else { // Redo: remove the subpattern from parent and recreate the new pattern
          // Restore the parent pattern to its after state (without the subpattern)
          if (existingPattern && action.afterState) {
            const wasInEditionMode = existingPattern._state === 'edition';
            
            // Clear existing subpatterns first
            existingPattern.clearSubPatterns();
            
            // Update the parent pattern's vector without the ungrouped subpattern
            const newVector = new VectorPath();
            newVector.parse(action.afterState.paths[0]);
            newVector.normalize();
            newVector.paths = action.afterState.paths.slice(1);
            existingPattern._vector = newVector;
            
            // Reinitialize remaining subpatterns
            if (action.afterState.paths.length > 1) {
              existingPattern.initializeNestedPatterns();
            }
            
            // Set position
            const newOriginalPos = existingPattern._vector.originalPosition;
            existingPattern.x = existingPattern.zoomed(action.afterState.boardPosition.x + newOriginalPos.x);
            existingPattern.y = existingPattern.zoomed(action.afterState.boardPosition.y + newOriginalPos.y);
            existingPattern._rotation = action.afterState.boardAngle;
            
            // Refresh display
            if (wasInEditionMode) {
              existingPattern.setState('');
              existingPattern.setState('edition');
            } else {
              existingPattern.display();
            }
            
            // Update data layer
            const patternData = surfaceCollection?.selectedSurfaceData?.getPattern(action.patternGuid);
            if (patternData) {
              patternData.boardPosition = action.afterState.boardPosition;
              patternData.boardAngle = action.afterState.boardAngle;
              patternData.paths = action.afterState.paths;
              surfaceCollection.selectedSurfaceData.setPattern(patternData);
            }
          }
          
          // Recreate the ungrouped pattern
          if (action.metadata?.newlyCreatedPatterns) {
            action.metadata.newlyCreatedPatterns.forEach((newPatternData: TSurfaceDataPattern) => {
              const pattern = surface.addPath(newPatternData.paths[0], {
                guid: newPatternData.guid,
                nestedPaths: newPatternData.paths.slice(1),
                noNormilize: false,
              });
              if (pattern) {
                pattern.x = pattern.zoomed(newPatternData.boardPosition.x);
                pattern.y = pattern.zoomed(newPatternData.boardPosition.y);
                pattern._rotation = newPatternData.boardAngle;
                pattern.display();
                surfaceCollection?.selectedSurfaceData?.addPattern(newPatternData);
              }
            });
          }
        }
        
        surfaceManager.updateSelectedSurfaceData();
      } else {
        // Original ungroup handling (full pattern ungroup, not edit mode)
        if (isUndo) { // Undo ungroup: remove newly created patterns and restore the original grouped pattern
          if (action.metadata?.newlyCreatedPatternGuids) {
            action.metadata.newlyCreatedPatternGuids.forEach((guid: string) => {
              const p = surface._Patterns.find((pat: any) => pat._guid === guid);
              if (p) {
                p.dispose(); // Dispose completely before removing
                surface.removePattern(p);
                surfaceCollection?.selectedSurfaceData?.removePattern(guid);
              }
            });
          }
          if (action.beforeState) { // beforeState here is the original grouped pattern
            const pattern = surface.addPath(action.beforeState.paths[0], {
              guid: action.beforeState.guid,
              nestedPaths: action.beforeState.paths.slice(1),
              noNormilize: false,
            });
            if (pattern) {
              const originalX = action.beforeState.boardPosition.x;
              const originalY = action.beforeState.boardPosition.y;
              const normalizeOffsetX = pattern._vector.originalPosition.x;
              const normalizeOffsetY = pattern._vector.originalPosition.y;
              
              pattern.x = pattern.zoomed(originalX + normalizeOffsetX);
              pattern.y = pattern.zoomed(originalY + normalizeOffsetY);
              pattern._rotation = action.beforeState.boardAngle;
              pattern.display();
              
              surfaceCollection.selectedSurfaceData.addPattern({
                ...action.beforeState,
                boardPosition: { x: pattern.x, y: pattern.y },
              });
            }
          }
          
          surfaceManager.updateSelectedSurfaceData();
        } else { // Redo ungroup: remove original grouped pattern and restore newly created patterns
          if (existingPattern) { // existingPattern here is the original grouped pattern
            existingPattern.dispose();
            surface.removePattern(existingPattern);
            surfaceCollection?.selectedSurfaceData?.removePattern(action.patternGuid);
          }
          if (action.metadata?.newlyCreatedPatterns) {
            action.metadata.newlyCreatedPatterns.forEach((newPatternData: TSurfaceDataPattern) => {
              const pattern = surface.addPath(newPatternData.paths[0], {
                guid: newPatternData.guid,
                nestedPaths: newPatternData.paths.slice(1),
                noNormilize: false,
              });
              if (pattern) {
                pattern.x = pattern.zoomed(newPatternData.boardPosition.x);
                pattern.y = pattern.zoomed(newPatternData.boardPosition.y);
                pattern._rotation = newPatternData.boardAngle;
                pattern.display();
                surfaceCollection?.selectedSurfaceData?.addPattern(newPatternData);
              }
            });
          }
          
          surfaceManager.updateSelectedSurfaceData();
        }
      }
    } else if (action.type === 'weld') {
      if (isUndo) { // Undo weld: remove welded pattern and restore original two patterns
        if (existingPattern) {
          existingPattern.dispose();
          surface.removePattern(existingPattern);
          surfaceCollection?.selectedSurfaceData?.removePattern(action.patternGuid);
        }
        
        // Restore original patterns with their original GUIDs
        if (action.metadata?.originalPatterns) {
          action.metadata.originalPatterns.forEach((originalPatternData: TSurfaceDataPattern) => {
            const originalGuid = originalPatternData.guid;
            
            const newPattern = surface.addPath(originalPatternData.paths[0], {
              guid: originalGuid,
              nestedPaths: originalPatternData.paths.slice(1),
              noNormilize: false,
            });
            
            const originalX = originalPatternData.boardPosition.x;
            const originalY = originalPatternData.boardPosition.y;
            const normalizeOffsetX = newPattern._vector.originalPosition.x;
            const normalizeOffsetY = newPattern._vector.originalPosition.y;
            
            newPattern.x = newPattern.zoomed(originalX + normalizeOffsetX);
            newPattern.y = newPattern.zoomed(originalY + normalizeOffsetY);
            newPattern._rotation = originalPatternData.boardAngle;
            newPattern.display();
            
            surfaceCollection.selectedSurfaceData.addPattern({
              ...originalPatternData,
              guid: originalGuid,
              boardPosition: { x: newPattern.x, y: newPattern.y },
              boardAngle: newPattern._rotation,
            });
          });
        }
        
        surfaceManager.updateSelectedSurfaceData();
      } else { // Redo weld: remove original patterns and restore welded pattern
        if (action.metadata?.originalPatternGuids) {
          action.metadata.originalPatternGuids.forEach((guid: string) => {
            const p = surface._Patterns.find((pat: any) => pat._guid === guid);
            if (p) {
              p.dispose();
              surface.removePattern(p);
              surfaceCollection?.selectedSurfaceData?.removePattern(guid);
            }
          });
        }
        
        if (action.afterState) {
          const pattern = surface.addPath(action.afterState.paths[0], {
            guid: action.afterState.guid,
            nestedPaths: action.afterState.paths.slice(1),
            noNormilize: false,
          });
          
          if (pattern) {
            pattern.x = pattern.zoomed(action.afterState.boardPosition.x);
            pattern.y = pattern.zoomed(action.afterState.boardPosition.y);
            pattern._rotation = action.afterState.boardAngle;
            pattern.display();
            surfaceCollection?.selectedSurfaceData?.addPattern(action.afterState);
          }
        }
        
        surfaceManager.updateSelectedSurfaceData();
      }
    } else if (action.type === 'split') {
      if (isUndo) { // Undo split: remove created patterns and restore original pattern
        if (action.metadata?.createdPatternGuids) {
          action.metadata.createdPatternGuids.forEach((guid: string) => {
            const p = surface._Patterns.find((pat: any) => pat._guid === guid);
            if (p) {
              p.dispose();
              surface.removePattern(p);
              surfaceCollection?.selectedSurfaceData?.removePattern(guid);
            }
          });
        }
        
        // Restore original pattern with its original GUID
        if (action.beforeState) {
          const pattern = surface.addPath(action.beforeState.paths[0], {
            guid: action.beforeState.guid,
            nestedPaths: action.beforeState.paths.slice(1),
            noNormilize: false,
          });
          
          if (pattern) {
            const originalX = action.beforeState.boardPosition.x;
            const originalY = action.beforeState.boardPosition.y;
            const normalizeOffsetX = pattern._vector.originalPosition.x;
            const normalizeOffsetY = pattern._vector.originalPosition.y;
            
            pattern.x = pattern.zoomed(originalX + normalizeOffsetX);
            pattern.y = pattern.zoomed(originalY + normalizeOffsetY);
            pattern._rotation = action.beforeState.boardAngle;
            pattern.display();
            
            surfaceCollection.selectedSurfaceData.addPattern({
              ...action.beforeState,
              boardPosition: { x: pattern.x, y: pattern.y },
            });
          }
        }
        
        surfaceManager.updateSelectedSurfaceData();
      } else { // Redo split: remove original pattern and restore created patterns
        if (existingPattern) {
          existingPattern.dispose();
          surface.removePattern(existingPattern);
          surfaceCollection?.selectedSurfaceData?.removePattern(action.patternGuid);
        }
        
        if (action.metadata?.createdPatterns) {
          action.metadata.createdPatterns.forEach((patternData: TSurfaceDataPattern) => {
            const pattern = surface.addPath(patternData.paths[0], {
              guid: patternData.guid,
              nestedPaths: patternData.paths.slice(1),
              noNormilize: false,
            });
            
            if (pattern) {
              pattern.x = pattern.zoomed(patternData.boardPosition.x);
              pattern.y = pattern.zoomed(patternData.boardPosition.y);
              pattern._rotation = patternData.boardAngle;
              pattern.display();
              surfaceCollection?.selectedSurfaceData?.addPattern(patternData);
            }
          });
        }
        
        surfaceManager.updateSelectedSurfaceData();
      }
    } else if (action.type === 'mirror') {
      if (isUndo) { // Undo mirror: remove mirrored pattern and restore original
        if (existingPattern) {
          existingPattern.dispose();
          surface.removePattern(existingPattern);
          surfaceCollection?.selectedSurfaceData?.removePattern(action.patternGuid);
        }
        
        // Restore original pattern with its original GUID
        if (action.metadata?.originalPattern) {
          const originalData = action.metadata.originalPattern;
          const pattern = surface.addPath(originalData.paths[0], {
            guid: originalData.guid,
            nestedPaths: originalData.paths.slice(1),
            noNormilize: false,
          });
          
          if (pattern) {
            const originalX = originalData.boardPosition.x;
            const originalY = originalData.boardPosition.y;
            const normalizeOffsetX = pattern._vector.originalPosition.x;
            const normalizeOffsetY = pattern._vector.originalPosition.y;
            
            pattern.x = pattern.zoomed(originalX + normalizeOffsetX);
            pattern.y = pattern.zoomed(originalY + normalizeOffsetY);
            pattern._rotation = originalData.boardAngle;
            pattern.display();
            
            surfaceCollection.selectedSurfaceData.addPattern({
              ...originalData,
              boardPosition: { x: pattern.x, y: pattern.y },
            });
          }
        }
        
        surfaceManager.updateSelectedSurfaceData();
      } else { // Redo mirror: remove original and restore mirrored pattern
        if (action.metadata?.originalPattern) {
          const p = surface._Patterns.find((pat: any) => pat._guid === action.metadata.originalPattern.guid);
          if (p) {
            p.dispose();
            surface.removePattern(p);
            surfaceCollection?.selectedSurfaceData?.removePattern(action.metadata.originalPattern.guid);
          }
        }
        
        if (action.afterState) {
          const pattern = surface.addPath(action.afterState.paths[0], {
            guid: action.afterState.guid,
            nestedPaths: action.afterState.paths.slice(1),
            noNormilize: false,
          });
          
          if (pattern) {
            pattern.x = pattern.zoomed(action.afterState.boardPosition.x);
            pattern.y = pattern.zoomed(action.afterState.boardPosition.y);
            pattern._rotation = action.afterState.boardAngle;
            pattern.display();
            surfaceCollection?.selectedSurfaceData?.addPattern(action.afterState);
          }
        }
        
        surfaceManager.updateSelectedSurfaceData();
      }
    } else if (existingPattern && (action.beforeState || action.afterState)) {
      // Update existing pattern for other action types (move, rotate, outward, inward, edit_nodes, etc.)
      const stateToApply = isUndo ? action.beforeState : action.afterState;
      if (stateToApply) {
        // Store the current state before making changes
        const wasInEditionMode = existingPattern._state === 'edition';
        
        if (stateToApply.paths.length > 0) {
          // For actions that might affect subpatterns, clear and reinitialize them
          if (stateToApply.paths.length > 1 || existingPattern.subPatterns.length > 0) {
            // Clear existing subpatterns first
            existingPattern.clearSubPatterns();
          }
          
          const newVector = new VectorPath();
          newVector.parse(stateToApply.paths[0]);
          newVector.normalize();
          newVector.paths = stateToApply.paths.slice(1);
          existingPattern._vector = newVector;
          
          // Reinitialize subpatterns after vector is set
          if (stateToApply.paths.length > 1) {
            existingPattern.initializeNestedPatterns();
            
            // Sync subpattern rotation values
            // Newly created subpatterns have default _vectorRotation=0, but their paths
            // already have the parent's rotation baked in from the saved state
            existingPattern.subPatterns.forEach((subPattern: any) => {
              subPattern._rotation = stateToApply.boardAngle;
              subPattern._vectorRotation = stateToApply.boardAngle;
            });
          }
        }
        
        // Set position accounting for the new normalization offset
        const newOriginalPos = existingPattern._vector.originalPosition;
        existingPattern.x = existingPattern.zoomed(stateToApply.boardPosition.x + newOriginalPos.x);
        existingPattern.y = existingPattern.zoomed(stateToApply.boardPosition.y + newOriginalPos.y);
        existingPattern._rotation = stateToApply.boardAngle;
        
        // ALWAYS sync _vectorRotation when restoring state
        // The saved paths already have rotation baked in, so _vectorRotation must match
        (existingPattern as any)._vectorRotation = stateToApply.boardAngle;
        
        // If pattern was in edition mode, we need to refresh the edition handlers
        if (wasInEditionMode) {
          // Exit and re-enter edition mode to refresh handlers
          existingPattern.setState('');
          existingPattern.setState('edition');
        } else {
          existingPattern.display();
        }
        
        const patternData = surfaceCollection?.selectedSurfaceData?.getPattern(action.patternGuid);
        if (patternData) {
          patternData.boardPosition = stateToApply.boardPosition;
          patternData.boardAngle = stateToApply.boardAngle;
          patternData.paths = stateToApply.paths;
          surfaceCollection.selectedSurfaceData.setPattern(patternData);
        }
      }
    }
    
    surface.display(); // Refresh the entire surface to ensure all changes are visible
    
    // Persist changes to the data layer
    surfaceManager.saveSlectedSurface();
  }

  /**
   * Capture current state of a specific pattern
   */
  capturePatternState(patternGuid: string): TSurfaceDataPattern | null {
    const surface = surfaceManager.currentSurface;
    if (!surface) return null;

    const pattern = surface._Patterns.find((p: any) => p._guid === patternGuid);
    if (!pattern) return null;

    const patternData = surfaceCollection.selectedSurfaceData.getPattern(patternGuid);
    
    // Calculate the true base position (accounting for normalization offset)
    const unzoomedX = pattern.unZoomed(pattern.x);
    const unzoomedY = pattern.unZoomed(pattern.y);
    const originalPos = pattern._vector.originalPosition;
    const baseX = unzoomedX - originalPos.x;
    const baseY = unzoomedY - originalPos.y;
    
    return {
      guid: pattern._guid,
      paths: [pattern._vector.generatePathString(), ...pattern.subPatterns.map((p: any) => p._vector.generatePathString())],
      boardPosition: { x: baseX, y: baseY },
      boardAngle: pattern._rotation,
      patternId: patternData?.patternId || "",
      patternName: patternData?.patternName || "",
      patternColor: patternData?.patternColor || pattern._color,
      originalPosition: pattern._vector.originalPosition,
      firstLoad: patternData?.firstLoad || false
    };
  }

  clearHistory(): void {
    this.undoRedo.clear();
  }

  getHistoryInfo(): { size: number; currentIndex: number; canUndo: boolean; canRedo: boolean } {
    return {
      size: this.undoRedo.getHistorySize(),
      currentIndex: this.undoRedo.getCurrentIndex(),
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    };
  }
}

// Export the global instance
export const undoRedoManager = new UndoRedoManager();
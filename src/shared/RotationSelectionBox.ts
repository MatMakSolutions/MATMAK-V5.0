import { DisplayObject } from "../Graphics/DisplayObject";
import { surfaceManager } from "../Graphics/SurfaceManager";
import { _Pattern } from "../Pattern/Pattern";
import { Graphics, GraphicsPath, Matrix } from "pixi.js";
import { liveConfig } from "../core/LiveConfig";
import { undoRedoManager } from "../core/UndoRedoManager";
import { IPoint } from "../VectorPath/Utils/IPoint";

export class RotationSelectionBox extends DisplayObject {
    private selectedPatterns: _Pattern[] = [];
    private rotationHandle: Graphics | null = null;
    private isRotating: boolean = false;
    private rotationStartAngle: number = 0;
    private rotationStartMouseAngle: number = 0;
    private rotationCenter: IPoint = { x: 0, y: 0 };
    private rotationBeforeStates: Map<string, any> = new Map();
    private rotationDebounceTimer: NodeJS.Timeout | null = null;
    private initialPatternPositions: Map<string, { x: number, y: number, rotation: number }> = new Map();
    private fixedBoundingBox: { width: number, height: number, center: IPoint } | null = null;
    private isDragging: boolean = false;
    private hasPivotPoint: boolean = false;
    private dragStartPoint: IPoint = { x: 0, y: 0 };
    private dragStartPatternPositions: Map<string, { x: number, y: number }> = new Map();
    private dragBeforeStates: Map<string, any> = new Map();
    private rotationHandleOffset: number = 30; // Distance above top edge for rotation handle

    constructor() {
        super();
        this.setInteractivity(true);
        this.visible = false;
    }

    updateSelection(patterns: _Pattern[]) {
        const newSelection = patterns.filter(p => p._state === 'selected' && !p._parentPattern);
        
        // Check if selection has changed (by comparing GUIDs)
        const currentGuids = new Set(this.selectedPatterns.map(p => p._guid));
        const newGuids = new Set(newSelection.map(p => p._guid));
        const selectionChanged = currentGuids.size !== newGuids.size || 
            [...currentGuids].some(guid => !newGuids.has(guid));
        
        // When selection changes, calculate and set the fixed bounding box
        // This ensures consistent box size from selection through rotation
        if (selectionChanged) {
            this.selectedPatterns = newSelection;
            
            // Calculate maximum bounding box that would contain the pattern at any rotation
            // This ensures the box size is consistent from the start
            if (this.selectedPatterns.length > 0) {
                const maxBbox = this.calculateMaxBoundingBoxForRotation();
                const currentBbox = this.calculateRotatedBoundingBox();
                this.fixedBoundingBox = {
                    width: maxBbox.width,
                    height: maxBbox.height,
                    center: currentBbox.center
                };
            } else {
                this.fixedBoundingBox = null;
            }
        } else {
            this.selectedPatterns = newSelection;
        }
        
        this.update();
    }
    
    /**
     * Calculate the maximum bounding box that would contain the pattern at any rotation angle
     * This is used during rotation to ensure the box always contains the pattern
     * Returns: { width, height } in unzoomed coordinates
     */
    private calculateMaxBoundingBoxForRotation(): { width: number, height: number } {
        const surface = surfaceManager.currentSurface;
        if (!surface) {
            return { width: 0, height: 0 };
        }
        
        // First, calculate the current bounding box that contains all selected patterns
        const currentBbox = this.calculateRotatedBoundingBox();
        const currentWidth = currentBbox.width;
        const currentHeight = currentBbox.height;
        
        // For a rectangle of width W and height H, when rotated by any angle,
        // the maximum axis-aligned bounding box needed is sqrt(W^2 + H^2) x sqrt(W^2 + H^2)
        // This ensures the box always contains all patterns regardless of rotation
        const maxDimension = Math.sqrt(currentWidth * currentWidth + currentHeight * currentHeight);
        
        // Add padding to ensure box never intersects with patterns
        // Reduced padding to prevent excessive spacing
        const padding = 8;
        const maxWidth = maxDimension + padding * 2;
        const maxHeight = maxDimension + padding * 2;
        
        return { width: maxWidth, height: maxHeight };
    }

    /**
     * Calculate the bounding box accounting for each pattern's rotation
     * Returns: { minX, minY, maxX, maxY, width, height, center } in unzoomed coordinates
     */
    private calculateRotatedBoundingBox(): { minX: number, minY: number, maxX: number, maxY: number, width: number, height: number, center: IPoint } {
        let minX_local = Infinity, minY_local = Infinity, maxX_local = -Infinity, maxY_local = -Infinity;
        
        const surface = surfaceManager.currentSurface;
        if (!surface) {
            return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, center: { x: 0, y: 0 } };
        }
        
        this.selectedPatterns.forEach(pattern => {
            // Use PIXI container bounds which includes all visual elements (main path + sub-patterns)
            // This is more accurate than using _bbox which only includes the main vector path
            // Container bounds already account for rotation and all children
            const containerBounds = pattern.container.getBounds();
            
            // Container bounds are in screen/stage coordinates
            // We need to convert to unzoomed world coordinates
            const zoomFactor = pattern.zoomFactor;
            const stageX = surface._app.stage.x;
            const stageY = surface._app.stage.y;
            
            // Convert all four corners of the bounding box to world coordinates
            // This ensures we capture the full extent of rotated patterns
            const corners = [
                { x: containerBounds.x, y: containerBounds.y }, // Top-left
                { x: containerBounds.x + containerBounds.width, y: containerBounds.y }, // Top-right
                { x: containerBounds.x + containerBounds.width, y: containerBounds.y + containerBounds.height }, // Bottom-right
                { x: containerBounds.x, y: containerBounds.y + containerBounds.height } // Bottom-left
            ];
            
            // Convert each corner from screen space to unzoomed world space
            corners.forEach(corner => {
                const unzoomedX = (corner.x - stageX) / zoomFactor;
                const unzoomedY = (corner.y - stageY) / zoomFactor;
                
                minX_local = Math.min(minX_local, unzoomedX);
                minY_local = Math.min(minY_local, unzoomedY);
                maxX_local = Math.max(maxX_local, unzoomedX);
                maxY_local = Math.max(maxY_local, unzoomedY);
            });
        });
        
        // Add padding to ensure box never intersects with pattern
        // Reduced padding to prevent excessive spacing
        const padding = 8;
        minX_local -= padding;
        minY_local -= padding;
        maxX_local += padding;
        maxY_local += padding;
        
        const width = maxX_local - minX_local;
        const height = maxY_local - minY_local;
        const center = {
            x: (minX_local + maxX_local) / 2,
            y: (minY_local + maxY_local) / 2
        };
        
        return { minX: minX_local, minY: minY_local, maxX: maxX_local, maxY: maxY_local, width, height, center };
    }

    /**
     * Get the bounding box data using the same logic as update()
     * This ensures handle positions match the displayed box
     */
    private getBoundingBoxData(): { width: number, height: number, center: IPoint } {
        const surface = surfaceManager.currentSurface;
        
        // Use fixed bounding box dimensions if available (set when rotation starts)
        // This keeps the box size fixed during and after rotation
        if (this.fixedBoundingBox) {
            // Calculate center from pattern centers (zCtx, zCty) instead of container bounds
            // This is more stable during rotation as pattern centers don't suffer from
            // PIXI bounds calculation variations
            let centerUnzoomed: IPoint;
            if (this.selectedPatterns.length === 1) {
                const pattern = this.selectedPatterns[0];
                centerUnzoomed = { x: pattern.zCtx, y: pattern.zCty };
            } else if (surface) {
                const points = this.selectedPatterns.map(pattern => ({
                    x: pattern.zCtx,
                    y: pattern.zCty
                }));
                centerUnzoomed = surface.getCenterPoint(points);
            } else {
                centerUnzoomed = this.fixedBoundingBox.center;
            }
            
            return {
                width: this.fixedBoundingBox.width,
                height: this.fixedBoundingBox.height,
                center: centerUnzoomed
            };
        } else {
            // Calculate fresh bounding box (only when fixedBoundingBox is not set)
            const calculated = this.calculateRotatedBoundingBox();
            return {
                width: calculated.width,
                height: calculated.height,
                center: calculated.center
            };
        }
    }

    /**
     * Get rotated box geometry (corners, midpoints, rotation handle position)
     * Returns positions in stage-relative coordinates
     */
    private getRotatedBoxGeometry(): {
        corners: IPoint[];
        midpoints: IPoint[];
        rotationHandle: IPoint;
        topMidpoint: IPoint;
        boxCenterScreen: IPoint;
    } {
        const surface = surfaceManager.currentSurface;
        if (!surface) {
            return {
                corners: [],
                midpoints: [],
                rotationHandle: { x: 0, y: 0 },
                topMidpoint: { x: 0, y: 0 },
                boxCenterScreen: { x: 0, y: 0 }
            };
        }

        const bboxData = this.getBoundingBoxData();
        const width_unzoomed = bboxData.width;
        const height_unzoomed = bboxData.height;
        const boxCenterUnzoomed = bboxData.center;

        // Get box rotation
        let boxRotation: number;
        if (this.selectedPatterns.length === 1) {
            boxRotation = this.selectedPatterns[0]._rotation;
        } else {
            boxRotation = this.selectedPatterns.reduce((sum, p) => sum + p._rotation, 0) / this.selectedPatterns.length;
        }
        const rotationRad = (boxRotation * Math.PI) / 180;
        const cos = Math.cos(rotationRad);
        const sin = Math.sin(rotationRad);

        // Convert to screen coordinates
        const zoomFactor = this.selectedPatterns[0].zoomFactor;
        const stageX = surface._app.stage.x;
        const stageY = surface._app.stage.y;

        // Convert box center to screen coordinates
        const boxCenterScreen = {
            x: boxCenterUnzoomed.x * zoomFactor + stageX,
            y: boxCenterUnzoomed.y * zoomFactor + stageY
        };

        // Calculate box corners in local (unrotated) space relative to box center
        const halfWidth = (width_unzoomed * zoomFactor) / 2;
        const halfHeight = (height_unzoomed * zoomFactor) / 2;
        const corners = [
            { x: -halfWidth, y: -halfHeight }, // Top-left
            { x: halfWidth, y: -halfHeight },  // Top-right
            { x: halfWidth, y: halfHeight },   // Bottom-right
            { x: -halfWidth, y: halfHeight }  // Bottom-left
        ];

        // Rotate corners around box center, then translate to screen position
        const rotatedCorners = corners.map(corner => {
            const rotatedX = corner.x * cos - corner.y * sin;
            const rotatedY = corner.x * sin + corner.y * cos;
            return {
                x: boxCenterScreen.x + rotatedX - stageX, // Convert to stage-relative
                y: boxCenterScreen.y + rotatedY - stageY  // Convert to stage-relative
            };
        });

        // Calculate midpoints
        const midpoints = [
            // Top midpoint (between top-left and top-right)
            {
                x: (rotatedCorners[0].x + rotatedCorners[1].x) / 2,
                y: (rotatedCorners[0].y + rotatedCorners[1].y) / 2
            },
            // Right midpoint (between top-right and bottom-right)
            {
                x: (rotatedCorners[1].x + rotatedCorners[2].x) / 2,
                y: (rotatedCorners[1].y + rotatedCorners[2].y) / 2
            },
            // Bottom midpoint (between bottom-right and bottom-left)
            {
                x: (rotatedCorners[2].x + rotatedCorners[3].x) / 2,
                y: (rotatedCorners[2].y + rotatedCorners[3].y) / 2
            },
            // Left midpoint (between bottom-left and top-left)
            {
                x: (rotatedCorners[3].x + rotatedCorners[0].x) / 2,
                y: (rotatedCorners[3].y + rotatedCorners[0].y) / 2
            }
        ];

        const topMidpoint = midpoints[0];
        
        // Calculate rotation handle position (above top midpoint, perpendicular to top edge)
        // Direction from box center to top midpoint
        const toTopMid = {
            x: topMidpoint.x - (boxCenterScreen.x - stageX),
            y: topMidpoint.y - (boxCenterScreen.y - stageY)
        };
        const distToTopMid = Math.sqrt(toTopMid.x * toTopMid.x + toTopMid.y * toTopMid.y);
        if (distToTopMid > 0) {
            const unitVector = {
                x: toTopMid.x / distToTopMid,
                y: toTopMid.y / distToTopMid
            };
            // Position rotation handle offset distance above top midpoint
            const rotationHandle = {
                x: topMidpoint.x + unitVector.x * (this.rotationHandleOffset * zoomFactor),
                y: topMidpoint.y + unitVector.y * (this.rotationHandleOffset * zoomFactor)
            };
            
            return {
                corners: rotatedCorners,
                midpoints,
                rotationHandle,
                topMidpoint,
                boxCenterScreen: { x: boxCenterScreen.x - stageX, y: boxCenterScreen.y - stageY }
            };
        }

        // Fallback if calculation fails
        return {
            corners: rotatedCorners,
            midpoints,
            rotationHandle: { x: topMidpoint.x, y: topMidpoint.y - (this.rotationHandleOffset * zoomFactor) },
            topMidpoint,
            boxCenterScreen: { x: boxCenterScreen.x - stageX, y: boxCenterScreen.y - stageY }
        };
    }

    /**
     * Check if the RotationSelectionBox is currently handling an interaction (rotating or dragging)
     */
    public isInteracting(): boolean {
        return this.isRotating || this.isDragging;
    }
    
    /**
     * Check if a click event is on the RotationSelectionBox elements (handles, box area, rotation zones)
     */
    public isClickOnBox(eventData: { x: number, y: number }): boolean {
        if (this.selectedPatterns.length === 0) return false;
        
        const surface = surfaceManager.currentSurface;
        if (!surface) return false;
        
        // Check rotation zones (rotation handle or outside corners)
        const rotationZone = this.checkRotationZone(eventData, surface);
        if (rotationZone !== null) {
            return true;
        }
        
        // Check if clicking inside the box
        if (this.checkBoxClick(eventData, surface)) {
            return true;
        }
        
        // Check if clicking on corner or midpoint handles
        const geometry = this.getRotatedBoxGeometry();
        const { corners, midpoints } = geometry;
        
        const stageX = surface._app.stage.x;
        const stageY = surface._app.stage.y;
        const eventX = eventData.x - stageX;
        const eventY = eventData.y - stageY;
        
        const handleSize = 6;
        const handleHitRadius = handleSize / 2 + 4;
        
        // Check corner handles
        for (const corner of corners) {
            const dx = eventX - corner.x;
            const dy = eventY - corner.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= handleHitRadius) {
                return true;
            }
        }
        
        // Check midpoint handles
        for (const midpoint of midpoints) {
            const dx = eventX - midpoint.x;
            const dy = eventY - midpoint.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= handleHitRadius) {
                return true;
            }
        }
        
        return false;
    }

    update() {
        const surface = surfaceManager.currentSurface;
        if (!surface || this.selectedPatterns.length === 0) {
            this.visible = false;
            this.clear();
            return;
        }

        this.visible = true;
        this.clear();

        // Calculate rotation center
        let rotationCenterUnzoomed: IPoint;
        
        if (this.selectedPatterns.length === 1) {
            const pattern = this.selectedPatterns[0];
            rotationCenterUnzoomed = { x: pattern.zCtx, y: pattern.zCty };
        } else {
            const points = this.selectedPatterns.map(pattern => ({
                x: pattern.zCtx,
                y: pattern.zCty
            }));
            rotationCenterUnzoomed = surface.getCenterPoint(points);
        }
        
        // Check for custom pivot point
        const pivotPoint = surface.getCustomPivotPoint();
        if (pivotPoint) {
            rotationCenterUnzoomed = pivotPoint;
        }
        
        // Store rotation center in unzoomed coordinates
        this.rotationCenter = rotationCenterUnzoomed;

        // Get rotated box geometry
        const geometry = this.getRotatedBoxGeometry();
        const { corners, midpoints, rotationHandle, topMidpoint } = geometry;

        // Draw rotated selection box (Adobe Illustrator style: simple blue outline)
        this.setStrokeStyle({ width: 1, color: 0x0066FF, alpha: 1 });
        this.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < corners.length; i++) {
            this.lineTo(corners[i].x, corners[i].y);
        }
        this.closePath();
        this.stroke();

        // Draw line from top midpoint to rotation handle (Adobe Illustrator style)
        this.setStrokeStyle({ width: 1, color: 0x0066FF, alpha: 1 });
        this.moveTo(topMidpoint.x, topMidpoint.y);
        this.lineTo(rotationHandle.x, rotationHandle.y);
        this.stroke();

        // Draw rotation handle (square, like Illustrator)
        const handleSize = 6;
        // Outer border (blue)
        this.setFillStyle({ color: 0x0066FF, alpha: 1 });
        this.rect(rotationHandle.x - handleSize / 2 - 1, rotationHandle.y - handleSize / 2 - 1, handleSize + 2, handleSize + 2);
        this.fill();
        // Inner fill (white)
        this.setFillStyle({ color: 0xFFFFFF, alpha: 1 });
        this.rect(rotationHandle.x - handleSize / 2, rotationHandle.y - handleSize / 2, handleSize, handleSize);
        this.fill();

        // Draw 8 handles: 4 at corners (for resizing) + 4 at midpoints (for resizing)
        // Adobe Illustrator style: simple square handles
        // Corner handles
        corners.forEach(corner => {
            // Outer border (blue)
            this.setFillStyle({ color: 0x0066FF, alpha: 1 });
            this.rect(corner.x - handleSize / 2 - 1, corner.y - handleSize / 2 - 1, handleSize + 2, handleSize + 2);
            this.fill();
            // Inner fill (white)
            this.setFillStyle({ color: 0xFFFFFF, alpha: 1 });
            this.rect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
            this.fill();
        });
        
        // Midpoint handles (for resizing)
        midpoints.forEach(midpoint => {
            // Outer border (blue)
            this.setFillStyle({ color: 0x0066FF, alpha: 1 });
            this.rect(midpoint.x - handleSize / 2 - 1, midpoint.y - handleSize / 2 - 1, handleSize + 2, handleSize + 2);
            this.fill();
            // Inner fill (white)
            this.setFillStyle({ color: 0xFFFFFF, alpha: 1 });
            this.rect(midpoint.x - handleSize / 2, midpoint.y - handleSize / 2, handleSize, handleSize);
            this.fill();
        });
    }

    override onRawEventMouseDown(eventData: { x: number, y: number, button: number, ctrlKey?: boolean, shiftKey?: boolean }): void {
        if (eventData.button !== 0 || this.selectedPatterns.length === 0) return;

        const surface = surfaceManager.currentSurface;
        if (!surface) return;
        
        // Check if clicking on rotation handle (above top edge)
        // Rotation should still work in customPivotMode (using the custom pivot point)
        if (this.checkRotationHandleClick(eventData, surface)) {
            return; // Rotation handle click handled
        }
        
        // Check if clicking just outside a corner handle (for rotation, like Illustrator)
        // Rotation should still work in customPivotMode (using the custom pivot point)
        const clickedOutsideCorner = this.checkOutsideCornerClick(eventData, surface);
        if (clickedOutsideCorner) {
            return; // Outside corner click handled for rotation
        }
        
        // When focal pivot mode is active, don't handle box interior clicks for dragging
        // This allows Surface.clickHandler to place the pivot point inside the box
        if (surface.customPivotMode) {
            return;
        }
        
        // Check if clicking on the box itself (not on handles)
        if (this.checkBoxClick(eventData, surface)) {
            // Start dragging the box and patterns
            this.startDragging(eventData, surface);
            return;
        }
    }
    
    /**
     * Check if mouse is hovering over rotation zone (rotation handle or just outside corners)
     * Returns: 'rotation-handle' | 'outside-corner' | null
     */
    private checkRotationZone(eventData: { x: number, y: number }, surface: any): 'rotation-handle' | 'outside-corner' | null {
        const geometry = this.getRotatedBoxGeometry();
        const { corners, rotationHandle } = geometry;
        
        // Convert event coordinates from canvas to stage-relative coordinates
        const stageX = surface._app.stage.x;
        const stageY = surface._app.stage.y;
        const eventX = eventData.x - stageX;
        const eventY = eventData.y - stageY;
        
        const handleSize = 6;
        const handleHitRadius = handleSize / 2 + 4;
        const rotationZoneRadius = 12; // Radius for detecting "just outside" corner handles
        
        // Check rotation handle
        const dx = eventX - rotationHandle.x;
        const dy = eventY - rotationHandle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= handleHitRadius) {
            return 'rotation-handle';
        }
        
        // Check if hovering just outside corner handles (Illustrator style)
        for (const corner of corners) {
            const cornerDx = eventX - corner.x;
            const cornerDy = eventY - corner.y;
            const cornerDist = Math.sqrt(cornerDx * cornerDx + cornerDy * cornerDy);
            
            // If outside the handle but within rotation zone
            if (cornerDist > handleHitRadius && cornerDist <= rotationZoneRadius) {
                return 'outside-corner';
            }
        }
        
        return null;
    }
    
    private checkRotationHandleClick(eventData: { x: number, y: number }, surface: any): boolean {
        const geometry = this.getRotatedBoxGeometry();
        const { rotationHandle } = geometry;
        
        // Convert event coordinates from canvas to stage-relative coordinates
        const stageX = surface._app.stage.x;
        const stageY = surface._app.stage.y;
        const eventX = eventData.x - stageX;
        const eventY = eventData.y - stageY;
        
        const handleSize = 6;
        const handleHitRadius = handleSize / 2 + 4;
        
        const dx = eventX - rotationHandle.x;
        const dy = eventY - rotationHandle.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= handleHitRadius) {
            const boxCenterScreen = {
                x: geometry.boxCenterScreen.x + stageX,
                y: geometry.boxCenterScreen.y + stageY
            };
            this.startRotation(eventData, surface, boxCenterScreen, stageX, stageY);
            return true;
        }
        
        return false;
    }
    
    private checkOutsideCornerClick(eventData: { x: number, y: number }, surface: any): boolean {
        const geometry = this.getRotatedBoxGeometry();
        const { corners } = geometry;
        
        // Convert event coordinates from canvas to stage-relative coordinates
        const stageX = surface._app.stage.x;
        const stageY = surface._app.stage.y;
        const eventX = eventData.x - stageX;
        const eventY = eventData.y - stageY;
        
        const handleSize = 6;
        const handleHitRadius = handleSize / 2 + 4;
        const rotationZoneRadius = 12; // Radius for detecting "just outside" corner handles
        
        // Check if clicking just outside any corner handle
        for (const corner of corners) {
            const dx = eventX - corner.x;
            const dy = eventY - corner.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // If outside the handle but within rotation zone (Illustrator behavior)
            if (dist > handleHitRadius && dist <= rotationZoneRadius) {
                const boxCenterScreen = {
                    x: geometry.boxCenterScreen.x + stageX,
                    y: geometry.boxCenterScreen.y + stageY
                };
                this.startRotation(eventData, surface, boxCenterScreen, stageX, stageY);
                return true;
            }
        }
        
        return false;
    }
    
    private checkBoxClick(eventData: { x: number, y: number }, surface: any): boolean {
        const geometry = this.getRotatedBoxGeometry();
        const { corners, midpoints, rotationHandle } = geometry;
        
        // Convert event coordinates from canvas to stage-relative coordinates
        const stageX = surface._app.stage.x;
        const stageY = surface._app.stage.y;
        const eventX = eventData.x - stageX;
        const eventY = eventData.y - stageY;
        
        const handleSize = 6;
        const handleHitRadius = handleSize / 2 + 4;
        const rotationZoneRadius = 12;
        
        // First check if click is on any handle (corners, midpoints, or rotation handle)
        const allHandles = [...corners, ...midpoints, rotationHandle];
        
        for (const handle of allHandles) {
            const dx = eventX - handle.x;
            const dy = eventY - handle.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= handleHitRadius) {
                return false; // Clicked on a handle, not the box
            }
        }
        
        // Also check rotation zones (outside corners)
        for (const corner of corners) {
            const dx = eventX - corner.x;
            const dy = eventY - corner.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > handleHitRadius && dist <= rotationZoneRadius) {
                return false; // Clicked in rotation zone
            }
        }
        
        // Point-in-polygon test for rotated box
        let inside = false;
        for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
            const xi = corners[i].x, yi = corners[i].y;
            const xj = corners[j].x, yj = corners[j].y;
            
            const intersect = ((yi > eventY) !== (yj > eventY)) &&
                (eventX < (xj - xi) * (eventY - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        
        return inside;
    }
    
    private startDragging(eventData: { x: number, y: number }, surface: any): void {
        if (this.isDragging || this.selectedPatterns.length === 0) return;
        
        this.isDragging = true;
        this.dragStartPoint = { x: eventData.x, y: eventData.y };
        
        // Store initial pattern positions (in unzoomed coordinates)
        this.dragStartPatternPositions.clear();
        this.selectedPatterns.forEach(pattern => {
            this.dragStartPatternPositions.set(pattern._guid, {
                x: pattern.zCtx,
                y: pattern.zCty
            });
        });
        
        // Capture before states for undo/redo
        this.dragBeforeStates.clear();
        this.selectedPatterns.forEach(pattern => {
            const beforeState = undoRedoManager.capturePatternState(pattern._guid);
            if (beforeState) {
                this.dragBeforeStates.set(pattern._guid, beforeState);
            }
        });
    }
    
    private startRotation(eventData: { x: number, y: number }, surface: any, boxCenterScreen: { x: number, y: number }, stageX: number, stageY: number): void {
        if (this.isRotating) return;
        
        this.isRotating = true;
        
        // Calculate rotation center using the same logic as existing rotation (Ctrl+mouse wheel)
        let rotationCenterUnzoomed: IPoint;
        
        if (this.selectedPatterns.length === 1) {
            // Single pattern: rotate around its center
            const pattern = this.selectedPatterns[0];
            rotationCenterUnzoomed = { x: pattern.zCtx, y: pattern.zCty };
        } else {
            // Multiple patterns: rotate around their collective center
            const points = this.selectedPatterns.map(pattern => ({
                x: pattern.zCtx,
                y: pattern.zCty
            }));
            rotationCenterUnzoomed = surface.getCenterPoint(points);
        }
        
        // Check for custom pivot point (same as Ctrl+mouse wheel)
        const pivotPoint = surface.getCustomPivotPoint();
        if (pivotPoint) {
            rotationCenterUnzoomed = pivotPoint;
            this.hasPivotPoint = true;
        } else {
            this.hasPivotPoint = false;
        }
        
        // Store rotation center in unzoomed coordinates (for rotation calculations)
        this.rotationCenter = rotationCenterUnzoomed;
        
        // Capture the maximum bounding box dimensions that would contain the pattern at any rotation
        // This prevents the box from resizing during rotation and ensures it always contains the pattern
        const maxBbox = this.calculateMaxBoundingBoxForRotation();
        const currentBbox = this.calculateRotatedBoundingBox();
        this.fixedBoundingBox = {
            width: maxBbox.width,
            height: maxBbox.height,
            center: currentBbox.center
        };
        
        // Capture before states
        this.selectedPatterns.forEach(pattern => {
            const beforeState = undoRedoManager.capturePatternState(pattern._guid);
            if (beforeState) {
                this.rotationBeforeStates.set(pattern._guid, beforeState);
            }
        });

        // Store initial positions and rotations of all patterns
        // Store in unzoomed coordinates (same as zCtx/zCty)
        this.initialPatternPositions.clear();
        this.selectedPatterns.forEach(pattern => {
            this.initialPatternPositions.set(pattern._guid, {
                x: pattern.zCtx, // Unzoomed coordinates
                y: pattern.zCty, // Unzoomed coordinates
                rotation: pattern._rotation
            });
        });

        // Calculate initial mouse angle relative to rotation center (same as Ctrl+mouse wheel)
        // Convert rotation center from unzoomed to screen coordinates
        const zoomFactor = this.selectedPatterns[0].zoomFactor;
        const rotationCenterScreen = {
            x: rotationCenterUnzoomed.x * zoomFactor + stageX,
            y: rotationCenterUnzoomed.y * zoomFactor + stageY
        };
        
        this.rotationStartMouseAngle = Math.atan2(
            eventData.y - rotationCenterScreen.y,
            eventData.x - rotationCenterScreen.x
        );
    }

    override onRawEventMouseMove(eventData: { x: number, y: number, button: number }): void {
        const surface = surfaceManager.currentSurface;
        if (!surface) return;
        
        // Check for hover over rotation zones to change cursor (like Illustrator)
        if (!this.isDragging && !this.isRotating && this.selectedPatterns.length > 0) {
            const rotationZone = this.checkRotationZone(eventData, surface);
            const canvas = surface._app.canvas as HTMLCanvasElement;
            if (canvas) {
                if (rotationZone === 'rotation-handle' || rotationZone === 'outside-corner') {
                    // Use a rotation cursor (curved arrows) - use 'grab' for now, can be changed to custom cursor
                    canvas.style.cursor = 'grab';
                } else {
                    // Only reset cursor if we're not in any other special mode
                    if (!this.isDragging) {
                        canvas.style.cursor = 'default';
                    }
                }
            }
        }
        
        // Handle dragging
        if (this.isDragging && this.selectedPatterns.length > 0) {
            const deltaX = eventData.x - this.dragStartPoint.x;
            const deltaY = eventData.y - this.dragStartPoint.y;
            
            // Convert screen delta to unzoomed coordinates
            const zoomFactor = this.selectedPatterns[0].zoomFactor;
            const deltaXUnzoomed = deltaX / zoomFactor;
            const deltaYUnzoomed = deltaY / zoomFactor;
            
            // Move all selected patterns based on their initial positions
            this.selectedPatterns.forEach(pattern => {
                const initialPos = this.dragStartPatternPositions.get(pattern._guid);
                if (initialPos) {
                    // Update pattern position (zCtx/zCty are in unzoomed coordinates)
                    pattern.zCtx = initialPos.x + deltaXUnzoomed;
                    pattern.zCty = initialPos.y + deltaYUnzoomed;
                    pattern.display();
                }
            });
            
            // Update the selection box
            this.update();
            
            return;
        }
        
        // Handle rotation
        if (!this.isRotating || this.selectedPatterns.length === 0) return;

        // Set cursor to grabbing during rotation
        const canvas = surface._app.canvas as HTMLCanvasElement;
        if (canvas) {
            canvas.style.cursor = 'grabbing';
        }

        // Calculate current mouse angle relative to the rotation center (same as Ctrl+mouse wheel)
        // Convert rotation center from unzoomed to screen coordinates
        const zoomFactor = this.selectedPatterns[0].zoomFactor;
        const stageX = surface._app.stage.x;
        const stageY = surface._app.stage.y;
        const rotationCenterScreen = {
            x: this.rotationCenter.x * zoomFactor + stageX,
            y: this.rotationCenter.y * zoomFactor + stageY
        };
        
        const currentMouseAngle = Math.atan2(
            eventData.y - rotationCenterScreen.y,
            eventData.x - rotationCenterScreen.x
        );
        const angleDelta = currentMouseAngle - this.rotationStartMouseAngle;
        const rotationDeltaDeg = (angleDelta * 180) / Math.PI;

        // Apply rotation to all selected patterns using the same logic as existing rotation
        this.selectedPatterns.forEach(pattern => {
            const initialPos = this.initialPatternPositions.get(pattern._guid);
            if (!initialPos) return;
            
            // Get current center position (in unzoomed coordinates)
            const currentCenter = { x: initialPos.x, y: initialPos.y };
            
            // Update rotation
            pattern._rotation = initialPos.rotation + rotationDeltaDeg;
            pattern.applyTransformations({ rotate: true, translate: false });
            
            // For multiple patterns: always move centers around collective center (same as Ctrl+mouse wheel)
            // For single pattern: only move center if there's a pivot point
            const shouldMoveCenter = this.selectedPatterns.length > 1 || this.hasPivotPoint;
            
            if (shouldMoveCenter) {
                // Calculate new position using the same method as existing rotation
                const finalRotation = surface.getRotatedPosition(
                    currentCenter,
                    this.rotationCenter, // Already in unzoomed coordinates
                    rotationDeltaDeg
                );
                
                // Update pattern position (zCtx/zCty are in unzoomed coordinates)
                pattern.zCtx = finalRotation.x;
                pattern.zCty = finalRotation.y;
            }
            pattern.display();
        });

        // Update the selection box
        this.update();

        // Debounced save
        this.recordRotationEnd();
    }

    override onRawEventMouseUp(eventData: { x: number, y: number, button: number }): void {
        const surface = surfaceManager.currentSurface;
        
        if (this.isDragging) {
            this.isDragging = false;
            this.recordDragEnd();
            
            // Suppress the next click to prevent deselection after drag
            if (surface) {
                surface._suppressNextClick = true;
                surface._didDrag = true;
            }
            
            // Refresh the rotation selection box to ensure it remains visible after drag
            // Get current selected patterns and update the selection box
            if (surface && this.selectedPatterns.length > 0) {
                // Ensure patterns remain selected
                this.selectedPatterns.forEach(pattern => {
                    if (pattern._state !== 'selected') {
                        pattern.setState('selected');
                    }
                });
                
                // Sync with surface's multiSelection array
                surface.multiSelection = [...this.selectedPatterns];
                
                // Refresh the selection box display
                this.update();
                
                // Also update via surface to sync with multiSelection
                surface.updateRotationSelectionBox();
            }
        }
        
        if (this.isRotating) {
            this.isRotating = false;
            // Keep fixedBoundingBox after rotation ends to maintain fixed size
            // It will only be cleared when selection changes (in updateSelection)
            this.hasPivotPoint = false; // Reset pivot point flag
            this.recordRotationEnd();
            
            // Suppress the next click to prevent deselection after rotation
            if (surface) {
                surface._suppressNextClick = true;
                surface._didDrag = true;
            }
            
            // Refresh the rotation selection box to ensure it remains visible after rotation
            // Get current selected patterns and update the selection box
            if (surface && this.selectedPatterns.length > 0) {
                // Ensure patterns remain selected
                this.selectedPatterns.forEach(pattern => {
                    if (pattern._state !== 'selected') {
                        pattern.setState('selected');
                    }
                });
                
                // Sync with surface's multiSelection array
                surface.multiSelection = [...this.selectedPatterns];
                
                // Refresh the selection box display
                this.update();
                
                // Also update via surface to sync with multiSelection
                surface.updateRotationSelectionBox();
            }
        }
        
        // Reset cursor
        if (surface) {
            const canvas = surface._app.canvas as HTMLCanvasElement;
            if (canvas) {
                canvas.style.cursor = 'default';
            }
        }
    }
    
    private recordDragEnd(): void {
        // Record undo/redo actions for drag
        this.dragBeforeStates.forEach((beforeState, patternGuid) => {
            const pattern = this.selectedPatterns.find(p => p._guid === patternGuid);
            if (pattern) {
                const afterState = undoRedoManager.capturePatternState(patternGuid);
                if (afterState) {
                    undoRedoManager.recordPatternAction({
                        type: 'move',
                        patternGuid: patternGuid,
                        beforeState: beforeState,
                        afterState: afterState,
                        metadata: {}
                    });
                }
            }
        });

        this.dragBeforeStates.clear();
        surfaceManager.saveSlectedSurface();
    }

    private recordRotationEnd(): void {
        if (this.rotationDebounceTimer) {
            clearTimeout(this.rotationDebounceTimer);
        }

        this.rotationDebounceTimer = setTimeout(() => {
            // Record undo/redo actions
            this.rotationBeforeStates.forEach((beforeState, patternGuid) => {
                const pattern = this.selectedPatterns.find(p => p._guid === patternGuid);
                if (pattern) {
                    const afterState = undoRedoManager.capturePatternState(patternGuid);
                    if (afterState) {
                        undoRedoManager.recordPatternAction({
                            type: 'rotate',
                            patternGuid: patternGuid,
                            beforeState: beforeState,
                            afterState: afterState,
                            metadata: {}
                        });
                    }
                }
            });

            this.rotationBeforeStates.clear();
            surfaceManager.saveSlectedSurface();
        }, 300);
    }

    override dispose(): void {
        if (this.rotationDebounceTimer) {
            clearTimeout(this.rotationDebounceTimer);
        }
        super.dispose();
    }
}

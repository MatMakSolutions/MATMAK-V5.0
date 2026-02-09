import * as PIXI from 'pixi.js';

export class RulerTool2 {
    private stage: PIXI.Container;
    private graphics: PIXI.Graphics;
    private text: PIXI.Text;
    private isMeasuring: boolean = false;
    private startX: number = 0;
    private startY: number = 0;
    private unit: 'mm' | 'inch';

    constructor(stage: PIXI.Container, unit: 'mm' | 'inch' = 'mm') {
        this.stage = stage;
        this.graphics = new PIXI.Graphics();
        this.text = new PIXI.Text('', {
            fontSize      : 12,
            fill          : 0x000000,
            align         : 'center',
            letterSpacing : 1,
            fontFamily    : 'Arial'
        });

        this.stage.addChild(this.graphics);
        this.stage.addChild(this.text);
        this.unit = unit;

        this.stage.eventMode = 'static';
        this.stage.hitArea = new PIXI.Rectangle(0, 0, 5000, 5000);

        this.stage.on('pointerdown', this.onPointerDown, this);
        this.stage.on('pointermove', this.onPointerMove, this);
        this.stage.on('pointerup', this.onPointerUp, this);
        this.stage.on('pointerupoutside', this.onPointerUp, this);
    }

    private onPointerDown(event: PIXI.FederatedPointerEvent): void {
        const { x, y } = event.getLocalPosition(this.stage);
        this.startX = x;
        this.startY = y;
        this.isMeasuring = true;

        this.graphics.clear();
        this.graphics.beginFill(0xff0000); // Red dot
        this.graphics.drawCircle(this.startX, this.startY, 3);
        this.graphics.endFill();
    }

    private onPointerMove(event: PIXI.FederatedPointerEvent): void {
        if (!this.isMeasuring) return;

        const { x, y } = event.getLocalPosition(this.stage);
        const dx = x - this.startX;
        const dy = y - this.startY;
        const distancePx = Math.sqrt(dx * dx + dy * dy);

        // Convert to mm/inches
        const distance = this.unit === 'metric' ? distancePx : distancePx / 25.4;
        const formattedDistance = distance.toFixed(1) + (this.unit === 'metric' ? ' mm' : ' in');

        // Calculate angle for text rotation
        const angleRad = Math.atan2(dy, dx);

        this.graphics.clear();

        // Draw start point
        this.graphics.beginFill(0xff0000);
        this.graphics.drawCircle(this.startX, this.startY, 3);
        this.graphics.endFill();

        // Draw ruler line with blue color
        this.graphics.moveTo(this.startX, this.startY);
        this.graphics.lineTo(x, y);
        this.graphics.fill(0x25A9E0);
        this.graphics.setStrokeStyle({color: 0x25A9E0, width: 2, pixelLine: true});
        this.graphics.stroke();

        this.graphics.beginFill(0xff0000);
        this.graphics.drawCircle(x, y, 3);
        this.graphics.endFill();

       // Draw measurement text
const textX = (this.startX + x) / 2;
const textY = (this.startY + y) / 2;

// Offset perpendicular to the line direction
const offsetDistance = 15; // Distance above the line
const perpendicularAngle = Math.atan2(dy, dx) + Math.PI / 2;
const offsetX = Math.cos(perpendicularAngle) * offsetDistance;
const offsetY = Math.sin(perpendicularAngle) * offsetDistance;

// Ensure the text is never upside down
let adjustedAngle = Math.atan2(dy, dx);
if (adjustedAngle > Math.PI / 2 || adjustedAngle < -Math.PI / 2) {
    adjustedAngle += Math.PI; // Flip the text to keep it upright
}

// Update text
this.text.text = formattedDistance;
this.text.position.set(textX + offsetX, textY + offsetY);
this.text.anchor.set(0.5);
this.text.rotation = adjustedAngle;

            }

    private onPointerUp(): void {
        this.isMeasuring = false;
    }

    public destroy(): void {
        this.stage.off('pointerdown', this.onPointerDown, this);
        this.stage.off('pointermove', this.onPointerMove, this);
        this.stage.off('pointerup', this.onPointerUp, this);
        this.stage.off('pointerupoutside', this.onPointerUp, this);

        this.stage.removeChild(this.graphics);
        this.stage.removeChild(this.text);
        this.graphics.destroy();
        this.text.destroy();
    }
}


export class RulerTool {
    private stage: PIXI.Container;
    private graphics: PIXI.Graphics;
    private text: PIXI.Text;
    private tickLabels: PIXI.Container;
    private isMeasuring: boolean = false;
    private startX: number = 0;
    private startY: number = 0;
    private unit: 'metric' | 'imperial';
    private graduation: number;
    private keepOnRelease: boolean;
    private zoomFactor: number;

    constructor(stage: PIXI.Container, unit: 'metric' | 'imperial' = 'metric', graduation: number = 10, keepOnRelease: boolean = false, zoomFactor: number = 1) {
        this.stage = stage;
        this.graphics = new PIXI.Graphics();
        this.text = new PIXI.Text('', {
            fontSize      : 12,
            fill          : 0x000000,
            align         : 'center',
            letterSpacing : 1,
            fontFamily    : 'Arial'
        });
        this.tickLabels = new PIXI.Container();

        // Add directly to stage at 0,0
        this.stage.addChild(this.graphics);
        this.stage.addChild(this.text);
        this.stage.addChild(this.tickLabels);
        
        this.unit = unit;
        this.graduation = graduation;
        this.keepOnRelease = keepOnRelease;
        this.zoomFactor = zoomFactor;
    }

    public startMeasuring(x: number, y: number): void {
        this.startX = x;
        this.startY = y;
        this.isMeasuring = true;

        // Clear all graphics and reset
        this.graphics.clear();
        this.tickLabels.removeChildren();
        this.text.text = '';
    }

    public updateMeasuring(x: number, y: number): void {
        if (!this.isMeasuring) return;

        const dx = x - this.startX;
        const dy = y - this.startY;
        const distancePx = Math.sqrt(dx * dx + dy * dy);

        // Convert pixels to mm accounting for zoom (1px = 1mm at zoom=1)
        const distanceMm = distancePx / this.zoomFactor;
        
        // Convert to the configured unit for the central measurement text
        const distance = this.unit === 'metric' ? distanceMm : distanceMm / 25.4;
        const formattedDistance = distance.toFixed(1) + (this.unit === 'metric' ? ' mm' : ' in');

        // Calculate the angle of the measured line
        const lineAngle = Math.atan2(dy, dx);

        this.graphics.clear();
        // Clear tick labels for each update
        this.tickLabels.removeChildren();

        // Draw main ruler line with blue color
        this.graphics.moveTo(this.startX, this.startY);
        this.graphics.lineTo(x, y);
        this.graphics.setStrokeStyle({ color: 0x25A9E0, width: 2, pixelLine: true });
        this.graphics.stroke();

        // --- Graduation Tick Marks ---
        // Account for zoom: at zoom=1, 1px = 1mm
        const majorSpacing = this.unit === 'metric' 
            ? (this.graduation * 10 * this.zoomFactor)  // Major tick every 10 graduations, scaled by zoom
            : (this.graduation * 254 * this.zoomFactor); // Major tick based on graduation in inches, scaled by zoom
        const minorSpacing = this.unit === 'metric' 
            ? (this.graduation * this.zoomFactor)        // Minor tick at each graduation, scaled by zoom
            : (this.graduation * 25.4 * this.zoomFactor);  // Minor tick based on graduation, scaled by zoom
        const majorTickLength = 10; // Length for major tick marks
        const minorTickLength = 5;  // Length for minor tick marks
        const totalDistance = distancePx;
        // Compute the perpendicular direction relative to the line
        const perpendicularAngle = lineAngle + Math.PI / 2;

        // Draw ticks along the line at each minor interval
        for (let pos = minorSpacing; pos < totalDistance; pos += minorSpacing) {
            const t = pos / totalDistance;
            const tickX = this.startX + t * dx;
            const tickY = this.startY + t * dy;
            // Determine if this is a major tick (using a small tolerance)
            const isMajor = Math.abs(pos % majorSpacing) < 0.001;
            const tickLength = isMajor ? majorTickLength : minorTickLength;
            this.graphics.moveTo(tickX, tickY);
            this.graphics.lineTo(
                tickX + Math.cos(perpendicularAngle) * tickLength,
                tickY + Math.sin(perpendicularAngle) * tickLength
            );
        }
        // --- End of Graduation Tick Marks ---

        this.graphics.fill(0xff3300);
        this.graphics.setStrokeStyle({ color: 0x000000, width: 1, pixelLine: true });
        this.graphics.stroke();

        // --- Add Tick Labels for Major Ticks ---
        // Only add labels on major ticks, with text according to the configured unit.
        for (let pos = majorSpacing; pos < totalDistance; pos += majorSpacing) {
            const t = pos / totalDistance;
            const tickX = this.startX + t * dx;
            const tickY = this.startY + t * dy;
            // Compute the end position of the major tick
            const tickEndX = tickX + Math.cos(perpendicularAngle) * majorTickLength;
            const tickEndY = tickY + Math.sin(perpendicularAngle) * majorTickLength;
            // Calculate the label's value based on the unit
            let value: number;
            let labelValue: string;
            
            if (this.unit === 'metric') {
                // For metric, convert pixels to mm accounting for zoom
                value = pos / this.zoomFactor;
                // Always show in mm
                labelValue = "  " + value.toFixed(0) + " mm  "
            } else {
                // For imperial, convert pixels to inches accounting for zoom
                value = (pos / this.zoomFactor) / 25.4;
                labelValue = "  " + value.toFixed(2) + " in  ";
            }
            const label = new PIXI.Text(labelValue, {
                fontSize   : 12,
                fill       : 0x000000,
                align      : 'center',
                fontFamily : 'Arial'
            });
            label.anchor.set(0.5);
            // Position the label at the end of the tick with a slight offset
            const extraOffset = 10;
            label.position.set(
                tickEndX + Math.cos(perpendicularAngle) * extraOffset,
                tickEndY + Math.sin(perpendicularAngle) * extraOffset
            );



            // Rotate the label so its orientation is 45° relative to the line.
            // Compute initial rotation
            let tickLabelAngle = lineAngle - Math.PI / 4;
            // Adjust to ensure the label remains upright
            if (tickLabelAngle > Math.PI / 2 || tickLabelAngle < -Math.PI / 2) {
                tickLabelAngle += Math.PI;
            }
            label.rotation = tickLabelAngle;
            this.tickLabels.addChild(label);
        }
        // --- End of Tick Labels ---

        // Draw end point
        this.graphics.beginFill(0xff0000);
        this.graphics.drawCircle(x, y, 3);
        this.graphics.endFill();

        // Draw central measurement text (positioned above the line)
        const textX = (this.startX + x) / 2;
        const textY = (this.startY + y) / 2;
        const offsetDistance = 50; // Distance above the line
        const perpendicularForText = lineAngle + Math.PI / 2;
        const offsetX = Math.cos(perpendicularForText) * offsetDistance;
        const offsetY = Math.sin(perpendicularForText) * offsetDistance;
        // Ensure the central text remains upright
        let adjustedAngle = lineAngle;
        if (adjustedAngle > Math.PI / 2 || adjustedAngle < -Math.PI / 2) {
            adjustedAngle += Math.PI;
        }
        this.text.text = formattedDistance;
        this.text.position.set(textX + offsetX, textY + offsetY);
        this.text.anchor.set(0.5);
        this.text.rotation = adjustedAngle;
    }

    public endMeasuring(): void {
        this.isMeasuring = false;
        
        if (!this.keepOnRelease) {
            this.clear();
        }
    }
    
    public clear(): void {
        this.graphics.clear();
        this.tickLabels.removeChildren();
        this.text.text = '';
    }
    
    public updateSettings(unit: 'metric' | 'imperial', graduation: number, keepOnRelease: boolean, zoomFactor?: number): void {
        this.unit = unit;
        this.graduation = graduation;
        this.keepOnRelease = keepOnRelease;
        if (zoomFactor !== undefined) {
            this.zoomFactor = zoomFactor;
        }
    }

    public destroy(): void {
        this.stage.removeChild(this.graphics);
        this.stage.removeChild(this.text);
        this.stage.removeChild(this.tickLabels);
        this.graphics.destroy();
        this.text.destroy();
        this.tickLabels.destroy();
    }
}

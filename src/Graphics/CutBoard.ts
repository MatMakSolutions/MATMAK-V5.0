import { surfaceCollection } from "../data/repository/SurfaceCollection";
import { config } from "../core/Constant";
import { convertMm } from "../core/LiveConfig";
import { ZoomInAction } from "../cutboard/BoardSurface/Events/Zoom/ZoomIn";
import { DisplayObject } from "./DisplayObject";
import { surfaceManager } from "./SurfaceManager";
import { ContainerChild, Graphics, Text, Container } from "pixi.js";
import { Annotation } from "../ui/controls/AnnotationPopup/AnnotationPopup";

export class CutBoard extends DisplayObject {
  _boardWidth           : number = 0;
  _boardLength          : number = 0;
  _color                : number = 0x000000;
  _displayMaterialUsage: boolean = false;
  _showGrid: boolean = true;
  legends: Map<number, string> = new Map();
  annotations: Annotation[] = [];
  annotationContainer: Container | null = null;


  constructor() {
    super();
    this.setInteractivity(false);
    this._zoomFactor = 1;
  }

  darkenColorNum(color: number, percent: number): number {
    const amt = Math.max(0, Math.min(100, percent)) / 100;

    const r = Math.floor(((color >> 16) & 0xff) * (1 - amt));
    const g = Math.floor(((color >> 8) & 0xff) * (1 - amt));
    const b = Math.floor((color & 0xff) * (1 - amt));

    return (r << 16) | (g << 8) | b;
  }

  toggleMaterialUsage() {
    this._displayMaterialUsage = !this._displayMaterialUsage;
    this.update();
  }

  toggleGrid() {
    this._showGrid = !this._showGrid;
    this.update();
  }

  update(): void {
    this.clear();
    this.children.forEach((child: ContainerChild) => {
      child.visible = false;
    });
    this.removeChildren();

    // Legends
    let x = 0;
    let y = - 20;

    if (this.legends.size === 0) {
      const surfaceItems = surfaceManager.currentSurface?._Patterns;
      const surfacedataItems = surfaceCollection.selectedSurfaceData.patterns;

      // We need to rebuild the legend object
      this.legends.clear();

      surfacedataItems.forEach((item, index) => {
        this.legends.set(Number(item.patternColor), item.patternName);
      });


    }

    this.legends.forEach((value, key) => {
      const legend = new Text({text: `${value}`, style: { fontSize: 12, fill: this.darkenColorNum(key, 30) }});
      legend.alpha = 0.5;
      legend.position.set(x, y);
      this.addChild(legend);
      y -= 20;
    });
    // end legends

    // Rectangle from 0,0 with Length as width and width as height
    this.rect(0, 0, this.z(this._boardLength), this.z(this._boardWidth));
    this.stroke({ color: this._color, alpha: 1 , pixelLine: true});
  const isBoardHorizontal = this._boardWidth < this._boardLength; 
 

        // Draw a grid every 50 pixels on the board (only if enabled)
        if (this._showGrid) {
        const gridSize =this.z(100);
        const gridColor = 0x000000;
        const gridAlpha = 0.2;
        const gridWidth = 1;
        let tickIndex = 0;

        for (let i = 0; i <= this.z(this._boardLength); i += gridSize) {
          this.setStrokeStyle({width: gridWidth, color: gridColor, alpha: gridAlpha, pixelLine: true});
          this.moveTo(i, 0);
          this.lineTo(i, this.z(this._boardWidth));
          this.stroke();
          if (tickIndex % 10 === 0 && tickIndex > 0) {
            this.setStrokeStyle({width: 2, color: gridColor, alpha: 1});
            this.moveTo(i, 0);
            this.lineTo(i, this.z(-100));
            this.stroke();
            const tickMeasure = convertMm((tickIndex/10)*1000, 'inches');
            // should display in m or in
            const text = new Text({text: `${tickMeasure[1] === "Metric" ? (tickIndex/10).toFixed(2) : tickMeasure[0]} ${tickMeasure[1] === "Metric" ? "m" : "in"}`, style: { fontSize: 12, fill: 0x000000 }});
            //const text = new PIXI.Text(`${tickIndex/10}m`, { fontSize: 12, fill: 0x000000 });
            text.position.set(i + 10, this.z(-100) );
            this.addChild(text)
          }
          tickIndex++;
        }
        tickIndex = 0;
       if (!isBoardHorizontal){
        for (let i = 0; i <= this.z(this._boardWidth); i += gridSize) {
          // Implement here as well the tick vertically, drawn on teh left side of the board
          this.setStrokeStyle({width: gridWidth, color: gridColor, alpha: gridAlpha});
          this.moveTo(0, i);
          this.lineTo(this.z(this._boardLength), i);
          this.stroke();
          if (tickIndex % 10 === 0 && tickIndex > 0) {
            this.setStrokeStyle({width: 2, color: gridColor, alpha: 1, pixelLine: true});
            this.moveTo(0, i);
            this.lineTo(this.z(-100), i);
            this.stroke();
            const tickMeasure = convertMm((tickIndex/10)*1000, 'inches');
            // should display in m or in
            const text = new Text({text: `${tickMeasure[1] === "Metric" ? (tickIndex/10).toFixed(2) : tickMeasure[0]} ${tickMeasure[1] === "Metric" ? "m" : "in"}`,style:  { fontSize: 12, fill: 0x000000 }});
            //const text = new PIXI.Text(`${tickIndex/10}m`, { fontSize: 12, fill: 0x000000 });
            text.position.set(this.z(-300), i + 10);
            this.addChild(text)
          }
          tickIndex++;
        }
      } else {
         
         for (let i = this.z(this._boardWidth); i >= 0; i -= gridSize) {
  // Draw the horizontal grid line at the current y-position 'i'
  this.setStrokeStyle({width: gridWidth, color: gridColor, alpha: gridAlpha});
  this.moveTo(0, i);
  this.lineTo(this.z(this._boardLength), i);
  this.stroke();

  // Add a thicker tick mark and a label every 10 grid lines, starting from the bottom
  if (tickIndex % 10 === 0 && tickIndex > 0) {
    this.setStrokeStyle({width: 2, color: gridColor, alpha: 1, pixelLine: true});
    this.moveTo(0, i);
    this.lineTo(this.z(-100), i);
    this.stroke();

    // The value is now correctly calculated from the bottom edge
    const valueFromBottomMm = tickIndex * 100;
    const tickMeasure = convertMm(valueFromBottomMm, 'inches');

    const text = new Text({text: `${tickMeasure[1] === "Metric" ? (valueFromBottomMm / 1000).toFixed(2) : tickMeasure[0]} ${tickMeasure[1] === "Metric" ? "m" : "in"}`,style:  { fontSize: 12, fill: 0x000000 }});
    text.position.set(this.z(-300), i + 10);
    this.addChild(text);
  }
  tickIndex++;
}

      }
        } // End if (this._showGrid)
   // const isBoardHorizontal = this._boardWidth < this._boardLength; // Width = height, Length = width

   if (this._displayMaterialUsage) {
      const allBbox: { x: number; y: number; width: number; height: number }[] = [];

surfaceManager.currentSurface?._Patterns.forEach(item => {
    // Get the bounding box (BBox) for the item
    const hull = item._polyHit["points"];
    const minX = Math.min(...hull.map(p => p.x));
    const minY = Math.min(...hull.map(p => p.y));
    const maxX = Math.max(...hull.map(p => p.x));
    const maxY = Math.max(...hull.map(p => p.y));

    const bBox = {
        x: minX + item.zCtx,
        y: minY + item.zCty,
        width: maxX - minX,
        height: maxY - minY
    };

    // Check if the item's bounding box intersects with the board
    const intersects = 
        bBox.x < this._boardLength &&   // Box's left edge is left of board's right edge
        bBox.x + bBox.width > 0 &&      // Box's right edge is right of board's left edge
        bBox.y < this._boardWidth &&    // Box's top edge is above board's bottom edge
        bBox.y + bBox.height > 0;       // Box's bottom edge is below board's top edge

    // If it intersects, add its bounding box to the array
    if (intersects) {
        allBbox.push(bBox);
    }
});

      if (isBoardHorizontal) {
              // get maxX (maximum used length)
              const maxX = Math.max(...allBbox.map(_ => _.x + _.width));

              // Draw measurement lines
              this.setStrokeStyle({width: 2, color: 0x000000, alpha: 1});
              // Horizontal line for used length
              this.moveTo(0, this.z(this._boardWidth + 100));
              this.lineTo(this.z(maxX), this.z(this._boardWidth + 100));
              // Vertical line for total width
              this.moveTo(this.z(-100), 0);
              this.lineTo(this.z(-100), this.z(this._boardWidth));
              this.stroke();

              // Add the size on each axis
              const valText = maxX;
              const valTextMeasure = convertMm(valText, 'inches');
              const text = new Text({text: `${valTextMeasure[1] === "Metric" ? (valText / 1000).toFixed(2) : valTextMeasure[0]} ${valTextMeasure[1] === "Metric" ? "m" : "in"}`, style: { fontSize: 12, fill: 0x000000 }});
              text.position.set(this.z(maxX / 2), this.z(this._boardWidth + 120));
              text.anchor.set(0.5, 0);
              this.addChild(text);

              const valText2 = this._boardWidth;
              const valTextMeasure2 = convertMm(valText2, 'inches');
              const text2 = new Text(`${valTextMeasure2[1] === "Metric" ? (valText2 / 1000).toFixed(2) : valTextMeasure2[0]} ${valTextMeasure2[1] === "Metric" ? "m" : "in"}`, { fontSize: 12, fill: 0x000000 });
              text2.position.set(this.z(-120), this.z(this._boardWidth / 2));
              text2.anchor.set(0.5, 0.5);
              text2.rotation = -Math.PI / 2; // Correct rotation for readability
              this.addChild(text2);

              // Add the Area calculation
              let area = (maxX * this._boardWidth) / 1000000;
              if (valTextMeasure2[1] === "Imperial") {
                // convert area from mm2 to sqft
                let leng = maxX / 25.4;
                let wid = this._boardWidth / 25.4;
                area = (wid * leng) / 144;
              }
              const text3 = new Text(`Usage : ${area.toFixed(2)} ${valTextMeasure2[1] === "Metric" ? "m²" : "sqft"}`, { fontSize: 12, fill: 0x000000 });
              text3.position.set(5, this.z(this._boardWidth + 300));
              this.addChild(text3);
              
              // Add cost calculation if user roll data is available
              try {
                const userRollData = (window as any).userRollData;
                const userCurrency = (window as any).userCurrency;
                const selectedRollIndex = (window as any).selectedRollIndex || 0;
                if (userRollData && userRollData.length > 0) {
                  const roll = userRollData[selectedRollIndex] || userRollData[0];
                  const pricePerAreaUnit = roll.purchase_price;
                  const totalCost = area * pricePerAreaUnit;
                  
                  const currencySymbol = userCurrency === 1 ? "$" : userCurrency === 2 ? "€" : "£";
                  const text4 = new Text(`Cost: ${currencySymbol}${totalCost.toFixed(2)}`, { fontSize: 12, fill: 0x000000 });
                  text4.position.set(5, this.z(this._boardWidth + 500));
                  this.addChild(text4);
                }
              } catch (e) {
                console.log("Could not calculate cost:", e);
              }
            } else { // Case for Vertical Board (_boardWidth >= _boardLength)
              // get maxY (maximum used width)
              const maxY = Math.max(...allBbox.map(_ => _.y + _.height));

              // Draw measurement lines
              this.setStrokeStyle({width: 2, color: 0x000000, alpha: 1});
              // Vertical line for used width (maxY)
              this.moveTo(this.z(this._boardLength + 100), 0);
              this.lineTo(this.z(this._boardLength + 100), this.z(maxY));
              // Horizontal line for total length (_boardLength)
              this.moveTo(0, this.z(-100));
              this.lineTo(this.z(this._boardLength), this.z(-100));
              this.stroke();

              // Add the size on each axis
              // Horizontal label (total board length)
              const valText = this._boardLength; // FIX: Used instance property, removed typo
              const valTextMeasure = convertMm(valText, 'inches');
              const text = new Text({text: `${valTextMeasure[1] === "Metric" ? (valText / 1000).toFixed(2) : valTextMeasure[0]} ${valTextMeasure[1] === "Metric" ? "m" : "in"}`, style: { fontSize: 12, fill: 0x000000 }});
              text.anchor.set(2,2);
              text.position.set(this.z(this._boardLength / 2), this.z(-50));
              this.addChild(text);

              // Vertical label (used board width)
              const valText2 = maxY;
              const valTextMeasure2 = convertMm(valText2, 'inches');
              const text2 = new Text({text:`${valTextMeasure2[1] === "Metric" ? (valText2 / 1000).toFixed(2) : valTextMeasure2[0]} ${valTextMeasure2[1] === "Metric" ? "m" : "in"}`, style:  { fontSize: 12, fill: 0x000000 }});
              text2.position.set(this.z(this._boardLength +150), this.z(maxY /2));
              text2.anchor.set(-0.5, -0.5);
              text2.rotation = -Math.PI / 2; // Correct rotation for readability
              this.addChild(text2); // FIX: Uncommented this line to display the label

              // Add the Area calculation
              let area = (this._boardLength * maxY) / 1000000; // FIX: Used correct properties for calculation
              if (valTextMeasure2[1] === "Imperial") {
                // FIX: Used consistent and correct conversion for imperial units
                let leng = this._boardLength / 25.4;
                let wid = maxY / 25.4;
                area = (wid * leng) / 144;
              }
              const text3 = new Text({text: `Usage : ${area.toFixed(2)} ${valTextMeasure2[1] === "Metric" ? "m²" : "sqft"}`, style: { fontSize: 12, fill: 0x000000 }});
              text3.position.set(this.z(this._boardLength + 150), 5);
              this.addChild(text3);
              
              // Add cost calculation if user roll data is available
              try {
                const userRollData = (window as any).userRollData;
                const userCurrency = (window as any).userCurrency;
                const selectedRollIndex = (window as any).selectedRollIndex || 0;
                if (userRollData && userRollData.length > 0) {
                  const roll = userRollData[selectedRollIndex] || userRollData[0];
                  const pricePerAreaUnit = roll.purchase_price;
                  const totalCost = area * pricePerAreaUnit;
                  
                  const currencySymbol = userCurrency === 1 ? "$" : userCurrency === 2 ? "€" : "£";
                  const text4 = new Text({text: `Cost: ${currencySymbol}${totalCost.toFixed(2)}`, style: { fontSize: 12, fill: 0x000000 }});
                  text4.position.set(this.z(this._boardLength + 150), this.z(150));
                  this.addChild(text4);
                }
              } catch (e) {
                console.log("Could not calculate cost:", e);
              }
            }
    }
  }
}
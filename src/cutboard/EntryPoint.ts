import * as PIXI from 'pixi.js';
import { waitForElt } from "../core/Dom";
import { globalSize, globalVecs, VectorDisplay } from "../mvd/WebGL/VectorDisplay";
import { GraphicDrawer } from "../mvd/WebGL/GraphicDrawer";
import { currentPatternSelection } from "..//uof/Globals";
import { CutBoard } from "src/ui/controls/CutBoard/CutBoard";

export const mountCutboard = async ($this: CutBoard) => {
  // Gets the main canvas element
  const boardCanvas = await waitForElt<HTMLCanvasElement>("#cut-board-canvas");

  // Creates a new PIXI application
  const app = new PIXI.Application({
    background  : '#ffffff',
    antialias   : true,
    autoDensity : true,
    view        : boardCanvas
  });

  // Resize the PIXI application to the parent element
  app.resizeTo = boardCanvas.parentElement;

  const docWidth = globalSize.width;
  const docHeight = globalSize.height;

  const resizedHeight = 600;
  const resizedWidth = docWidth / docHeight * resizedHeight;

  const scaleY = resizedHeight / docHeight;
  const scaleX = resizedWidth / docWidth;

  GraphicDrawer.zoomFactor = 0.2;

  $this.boardSprite = new PIXI.Graphics();
  // Draw a reactangle of 1600px height and 5000px width
  // Rectangle is white with a black border
  $this.boardSprite.lineStyle(3, 0x000000);
  $this.boardSprite.beginFill(0xffffff);
  $this.boardSprite.drawRect(0, 0, 5000 * GraphicDrawer.zoomFactor, 1600 * GraphicDrawer.zoomFactor);
  $this.boardSprite.endFill();
  $this.mainCtn = new PIXI.Container();
  app.stage.addChild($this.mainCtn);
  $this.mainCtn.addChild($this.boardSprite);

  $this.boardSprite.pivot.x = $this.boardSprite.width / 2;
  $this.boardSprite.pivot.y = $this.boardSprite.height / 2;

  //center the reacangle in the canvas
  $this.x = (app.screen.width) / 2;
  $this.y = (app.screen.height) / 2;
  $this.boardSprite.x = $this.x * GraphicDrawer.zoomFactor;
  $this.boardSprite.y = $this.y * GraphicDrawer.zoomFactor;

  if (currentPatternSelection.shouldBeProcessed) {
    currentPatternSelection.selections.forEach((item) => {
        const vecDisplay = new VectorDisplay(item.merged);
        item.normalizeItems();
        $this.mainCtn.addChild(vecDisplay.getContainer());
        vecDisplay.getContainer().on('pointerdown', (event) => {
          event.button === 0 && (vecDisplay.isSelected = !vecDisplay.isSelected);
          if (vecDisplay.isSelected) {
          }
        });
        vecDisplay.rebuild();
        vecDisplay.render();
        vecDisplay.getContainer().interactive = true;
        // Hitarea should mttach teh shape drawn by the graphic object, not a rectangle, the curved shape


        currentPatternSelection.selectionsDisp.push(vecDisplay);
        vecDisplay._x = item.merged.x;
        vecDisplay._y = item.merged.y;
        vecDisplay.getContainer().x = vecDisplay._x * GraphicDrawer.zoomFactor;
        vecDisplay.getContainer().y = vecDisplay._y * GraphicDrawer.zoomFactor;
    });
  }

  return app;
};


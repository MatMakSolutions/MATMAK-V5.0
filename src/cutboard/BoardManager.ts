import { mvdToVectorItem, vectorItem } from "../mvd/VectorItem";
import { globalSize, VectorDisplay } from "../mvd/WebGL/VectorDisplay";
import { ppInfo, ppPrompt } from "../ui/controls/popup/Popup";
import { curProjectId, sFetch } from "../uof/Globals";
import *as PIXI from 'pixi.js';
import { waitForElt } from "../core/Dom";
import { GraphicDrawer } from "../mvd/WebGL/GraphicDrawer";
import { _evtBus, _evts, CancelEvent } from "../core/EventBus";
import * as Paper from "paper";
import { RawVector } from "../mvd/RawVector/RawVector";
import { MultiViewItem } from "../mvd/MultiViewItem";
import { CutBoard, TLocalConfig } from "src/ui/controls/CutBoard/CutBoard";
import { getUow } from "../uof/UnitOfWork";

// TODO : Reactivate & Rewrite to manage the Multi Tab
export class BoardManager {
  boards      : BoardItem[] = [];
  currentBoardIndex: number = 0;
  app: PIXI.Application | null = null;
  evtZoomIn: CancelEvent | null = null;
  evtZoomOut: CancelEvent | null = null;


  createBoard() {
    if (this.boards.length >= 5) return;

    const board     = new BoardItem();
    board.boardId      = "";
    board.boardName    = "Untitled Board " + this.boards.length + 1;
    board.items        = [];
    board.displayItems = [];
    this.boards.push(board);
    this.currentBoardIndex = this.boards.length - 1;
    board.newBoard = {
      boardIndex : 0,
      boardName  : board.boardName,
      carLegend  : new Map(),
      mvs        : [],
      zoomLevel  : 0.2,
      undoStack  : [],
      undoIdx    : 0,
      hasbeenCentered: false
    };

    return board;
  }

  setSelectedBoardName(name: string) {
    this.boards[this.currentBoardIndex].boardName = name;
  }

  get selectedBoard() {
    return this.boards[this.currentBoardIndex];
  }

  setSelectedBoard(index: number) {
    if (index < 0 || index >= this.boards.length) return;
    this.currentBoardIndex = index;
  }

  async updateSelectedBoard() {

  }


  async displaySelectedBoard() {
    this.selectedBoard.newBoard.mvs = this.selectedBoard.newBoard.mvs.filter((item) => item["_type"] === "ITEM");
    if (this.boards.length === 0) return;
    const cutBoard = getUow<CutBoard>("cutBoard");
    cutBoard.reloadBoard();
  }

  /**
  * This method is temporary disconnected till we remove PaperJS
   */
  async _displaySelectedBoard() {
    if (this.boards.length === 0) return;

    GraphicDrawer.zoomFactor = this.selectedBoard.zoomfactor;
    const parent = (await waitForElt<HTMLCanvasElement>("#cut-board-workspace"));
    parent.querySelectorAll("canvas").forEach((c) => c.remove());

    const boardCanvas = document.createElement("canvas");
    boardCanvas.style.position = "absolute";
    boardCanvas.style.top      = "0";
    boardCanvas.style.left     = "0";
    boardCanvas.style.width    = "100%";
    boardCanvas.style.height   = "100%";
    boardCanvas.id = "cut-board-canvas";
    const canvas = boardCanvas;
    parent.appendChild(boardCanvas);

    if (this.app) {
      this.app.destroy(true, {children: true, texture: true, textureSource: true});
    }

    this.app = new PIXI.Application({
      background  : '#ffffff',
      antialias   : true,
      autoDensity : true,
      view        : boardCanvas
    });

    this.app.resizeTo = boardCanvas.parentElement;

    const docWidth = globalSize.width;
    const docHeight = globalSize.height;

    const resizedHeight = 600;
    const resizedWidth = docWidth / docHeight * resizedHeight;

    const scaleY = resizedHeight / docHeight;
    const scaleX = resizedWidth / docWidth;

    this.selectedBoard.mainCtn = new PIXI.Container();
    this.app.stage.addChild(this.selectedBoard.mainCtn);

    GraphicDrawer.zoomFactor = 0.2;

    const graphics = new PIXI.Graphics();
        graphics.beginFill(0x000000);
        graphics.drawCircle(0,0,3.5);
        graphics.endFill();
        graphics.x = 0;
        graphics.y = 0;


        this.selectedBoard.items.forEach((item) => {
          const paths = item.rawVectors.map((rv) => rv.asString());
          const mvItm = new MultiViewItem({paths});
          mvItm._rawPattern = item.rawPattern;

          const vecDisplay =  new VectorDisplay(new RawVector((mvItm.mainPath)));
          this.selectedBoard.mainCtn.addChild(vecDisplay.getContainer());
          vecDisplay.rebuild();
          vecDisplay.render();
            });

            this.selectedBoard.mainCtn?.addChild(graphics);


    this.selectedBoard.boardSprite = new PIXI.Graphics();
    this.selectedBoard.boardSprite.lineStyle(3, 0x000000);
    this.selectedBoard.boardSprite.beginFill(0xffffff);
    this.selectedBoard.boardSprite.drawRect(0, 0, 5000 * GraphicDrawer.zoomFactor, 1600 * GraphicDrawer.zoomFactor);
    this.selectedBoard.boardSprite.endFill();

    this.selectedBoard.boardSprite.pivot.x = this.selectedBoard.boardSprite.width / 2;
    this.selectedBoard.boardSprite.pivot.y = this.selectedBoard.boardSprite.height / 2;

    this.selectedBoard.boardSprite.x = (this.app.screen.width) / 2 * GraphicDrawer.zoomFactor;
    this.selectedBoard.boardSprite.y = (this.app.screen.height) / 2 * GraphicDrawer.zoomFactor;
    this.selectedBoard.displayItems = this.selectedBoard.items.map((item) => {

      const vecDisplay =  new VectorDisplay(item.merged);

      vecDisplay.rebuild();
      vecDisplay.render();
      vecDisplay.getContainer().interactive = true;
      vecDisplay._x = item.merged.x;
      vecDisplay._y = item.merged.y;
      vecDisplay.getContainer().x = vecDisplay._x * GraphicDrawer.zoomFactor;
      vecDisplay.getContainer().y = vecDisplay._y * GraphicDrawer.zoomFactor;
      vecDisplay.getContainer().angle = item.merged.rotation;

      return vecDisplay;
    });

    this.selectedBoard.displayItems.forEach((vd) => {
      vd.getContainer().interactive = true;
      vd.rebuild();
      vd.render();
      vd.getContainer().onclick = (e) => {
        vd.isSelected = !vd.isSelected;
      };
      vd.getContainer().x = vd._x * GraphicDrawer.zoomFactor;
      vd.getContainer().y = vd._y * GraphicDrawer.zoomFactor;
    });


    // Rest of the initialization
    let prevX = 0;
    let prevY = 0;

    this.app.stage.interactive = true;
    this.app.stage.eventMode = "static";

    const getItemUnderMouse = () => {
      // Check if the mouse coordinates intersect with any item in the selectionsDisp array
      return this.selectedBoard.displayItems.find((item) =>  item._isHovered );
    };

    let isMouseRightDown = false;
    let isMouseLeftDown = false;

    canvas.addEventListener("mouseup", (e:MouseEvent) => {
      if (e.button === 0) {
        isMouseLeftDown = false;
      } else if (e.button === 2) {
        isMouseRightDown = false;
      }

      if (draggingItem) {
        draggingItem = null;
      }
    });

    let rightInitialPosX = 0;
    let rightInitialPosY = 0;

    let leftInitialPosX = 0;
    let leftInitialPosY = 0;

    let draggingItem: VectorDisplay | null = null;

    canvas.addEventListener("mousedown", (e:MouseEvent) => {
      const bbox = canvas.getBoundingClientRect();
      const posX = e.clientX - bbox.left;
      const posY = e.clientY - bbox.top;

      if (e.button === 0) {
        isMouseLeftDown = true;
        leftInitialPosX = posX;
        leftInitialPosY = posY;
        draggingItem = getItemUnderMouse();
        this.selectedBoard.displayItems.forEach((item) => { item !== draggingItem && (item.isSelected = false); });
      } else if (e.button === 2) {
        isMouseRightDown = true;
        rightInitialPosX = posX;
        rightInitialPosY = posY;
      }

      canvas.addEventListener("mousemove", (e:MouseEvent) => {
        const bbox = canvas.getBoundingClientRect();
        const posX = e.clientX - bbox.left;
        const posY = e.clientY - bbox.top;

        // First we implement Panning if right mouse button is down
        if (isMouseRightDown) {
          const dx = posX - rightInitialPosX;
          const dy = posY - rightInitialPosY;
          rightInitialPosX = posX;
          rightInitialPosY = posY;
          this.selectedBoard.mainCtn?.position.set(this.selectedBoard.mainCtn?.position.x + dx, this.selectedBoard.mainCtn?.position.y + dy);
          this.selectedBoard.mainCtnPos.x = this.selectedBoard.mainCtn?.position.x;
          this.selectedBoard.mainCtnPos.y = this.selectedBoard.mainCtn?.position.y;
        }

        // Then we implement dragging if left mouse button is down
        if (isMouseLeftDown) {
          const dx = posX - leftInitialPosX;
          const dy = posY - leftInitialPosY;
          leftInitialPosX = posX;
          leftInitialPosY = posY;
          const item = draggingItem;
          if (item) {
            item.getContainer().x += dx;
            item.getContainer().y += dy;
            item._x = item.getContainer().x / GraphicDrawer.zoomFactor;
            item._y = item.getContainer().y / GraphicDrawer.zoomFactor;
            item.rawVector.x = item._x;
            item.rawVector.y = item._y;
          }
        }


      });

    });


    canvas.addEventListener("wheel", (e) => {
      const isZoomIn = e.deltaY > 0;
      _evtBus.emit(isZoomIn ? _evts.cutBoard.zoomIn : _evts.cutBoard.zoomOut);
    });

    this.evtZoomIn?.off();
    this.evtZoomOut?.off();

    this.evtZoomIn = _evtBus.on(_evts.cutBoard.zoomIn, () => {
      const oldRatio = GraphicDrawer.zoomFactor;
      GraphicDrawer.zoomFactor += 0.02;
      this.selectedBoard.zoomfactor = GraphicDrawer.zoomFactor;
      this.selectedBoard.displayItems.forEach((item) => {
        item.getContainer().x = item._x * GraphicDrawer.zoomFactor;
        item.getContainer().y = item._y * GraphicDrawer.zoomFactor;
      });
      redrawBoard();

      const worldPos = {
        x: (prevX - this.selectedBoard.mainCtn.x) / oldRatio,
        y: (prevY - this.selectedBoard.mainCtn.y) / oldRatio
      };

      this.selectedBoard.mainCtn.x = prevX - worldPos.x * GraphicDrawer.zoomFactor;
      this.selectedBoard.mainCtn.y = prevY - worldPos.y * GraphicDrawer.zoomFactor;

    });

    this.evtZoomOut = _evtBus.on(_evts.cutBoard.zoomOut, () => {
      const oldRatio = GraphicDrawer.zoomFactor;

      GraphicDrawer.zoomFactor -= 0.02;
      this.selectedBoard.zoomfactor = GraphicDrawer.zoomFactor;
      this.selectedBoard.boardSprite.x /= 1.02;
      this.selectedBoard.displayItems.forEach((item) => {
        item.getContainer().x = item._x * GraphicDrawer.zoomFactor;
        item.getContainer().y = item._y * GraphicDrawer.zoomFactor;
      });
      redrawBoard();


      const worldPos = {
        x: (prevX - this.selectedBoard.mainCtn.x) / oldRatio,
        y: (prevY - this.selectedBoard.mainCtn.y) / oldRatio
      };

      this.selectedBoard.mainCtn.x = prevX - worldPos.x * GraphicDrawer.zoomFactor;
      this.selectedBoard.mainCtn.y = prevY - worldPos.y * GraphicDrawer.zoomFactor;
    });

    const redrawBoard = () => {
      // redraw the container
      this.selectedBoard.boardSprite.clear();
      this.selectedBoard.boardSprite.lineStyle(3, 0x000000);
      this.selectedBoard.boardSprite.beginFill(0xffffff);
      this.selectedBoard.boardSprite.drawRect(0, 0, 5000 * GraphicDrawer.zoomFactor, 1600 * GraphicDrawer.zoomFactor);
      this.selectedBoard.boardSprite.endFill();
      this.selectedBoard.boardSprite.pivot.set(this.selectedBoard.boardSprite.width / 2, this.selectedBoard.boardSprite.height / 2);
      this.selectedBoard.boardSprite.x = 0;// this.selectedBoard.x * GraphicDrawer.zoomFactor;
      this.selectedBoard.boardSprite.y = 0;//this.selectedBoard.y * GraphicDrawer.zoomFactor;

      // redraw the elements
      this.selectedBoard.displayItems.forEach((item) => {
        item.rebuild();
        item.render();
        item.getContainer().x = item._x * GraphicDrawer.zoomFactor;
        item.getContainer().y = item._y * GraphicDrawer.zoomFactor;
    });
    }
    redrawBoard();

    this.selectedBoard.mainCtn.position.set(this.selectedBoard.mainCtnPos.x, this.selectedBoard.mainCtnPos.y);
  }

  async saveSelectedBoard() {
    if (this.boards[this.currentBoardIndex].boardId === "") {
      const name = await ppPrompt("Name your board", `My Board ${new Date().toLocaleDateString()}-${new Date().toLocaleTimeString()}`, "OK", "Cancel");
      if (!name) return;

      this.boards[this.currentBoardIndex].boardName = name;

      const serializedBoard = {
        projectId   : this.selectedBoard.projectId,
        boardId     : this.selectedBoard.boardId,
        boardName   : this.selectedBoard.boardName,
        items       : this.selectedBoard.items.map((item) => item.serializeState()),
        annotations : this.selectedBoard.annotations || []
      };


      const payload = {
        "vector_image": btoa(JSON.stringify(serializedBoard)),
        "name": name,
      } as any;

      if (curProjectId.id !== "") {
        payload["projectId"] = curProjectId.id;
        this.boards[this.currentBoardIndex].projectId = curProjectId.id;
      }

      if (!this.boards[this.currentBoardIndex].boardId) {
        await sFetch("userboard", "post", payload, true);
        await ppInfo("Added", "The board has been created, you can reload it from the 'Saved Boards' section");
      } else {
        await sFetch("userboard", "patch", payload, true);
        await ppInfo("Updated", "The board has been updated.");
      }
    }
  }
}

export class BoardItem {
  projectId   : string          = "";
  boardId     : string          = "";
  boardName   : string          = "";
  items       : vectorItem[]    = [];
  displayItems: VectorDisplay[] = [];
  boardSprite : PIXI.Graphics | null = null;
  mainCtn     : PIXI.Container | null = null;
  mainCtnPos  : {x: number, y: number} = {x: 0, y: 0};
  zoomfactor  : number = 0.2;
  annotations : any[] = []; // Store annotations per board
  newBoard: TLocalConfig = {
    boardIndex : 0,
    boardName  : "",
    carLegend  : new Map(),
    mvs        : [],
    zoomLevel  : 0.2,
    undoStack  : [],
    undoIdx    : 0,
    hasbeenCentered: false
  };

}


export const boardManager = new BoardManager();

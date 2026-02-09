import { Circle, Graphics, Text } from "pixi.js";
import { DisplayObject } from "./DisplayObject";
import { CircleMenuItem } from "./CircleMenutItem";
import { CIRCLE_MENU_COLOR, CIRCLE_MENU_HOVER_COLOR } from "../Pattern/PatternConstants";

export class CircleMenu extends DisplayObject {
  items: {
    name: string;
    handler: () => void;
    item?: CircleMenuItem;
  }[] = [];

  color: number = CIRCLE_MENU_COLOR;
  isMenuOpened: boolean = false;

  constructor() {
    super();

    this.setInteractivity(true);
    this.update();
  }

  override update(): void {
       
    this.clear();
    // Correction : Mise à jour de la hitArea après déplacement
    this.hitArea = new Circle(0, 0, 25);

    this.circle(0, 0, 50 / 2);
    this.fill({ color: this.color, alpha: 1 });


    this.circle(-12, 0, 5 / 2);
    this.fill({ color: 0xFFFFFF, alpha: 1 });

    this.circle(0, 0, 5 / 2);
    this.fill({ color: 0xFFFFFF, alpha: 1 });

    this.circle(12, 0, 5 / 2);
    this.fill({ color: 0xFFFFFF, alpha: 1 });


    if (this.isMenuOpened) {
      this.items.forEach((item, index) => {
        if (item.item) {
          item.item?.dispose();
        }

        item.item = new CircleMenuItem(item.name, 0, 0 + (index * 25));
        item.item.setInteractivity(false);
        /*if (index === 0) {
          item.item.onEventClickOut = () => {
              .name);
            this.isMenuOpened = false;
            this.update();
          };
        }*/
        this.addChild(item.item);
        item.item.onEventClick = () => {
          item.handler();
          this.isMenuOpened = false;
          this.update();
        };
        /*item.item.onEventClickOut = () => {
          this.isMenuOpened = false;
          this.update();
        };*/
        item.item.update();
      });
      setTimeout(() => {
        this.items.forEach((item) => {
          item.item?.setInteractivity(true);
          item.item?.update();
        });
      }, 0);
    } else {
      this.items.forEach((item) => {
        if (item.item) {
          item.item?.dispose();
          item.item = undefined;
        }
      })
    }
  }

  onEventOver(): void {
    this.color = CIRCLE_MENU_HOVER_COLOR;
    this.update();
  }

  onEventOut(): void {
     
    this.color = CIRCLE_MENU_COLOR;
    this.update();
  }

  onVoidClickOut(): void {
    this.setInteractivity(false);
    this.isMenuOpened = false;
    this.visible = false;
  }

  onVoidDblClickOut(): void {
    // Same behavior as single click out - hide the menu
    this.setInteractivity(false);
    this.isMenuOpened = false;
    this.visible = false;
  }

  override dispose(): void {
    super.dispose();
    this.items.forEach((item) => {
      item.item?.dispose();
    });
    this.items = [];
    this.destroy();
  }


}

export class PolygonHit {
  private points: { x: number; y: number }[] = [];
  public x: number = 0;
  public y: number = 0;
  public zoomfactor: number = 1;

  constructor(path: string = "", x: number = 0, y: number = 0) {
    if (path) this.setPath(path);
    this.x = x;
    this.y = y;
  }

  /**
   * Sets the SVG path and converts it to polygon points
  */
 setPath(svgPath: string): void {
    this.points = this.convertPathToPolygon(svgPath);
  }

  /**
   * Converts an SVG path to a polygon by sampling points along the path
   */
  convertPathToPolygon(svgPath: string): { x: number; y: number }[] {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", svgPath);
    const length = path.getTotalLength();
    const step = Math.max(1, length / 100); // Adjust number of points
    const polygon: { x: number; y: number }[] = [];

    for (let i = 0; i <= length; i += step) {
      const point = path.getPointAtLength(i);
      polygon.push({ x: point.x, y: point.y });
    }

    return polygon;
  }

  /**
   * Checks if a point is inside the polygon using the Ray Casting algorithm
   */
  hit(point: { x: number; y: number }): boolean {
    let { x, y } = point;
   //console.log("hit", this.zoomfactor, this.x, this.y, point);
    //const offsettedPoints = this.points.map(p => ({ x: p.x * this.zoomfactor, y: p.y * this.zoomfactor }));
    //const translatedPoints = offsettedPoints.map(p => ({ x: p.x + this.x, y: p.y + this.y }));
    const X = this.x / this.zoomfactor;
    const Y = this.y / this.zoomfactor;
    const HitX = (point.x - this.x) / this.zoomfactor;
    const HitY = (point.y - this.y) / this.zoomfactor;
    x = HitX;
    y = HitY;
    //const offsettedPoints = this.points.map(p => ({ x: p.x - X, y: p.y - Y }));
    const translatedPoints = this.points.map(p => ({ x: p.x , y: p.y }));


    let inside = false;
    const n = translatedPoints.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = translatedPoints[i].x, yi = translatedPoints[i].y;
      const xj = translatedPoints[j].x, yj = translatedPoints[j].y;

      const intersect = ((yi > y) !== (yj > y)) &&
      (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }

    return inside;
  }
}

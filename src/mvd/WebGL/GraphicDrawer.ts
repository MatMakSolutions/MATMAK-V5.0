import * as PIXI from "pixi.js";
import { LineTo, RawVector, VecItem } from "../RawVector/RawVector";
//import { GRAPHICS_CURVES } from '@pixi/graphics';

/**
 * Convert a value to a zoomed value
 * @param v The value to convert
 * @returns The zoomed value
 */
export function zVal(v: number) {
  return v * GraphicDrawer.zoomFactor;
}

export const EllipticArcUtils = {
  /**
   * Approximates the arc length of an elliptical arc using numerical integration.
   *
   * @ignore
   * @param rx - The radius along the x-axis.
   * @param ry - The radius along the y-axis.
   * @param startAngle - The starting eccentric angle, in radians.
   * @param sweepAngle - The change in eccentric angle, in radians. This should be in the range (-2π, 2π).
   * @param da - The size of angle intervals used in the Riemann sum.
   * @see https://math.stackexchange.com/questions/433094/how-to-determine-the-arc-length-of-ellipse
   */
  calculateArcLength(rx: number, ry: number, startAngle: number, sweepAngle: number, da = 0.05): number
  {
      // We are integrating r(x) = √(a²sin²t + b²cos²t), which is used in the form √(a² + (b² - a²)cos²t)
      // to reduce computations.

      const sweepSign = Math.sign(sweepAngle);
      const sweepAbsolute = Math.abs(sweepAngle);
      const rx2 = rx * rx;
      const ry2 = ry * ry;
      const rdiff2 = ry2 - rx2;

      let arcLength = 0;

      // Samples are taken in the middle of each interval
      for (let a = startAngle + (da * 0.5), delta = 0; delta < sweepAbsolute; a += sweepSign * da, delta += da)
      {
          const cos = Math.cos(a);
          const cos2 = cos * cos;
          const sample = Math.sqrt(rx2 + (rdiff2 * cos2));

          arcLength += da * sample;
      }

      return arcLength;
  },
};


//const _segmentsCount: (length: number, defaultSegments?: number) => number
//    = () => 0//(GRAPHICS_CURVES as any)._segmentsCount.bind(GRAPHICS_CURVES);

const tempMatrix = new PIXI.Matrix();

function ellipticArcTo(
  startX : number,
  startY : number,
  endX   : number,
  endY   : number,
  rx     : number,
  ry     : number,
  xAxisRotation = 0,
  anticlockwise = false,
  largeArc      = false,
)
{
  if (rx === 0 || ry === 0)
  {
      return [{x: endX, y: endY}];
  }

  // See https://www.w3.org/TR/SVG2/implnote.html#ArcImplementationNotes
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  // Transform into a rotated frame with the origin at the midpoint.
  const matrix = tempMatrix
      .identity()
      .translate(-midX, -midY)
      .rotate(-xAxisRotation);
  const { x: xRotated, y: yRotated } = matrix.apply({ x: startX, y: startY });

  const a = Math.pow(xRotated / rx, 2) + Math.pow(yRotated / ry, 2);

  if (a > 1)
  {
      // Ensure radii are large enough to connect start to end point.
      rx = Math.sqrt(a) * rx;
      ry = Math.sqrt(a) * ry;
  }

  const rx2 = rx * rx;
  const ry2 = ry * ry;

  // Calculate the center of the ellipse in this rotated space.
  // See implementation notes for the equations: https://svgwg.org/svg2-draft/implnote.html#ArcImplementationNotes
  const sgn = (anticlockwise === largeArc) ? 1 : -1;
  const coef = sgn * Math.sqrt(
      // use Math.abs to prevent numerical imprecision from creating very small -ve
      // values (which should be zero instead). Otherwise, NaNs are possible
      Math.abs((rx2 * ry2) - (rx2 * yRotated * yRotated) - (ry2 * xRotated * xRotated))
      / ((rx2 * yRotated * yRotated) + (ry2 * xRotated * xRotated)),
  );
  const cxRotated = coef * (rx * yRotated / ry);
  const cyRotated = -coef * (ry * xRotated / rx);

  // Calculate the center of the ellipse back in local space.
  const { x: cx, y: cy } = matrix.applyInverse({ x: cxRotated, y: cyRotated });

  // Calculate startAngle
  const x1Norm = (xRotated - cxRotated) / rx;
  const y1Norm = (yRotated - cyRotated) / ry;
  const dist1Norm = Math.sqrt((x1Norm ** 2) + (y1Norm ** 2));
  const startAngle = (y1Norm >= 0 ? 1 : -1) * Math.acos(x1Norm / dist1Norm);

  // Calculate endAngle
  const x2Norm = (-xRotated - cxRotated) / rx;
  const y2Norm = (-yRotated - cyRotated) / ry;
  const dist2Norm = Math.sqrt((x2Norm ** 2) + (y2Norm ** 2));
  let endAngle = (y2Norm >= 0 ? 1 : -1) * Math.acos(x2Norm / dist2Norm);

  // Ensure endAngle is on the correct side of startAngle
  if (endAngle > startAngle && anticlockwise)
  {
      endAngle -= Math.PI * 2;
  }
  else if (startAngle > endAngle && !anticlockwise)
  {
      endAngle += Math.PI * 2;
  }

  // Draw the ellipse!
  return ellipticArc(
      cx, cy,
      rx, ry,
      startAngle,
      endAngle,
      xAxisRotation,
      anticlockwise,
  );
}

function ellipticArc(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  startAngle: number,
  endAngle: number,
  xAxisRotation = 0,
  anticlockwise = false)
{
  const points = [] as Array<{x: number, y: number}>;
  const sweepAngle = endAngle - startAngle;
  const n =20// GRAPHICS_CURVES.adaptive
      //? _segmentsCount(EllipticArcUtils.calculateArcLength(rx, ry, startAngle, endAngle - startAngle)) * 4
      //: 20;
  const delta = (anticlockwise ? -1 : 1) * Math.abs(sweepAngle) / (n - 1);

  tempMatrix.identity()
      .translate(-cx, -cy)
      .rotate(xAxisRotation)
      .translate(cx, cy);

  for (let i = 0; i < n; i++)
  {
      const eccentricAngle = startAngle + (i * delta);
      const xr = cx + (rx * Math.cos(eccentricAngle));
      const yr = cy + (ry * Math.sin(eccentricAngle));

      const { x, y } = xAxisRotation !== 0 ? tempMatrix.apply({ x: xr, y: yr }) : { x: xr, y: yr };

      /*if (i === 0)
      {
          this._initCurve(x, y);
          continue;
      }*/

      points.push({x, y});
      //this.lineTo(x, y);
  }

  return points;
}


export class GraphicDrawer {
  static zoomFactor = 0.2;
  static showLogs  = false;

  static moveTo(graphic: PIXI.Graphics, vector: RawVector, path:VecItem) {
    const x = path.previousPoint.x;
    const y = path.previousPoint.y;

    if (path.relative) {
      graphic.moveTo(zVal(x + path.values[0]), zVal(y + path.values[1]));
    } else {
      graphic.moveTo(zVal(path.values[0]), zVal(path.values[1]));
    }
  }

  static closePath(graphic: PIXI.Graphics, vector: RawVector, path:VecItem) {
    graphic.closePath();
  }

  static horizontalLineTo(graphic: PIXI.Graphics, vector: RawVector, path:VecItem) {
    const x = path.previousPoint.x;
    const y = path.previousPoint.y;

    if (path.relative) {
      graphic.lineTo(zVal(x + path.values[0]), zVal(y));
    } else {
      graphic.lineTo(zVal(path.values[0]), zVal(y));
    }
  }

  static ellipticalArcTo(graphics: PIXI.Graphics, vector: RawVector, path:VecItem) {
    const x1 = path.previousPoint.x; // The x coordinate of the endpoint of the elliptical arc.
    const y1 = path.previousPoint.y; // The y coordinate of the endpoint of the elliptical arc.

    const rx = path.values[0]; // The x radius of the ellipse.
    const ry = path.values[1]; // The y radius of the ellipse.

    const x2 = path.values[5]; // The x coordinate of the endpoint of the elliptical arc.
    const y2 = path.values[6]; // The y coordinate of the endpoint of the elliptical arc.

    const phi = path.values[2]; // The rotation angle of the ellipse's x-axis relative to the x-axis of the user coordinate system.

    const fa = path.values[3] === 1; // The value of the large-arc-flag parameter.
    const fs = path.values[4] === 1; // The value of the sweep-flag parameter.

    const polygon = ellipticArcTo(x1, y1, (x1+x2), (y1+y2), rx, ry, phi, !fs, fa);


    polygon.forEach((point, idx) => {
      if (idx === 0) {
        //graphics.moveTo(point.x, point.y);
      } else {
        graphics.lineTo(zVal(point.x), zVal(point.y));
      }
    });
  }

  static verticalLineTo(graphic: PIXI.Graphics, vector: RawVector, path:VecItem) {
    const x = path.previousPoint.x;
    const y = path.previousPoint.y;

    if (path.relative) {
      graphic.lineTo(zVal(x), zVal(y + path.values[0]));
    } else {
      graphic.lineTo(zVal(x), zVal(path.values[0]));
    }
  }

  static lineTo(graphic: PIXI.Graphics, vector: RawVector, path:LineTo) {
    const x = path.previousPoint.x;
    const y = path.previousPoint.y;

    if (path.relative) {
      graphic.lineTo(zVal(x + path.values[0]), zVal(y + path.values[1]));
    } else {
      graphic.lineTo(zVal(path.values[0]), zVal(path.values[1]));
    }
  }

  static cubicBezierCurveTo(graphic: PIXI.Graphics, vector: RawVector, path:VecItem) {
    const x = path.previousPoint.x;
    const y = path.previousPoint.y;


    if (path.relative) {
      graphic.bezierCurveTo(zVal(x + path.values[0]), zVal(y + path.values[1]), zVal(x + path.values[2]), zVal(y + path.values[3]), zVal(x + path.values[4]), zVal(y + path.values[5]));
    } else {
      graphic.bezierCurveTo(zVal(path.values[0]), zVal(path.values[1]), zVal(path.values[2]), zVal(path.values[3]), zVal(path.values[4]), zVal(path.values[5]));
    }


  }

  static quadraticBezierCurveTo(graphic: PIXI.Graphics, vector: RawVector, path:VecItem) {
    const x = path.previousPoint.x;
    const y = path.previousPoint.y;

    if (path.relative) {
      graphic.quadraticCurveTo(zVal(x + path.values[0]), zVal(y + path.values[1]), zVal(x + path.values[2]), zVal(y + path.values[3]));
    } else {
      graphic.quadraticCurveTo(zVal(path.values[0]), zVal(path.values[1]), zVal(path.values[2]), zVal(path.values[3]));
    }
  }

  static arcTo(graphic: PIXI.Graphics, vector: RawVector, path:VecItem) {
    const x = path.previousPoint.x;
    const y = path.previousPoint.y;

    if (path.relative) {
      this.ellipticalArcTo(graphic, vector, path);
    } else {
    }
  }
}
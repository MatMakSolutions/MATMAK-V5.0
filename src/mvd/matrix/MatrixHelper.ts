export type DecomposedMatrix = {
  rotate     : number | null;
  skewX      : number | null;
  skewY      : number | null;
  translateX : number | null;
  translateY : number | null;
  scaleX     : number | null;
  scaleY     : number | null;
};

export function decomposeMatrix(matrix: Matrix): DecomposedMatrix {
  const [a, b, c, d, e, f] = matrix;

  // Calculate scaleX and scaleY
  const scaleX = Math.sqrt(a * a + b * b); // sqrt(a^2 + b^2)
  const scaleY = Math.sqrt(c * c + d * d); // sqrt(c^2 + d^2)

  // Calculate the rotation (in radians, then convert to degrees)
  let rotateRad = Math.acos(a / scaleX);        // arccos(a / scaleX)
  let rotateDeg = (rotateRad * 180) / Math.PI;  // rad * (180 / PI)

  // Adjust for rotation in the other quadrant
  if (b < 0) rotateDeg = -rotateDeg; // rotation should be counterclockwise

  // Handle special case for 180 degree rotation
  if (scaleX === -1 || scaleY === -1) {
    rotateDeg = 180;
  }

  return {
    rotate: rotateDeg,
    scaleX: scaleX,
    scaleY: scaleY,
    skewX: null, // not computing skewX in this example
    skewY: null, // not computing skewY in this example
    translateX: e,
    translateY: f,
  };
}

/**
 * Order of transformations:
 * Scale (or reflection)
 * Skew (or shear)
 * Rotation
 * Translation
 */

export type Matrix = [number, number, number, number, number, number];

function rotateMatrix(deg: number): Matrix {
  const rad = (Math.PI / 180) * deg; // Convert to radians
  const cos = Math.cos(rad);         // Formula: cos(x) = cos(rad)
  const sin = Math.sin(rad);         // Formula: sin(x) = sin(rad)
  return [cos, sin, -sin, cos, 0, 0]; // Formula: [cos(rad), sin(rad), -sin(rad), cos(rad), 0, 0]
}

function scaleMatrix(sx: number, sy: number): Matrix {
  return [sx, 0, 0, sy, 0, 0];
}

function translateMatrix(tx: number, ty: number): Matrix {
  return [1, 0, 0, 1, tx, ty];
}

// TODO : Not Used, but needed to fix the skewX and skewY when rotating
// Impacts only the visual representation of the matrix, not the actual values
function skewXMatrix(deg: number): Matrix {
  const rad = (Math.PI / 180) * deg; // Convert to radians
  const tan = Math.tan(rad);         // Formula: tan(x) = tan(rad)
  return [1, 0, tan, 1, 0, 0];       // Formula: [1, 0, tan(rad), 1, 0, 0]
}

export function multiplyMatrices(a: Matrix, b: Matrix): Matrix {
  // cij = ∑{n, k=1} Aik * Bkj
  // i = row number of matrix A
  // j = column number of matrix B,
  // k = ranges over the number of columns in A (or rows in B)
  // as they need to be the same in order for the multiplication to be valid.
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

function matrixTo3x3(m: Matrix): number[][] {
  return [
    [m[0], m[2], m[4]],
    [m[1], m[3], m[5]],
    [0, 0, 1]
  ];
}

function matrix3x3ToMatrix(m: number[][]): Matrix {
  return [m[0][0], m[1][0], m[0][1], m[1][1], m[0][2], m[1][2]];
}

function multiplyMatrices3x3(mat1: Matrix, mat2: Matrix): Matrix {
  const m1 = matrixTo3x3(mat1); // Convert to 3x3 matrix
  const m2 = matrixTo3x3(mat2); // Convert to 3x3 matrix
  let result: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 1]]; // Initialize result matrix

  for (let i = 0; i < 3; i++) { // Iterate rows
    for (let j = 0; j < 3; j++) { // Iterate columns
      for (let k = 0; k < 3; k++) { // Iterate over the row elements of the first matrix and the column elements of the second matrix
        result[i][j] += m1[i][k] * m2[k][j]; // Multiply and add
      }
    }
  }

  return matrix3x3ToMatrix(result);
}

function roundObjectValues(obj: any, precision: number = 10): any {
  const factor = Math.pow(10, precision);
  const roundedObj: any = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'number') {
      roundedObj[key] = Math.round(value * factor) / factor;
    } else {
      roundedObj[key] = value;
    }
  }

  return roundedObj;
}

export function parseTransformMultiplied(transformStr: string): DecomposedMatrix {
  const commands = transformStr.match(/(translate|rotate|scale|matrix)\(([^)]+)\)/g); // Match all the commands

  let finalMatrix: Matrix = [1, 0, 0, 1, 0, 0]; // Initialize the final matrix

  for (const command of commands!) {
    let matrix!: Matrix;

    if (command.startsWith("translate")) {
      const [tx, ty] = command
        .slice(10, -1) // Remove the command and the parentheses
        .split(/[\s,]+/) // Split by space or comma
        .map(Number); // Convert to number
      matrix = translateMatrix(tx, ty); // Create the matrix
    } else if (command.startsWith("rotate")) {
      const angle = Number(command.slice(7, -1)); // Remove the command and the parentheses
      matrix = rotateMatrix(angle); // Create the matrix
    } else if (command.startsWith("scale")) {
      const [sx, sy] = command
        .slice(6, -1)
        .split(/[\s,]+/)
        .map(Number);
      matrix = scaleMatrix(sx, sy);
    } else if (command.startsWith("matrix")) {
      matrix = command
        .slice(7, -1)
        .split(/[\s,]+/)
        .map(Number) as Matrix;
    }

    finalMatrix = multiplyMatrices3x3(finalMatrix, matrix);
  }

  return roundObjectValues(decomposeMatrix(finalMatrix), 5); // Decompose the final matrix
}

export function parseTransform(transformStr: string): DecomposedMatrix[] {
  const commands = transformStr.match(/(translate|rotate|scale|matrix)\(([^)]+)\)/g);
  const decomposedMatrices: DecomposedMatrix[] = [];

  for (const command of commands!) {
    let matrix!: Matrix;

    if (command.startsWith("translate")) {
      const [tx, ty] = command
        .slice(10, -1)
        .split(/[\s,]+/)
        .map(Number);
      matrix = translateMatrix(tx, ty);
    } else if (command.startsWith("rotate")) {
      const angle = Number(command.slice(7, -1));
      matrix = rotateMatrix(angle);
    } else if (command.startsWith("scale")) {
      const [sx, sy = sx] = command // If only one value is provided, it's assumed that sx = sy
        .slice(6, -1)
        .split(/[\s,]+/)
        .map(Number) as [number, number];
      matrix = scaleMatrix(sx, sy);
    } else if (command.startsWith("matrix")) {
      matrix = command
        .slice(7, -1)
        .split(/[\s,]+/)
        .map(Number) as Matrix;
    }

    decomposedMatrices.push(roundObjectValues(decomposeMatrix(matrix), 5));
  }

  return decomposedMatrices;
}
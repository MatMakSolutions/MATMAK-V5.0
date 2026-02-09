async function asyncForEach<T>(array: T[], callback: (item: T, index: number, allItems: T[]) => Promise<void>): Promise<void> {
  for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
      // Removed 500ms delay - was causing 2.5 minute wait for 300 paths!
      // Keep UI responsive with minimal delay
      if (index % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0)); // Yield to UI thread every 10 paths
      }
  }
}

export async function createPolygonFromSVGPaths(vecDoc: string[], precision: number = 15): Promise<Array<[number, number][]>> {
if (precision < 0 || precision > 100) {
    throw new Error('Precision should be between 0 and 100.');
}

const allPolygons = [] as Array<[number, number][]>;
const svgPathStrings = vecDoc;
const maxidx = svgPathStrings.length;
let successCount = 0;
let failCount = 0;

// OPTIMIZATION: Process in parallel batches for faster conversion
const BATCH_SIZE = 50; // Process 50 paths at a time
const batches: string[][] = [];
for (let i = 0; i < svgPathStrings.length; i += BATCH_SIZE) {
  batches.push(svgPathStrings.slice(i, i + BATCH_SIZE));
}

for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
  const batch = batches[batchIdx];
  
  // Process all paths in this batch in parallel
  const batchResults = await Promise.allSettled(
    batch.map(async (standalonePathString, localIdx) => {
      const idx = batchIdx * BATCH_SIZE + localIdx;
      return new Promise<[number, number][]>((resolve, reject) => {
        try {
          const tempPolygons: Array<[number, number][]> = [];
          handlePoly(tempPolygons, standalonePathString, precision, maxidx, idx, true);
          resolve(tempPolygons[0]);
        } catch (ex) {
          reject(ex);
        }
      });
    })
  );
  
  // Collect results from batch
  batchResults.forEach((result, localIdx) => {
    const idx = batchIdx * BATCH_SIZE + localIdx;
    if (result.status === 'fulfilled') {
      allPolygons.push(result.value);
      successCount++;
    } else {
      failCount++;
      console.warn(`⚠️ Failed to convert SVG path ${idx + 1}/${maxidx} to polygon:`, result.reason);
    }
  });
  
  // Yield to UI thread between batches
  await new Promise(resolve => setTimeout(resolve, 0));
}

console.log(`✅ Polygon conversion: ${successCount} succeeded, ${failCount} failed`);
return allPolygons;
}

function handlePoly(allPolygons: Array<[number, number][]>, standalonePathString: string, precision: number, maxidx: number, idx: number, withInfo = false) {
let allPolygonPoints: [number, number][] = [];

// If it's not the first path, remove the last point of the previous path to prevent overlap
allPolygonPoints = [];

// Create SVG path element for the current standalone path string
const parser = new DOMParser();
const svgDoc = parser.parseFromString(`<svg xmlns="http://www.w3.org/2000/svg"><path d='${standalonePathString}' /></svg>`, 'image/svg+xml');
const pathElement = svgDoc.querySelector('path');


const pathLength = pathElement.getTotalLength();

// Calculate the number of points required for the segment based on precision and path length
const numberOfPoints = Math.max(2, Math.ceil((precision / 100) * pathLength));

// Ensure the first point is added
let point = pathElement.getPointAtLength(0);
//allPolygonPoints.push([point.x, point.y]);

// Calculate intermediate points for the segment based on the precision
for (let i = 1; i < numberOfPoints - 1; i++) {
  point = pathElement.getPointAtLength((pathLength / (numberOfPoints - 1)) * i);
  allPolygonPoints.push([point.x, point.y]);
}

// Ensure the last point is added
point = pathElement.getPointAtLength(pathLength);
allPolygonPoints.push([point.x, point.y]);
allPolygonPoints.push(allPolygonPoints[0]);

//allPolygonPoints = simplifyPolygon(allPolygonPoints, 3);
allPolygons.push(allPolygonPoints);
}
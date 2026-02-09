import { LineTo, MoveTo, Point, RawVector, VecItem ,CurveTo} from "./RawVector";




export function shiftPath(rawVector: RawVector, distance: number): RawVector {
  const newPath = new RawVector(""); // Create an empty RawVector to store the new shifted path
  let previousShiftedItem: VecItem | null = null;

  rawVector.paths.forEach((item, idx) => {
      const start = item.previousPoint;
      const end = item.targetLocation();

      // Calculate normal vector
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const normalX = -(dy / length);
      const normalY = dx / length;

      // Shift the segment
      const shiftedStart = new Point(start.x + distance * normalX, start.y + distance * normalY);
      const shiftedEnd = new Point(end.x + distance * normalX, end.y + distance * normalY);

      if (previousShiftedItem) {
          // Create a new LineTo VecItem to connect the previous shifted segment to the current shifted start
          const connectionLine = new LineTo([shiftedStart.x, shiftedStart.y], false);
          newPath.insert(connectionLine, previousShiftedItem);
      } else {
          // If it's the first item, create a MoveTo command for the start
          const moveToStart = new MoveTo([shiftedStart.x, shiftedStart.y], false);
          newPath.insert(moveToStart);
      }

      // Create a new VecItem for the shifted segment
      const shiftedItem = VecItem.MakeFrom(item, previousShiftedItem, item.getType());

      // Set the target location of the new shifted item
      shiftedItem.setTargetLocation(shiftedEnd);

      newPath.insert(shiftedItem);

      previousShiftedItem = shiftedItem;
  });

  return newPath;
}


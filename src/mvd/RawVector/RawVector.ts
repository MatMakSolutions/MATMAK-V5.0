import { PathParser } from './PathParser';

/**
 * Formats a number to a specified number of decimal places and removes trailing zeros.
 * @param v - The number to format.
 * @param d - The number of decimal places to format to.
 * @param minify - Whether to remove leading zeros before the decimal point.
 * @returns The formatted number as a string.
 */
export function formatNumber(v: number, d: number, minify = false): string {
	let result = v.toFixed(d)
		.replace(/^(-?[0-9]*\.([0-9]*[1-9])?)0*$/, '$1')
		.replace(/\.$/, '');
	if (minify) {
		result = result.replace(/^(-?)0\./, '$1.');
	}
	return result;
}

/**
 * Represents a point in 2D space with x and y coordinates.
 */
export class Point {
	/**
	 * Creates a new instance of the Point class.
	 * @param x The x-coordinate of the point.
	 * @param y The y-coordinate of the point.
	 */
	constructor(
		public x: number,
		public y: number
	) { }
}

/**
 * Represents a point in an Vector image.
 */
export class VectorPoint extends Point {
	/**
	 * The reference to the RawVector Item that this point belongs to.
	 */
	itemReference: VecItem = new DummyVectorItem();

	/**
	 * Whether or not this point is movable.
	 */
	movable = true;

	/**
	 * Creates a new VectorPoint instance.
	 * @param x The x-coordinate of the point.
	 * @param y The y-coordinate of the point.
	 * @param movable Whether or not the point is movable. Defaults to true.
	 */
	constructor(
		x: number,
		y: number,
		movable = true
	) {
		super(x, y);
		this.movable = movable;
	}
}

/**
 * Represents a control point in an Vector.
 */
export class VectorControlPoint extends VectorPoint {
	/**
	 * The index of the control point.
	 */
	subIndex = 0;

	/**
	 * Creates a new instance of VectorControlPoint.
	 * @param point The point of the control point.
	 * @param relations The related points of the control point.
	 * @param movable Whether the control point is movable or not.
	 */
	constructor(
		point: Point,
		public relations: Point[],
		movable = true
	) {
		super(point.x, point.y, movable);
	}
}

/**
 * Represents an abstract RawVector Item.
 */
export abstract class VecItem {

	/**
 * Creates an instance of vectorItem.
 * @param {number[]} values - The values of the RawVector Item.
 * @param {boolean} relative - Whether the RawVector Item is relative or not.
 */
	constructor(values: number[], relative: boolean) {
		this.values = values;
		this.relative = relative;
	}

	/** Whether the RawVector Item is relative or not. */
	relative: boolean;

	/** The values of the RawVector Item. */
	values: number[];

	/** The previous point of the RawVector Item. */
	previousPoint: Point = new Point(0, 0);

	/** The absolute points of the RawVector Item. */
	absolutePoints: VectorPoint[] = [];

	/** The absolute control points of the RawVector Item. */
	absoluteControlPoints: VectorControlPoint[] = [];

	get absolutePointsOnly(): Point[] {
		return this.absolutePoints.filter(it => this.absoluteControlPoints.every(cp => cp.x !== it.x && cp.y !== it.y));
	}

	/**
 * Creates an instance of vectorItem from a raw item.
 * @param {string[]} rawItem - The raw item to create an instance from.
 * @returns {VecItem} The created instance of vectorItem.
 * @throws {string} Invalid RawVector Item.
 */
	public static Make(rawItem: string[]): VecItem {
		let result: VecItem | undefined = undefined;

		const relative = rawItem[0].toUpperCase() !== rawItem[0];
		const values = rawItem.slice(1).map(it => parseFloat(it));

		switch (rawItem[0].toUpperCase()) {
			case MoveTo.key: result                       = new MoveTo(values, relative); break;
			case LineTo.key: result                       = new LineTo(values, relative); break;
			case HorizontalLineTo.key: result             = new HorizontalLineTo(values, relative); break;
			case VerticalLineTo.key: result               = new VerticalLineTo(values, relative); break;
			case ClosePath.key: result                    = new ClosePath(values, relative); break;
			case CurveTo.key: result                      = new CurveTo(values, relative); break;
			case SmoothCurveTo.key: result                = new SmoothCurveTo(values, relative); break;
			case QuadraticBezierCurveTo.key: result       = new QuadraticBezierCurveTo(values, relative); break;
			case SmoothQuadraticBezierCurveTo.key: result = new SmoothQuadraticBezierCurveTo(values, relative); break;
			case EllipticalArcTo.key: result              = new EllipticalArcTo(values, relative); break;
		}
		if (!result) {
			throw 'Invalid RawVector Item';
		}
		return result;
	}


	/**
	* Creates an instance of vectorItem from an origin, previous, and new type.
	* @param {VecItem} origin - The origin of the RawVector Item.
	* @param {VecItem} previous - The previous RawVector Item.
	* @param {string} newType - The new type of the RawVector Item.
	* @returns {VecItem} The created instance of vectorItem.
	*/
	public static MakeFrom(origin: VecItem, previous: VecItem, newType: string) {
		const target           = origin.targetLocation();
		const x                = target.x.toString();
		const y                = target.y.toString();
		let   values: string[] = [];
		const absoluteType     = newType.toUpperCase();

		switch (absoluteType) {
			case MoveTo.key: values                       = [MoveTo.key, x, y]; break;
			case LineTo.key: values                       = [LineTo.key, x, y]; break;
			case HorizontalLineTo.key: values             = [HorizontalLineTo.key, x]; break;
			case VerticalLineTo.key: values               = [VerticalLineTo.key, y]; break;
			case ClosePath.key: values                    = [ClosePath.key]; break;
			case CurveTo.key: values                      = [CurveTo.key, '0', '0', '0', '0', x, y]; break;
			case SmoothCurveTo.key: values                = [SmoothCurveTo.key, '0', '0', x, y]; break;
			case QuadraticBezierCurveTo.key: values       = [QuadraticBezierCurveTo.key, '0', '0', x, y]; break;
			case SmoothQuadraticBezierCurveTo.key: values = [SmoothQuadraticBezierCurveTo.key, x, y]; break;
			case EllipticalArcTo.key: values              = [EllipticalArcTo.key, '1', '1', '0', '0', '0', x, y]; break;
		}

		const result        = VecItem.Make(values);
		const controlPoints = origin.absoluteControlPoints;

		result.previousPoint  = previous.targetLocation();
		result.absolutePoints = [target];

		result.resetControlPoints(previous);

		if ((origin instanceof CurveTo || origin instanceof SmoothCurveTo)
			&& (result instanceof CurveTo || result instanceof SmoothCurveTo)) {
			if (result instanceof CurveTo) {
				result.values[0] = controlPoints[0].x;
				result.values[1] = controlPoints[0].y;
				result.values[2] = controlPoints[1].x;
				result.values[3] = controlPoints[1].y;
			}
			if (result instanceof SmoothCurveTo) {
				result.values[0] = controlPoints[1].x;
				result.values[1] = controlPoints[1].y;
			}
		}

		if ((origin instanceof QuadraticBezierCurveTo || origin instanceof SmoothQuadraticBezierCurveTo)
			&& (result instanceof QuadraticBezierCurveTo)) {
			result.values[0] = controlPoints[0].x;
			result.values[1] = controlPoints[0].y;
		}

		if (newType !== absoluteType) {
			result.setRelative(true);
		}
		return result;
	}
	/**
	 * Refreshes the absolute points of the RawVector Item.
	 * @param {Point} origin - The origin of the RawVector Item.
	 * @param {VecItem | null} previous - The previous RawVector Item.
	 */
	public refreshAbsolutePoints(origin: Point, previous: VecItem | null) {
		this.previousPoint = previous ? previous.targetLocation() : new Point(0, 0);
		this.absolutePoints = [];
		let current = previous ? previous.targetLocation() : new Point(0, 0);
		if (!this.relative) {
			current = new Point(0, 0);
		}
		for (let i = 0; i < this.values.length - 1; i += 2) {
			this.absolutePoints.push(
				new VectorPoint(current.x + this.values[i], current.y + this.values[i + 1])
			);
		}
	}
	/**
	 * Sets whether the RawVector Item is relative or not.
	 * @param {boolean} newRelative - The new value for whether the RawVector Item is relative or not.
	 */
	public setRelative(newRelative: boolean) {
		if (this.relative !== newRelative) {
			this.relative = false;
			if (newRelative) {
				this.translate(-this.previousPoint.x, -this.previousPoint.y);
				this.relative = true;
			} else {
				this.translate(this.previousPoint.x, this.previousPoint.y);
			}
		}
	}
	/**
	 * Refreshes the absolute control points of the RawVector Item.
	 * @param {Point} origin - The origin of the RawVector Item.
	 * @param {VecItem | null} previous - The previous RawVector Item.
	 */
	public refreshAbsoluteControlPoints(origin: Point, previous: VecItem | null) {
		this.absoluteControlPoints = [];
	}
	/**
	 * Resets the control points of the RawVector Item.
	 * @param {VecItem} previousTarget - The previous target of the RawVector Item.
	 */
	public resetControlPoints(previousTarget: VecItem) {
		// Does nothing by default
	}
	/**
	 * Translates the RawVector Item.
	 * @param {number} x - The x-coordinate to translate the RawVector Item by.
	 * @param {number} y - The y-coordinate to translate the RawVector Item by.
	 * @param {boolean} [force=false] - Whether to force the translation or not.
	 */
	public translate(x: number, y: number, force = false) {
		if (!this.relative || force) {
			this.values.forEach((val, idx) => {
				this.values[idx] = val + (idx % 2 === 0 ? x : y);
			});
		}
	}

	/**
	 * Scales the RawVector Item.
	 * @param {number} kx - The x-coordinate to scale the RawVector Item by.
	 * @param {number} ky - The y-coordinate to scale the RawVector Item by.
	 * @param {boolean} [force=false] - Whether to force the scaling or not.
	 * @throws {string} Invalid RawVector Item.
	 * */
	public scale(kx: number, ky: number) {
		this.values.forEach((val, idx) => {
			this.values[idx] = val * (idx % 2 === 0 ? kx : ky);
		});
	}

	/**
	 * Rotates the RawVector Item.
	 * @param {number} ox - The x-coordinate of the origin of the rotation.
	 * @param {number} oy - The y-coordinate of the origin of the rotation.
	 * @param {number} degrees - The degrees to rotate the RawVector Item by.
	 * @param {boolean} [force=false] - Whether to force the rotation or not.
	 * @throws {string} Invalid RawVector Item.
	 * */
	public rotate(ox: number, oy: number, degrees: number, force = false) {
		const rad = degrees * Math.PI / 180; // radians
		const cos = Math.cos(rad); // cos(θ)
		const sin = Math.sin(rad); // sin(θ)

		for (let i = 0; i < this.values.length; i += 2) {
			const px = this.values[i]; // x
			const py = this.values[i + 1];
			const x  = this.relative && !force ? 0 : ox; // x
			const y  = this.relative && !force ? 0 : oy; // y
			const qx = x + (px - x) * cos - (py - y) * sin; // x
			const qy = y + (px - x) * sin + (py - y) * cos; // y

			this.values[i]     = qx; // x
			this.values[i + 1] = qy; // y
		}
	}

	/**
	 * Refreshes the absolute positions of the RawVector Item.
	 * @param {Point} origin - The origin of the RawVector Item.
	 * @param {VecItem | null} previous - The previous RawVector Item.
	 * @throws {string} Invalid RawVector Item.
	 * */
	public targetLocation(): VectorPoint {
		const l = this.absolutePoints.length;
		return this.absolutePoints[l - 1];
	}

	/**
	 * Sets the target location of the RawVector Item.
	 * @param {Point} pts - The new target location of the RawVector Item.
	 * @throws {string} Invalid RawVector Item.
	 * */
	public setTargetLocation(pts: Point) {
		const loc = this.targetLocation();
		const dx  = pts.x - loc.x;
		const dy  = pts.y - loc.y;
		const l   = this.values.length;

		this.values[l - 2] += dx;
		this.values[l - 1] += dy;
	}

	/**
	 * Sets the control location of the RawVector Item.
	 * @param {number} idx - The index of the control point.
	 * @param {Point} pts - The new control location of the RawVector Item.
	 * @throws {string} Invalid RawVector Item.
	 * */
	public setControlLocation(idx: number, pts: Point) {
		const loc = this.absolutePoints[idx];
		const dx  = pts.x - loc.x;
		const dy  = pts.y - loc.y;

		this.values[2 * idx]     += dx;
		this.values[2 * idx + 1] += dy;
	}

	/**
	 * Gets the control locations of the RawVector Item.
	 * @returns {VectorControlPoint[]} The control locations of the RawVector Item.
	 * @throws {string} Invalid RawVector Item.
	 * */
	public controlLocations(): VectorControlPoint[] {
		return this.absoluteControlPoints;
	}

	/**
	 * Gets the type of the RawVector Item.
	 * @returns {string} The type of the RawVector Item.
	 * @throws {string} Invalid RawVector Item.
	 * */
	public getType(): string {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let typeKey = (this.constructor as any).key as string;
		if (this.relative) {
			typeKey = typeKey.toLowerCase();
		}
		return typeKey;
	}

	/**
	 * Gets the RawVector Item as a standalone string.
	 * @returns {string} The RawVector Item as a standalone string.
	 * @throws {string} Invalid RawVector Item.
	 * */
	public asStandaloneString(): string {
		return ['M',
			this.previousPoint.x,
			this.previousPoint.y,
			this.getType(),
			...this.values
		].join(' ');
	}

	/**
	 * Gets the RawVector Item as a string.
	 * @param {number} [decimals=4] - The number of decimal places to format to.
	 * @param {boolean} [minify=false] - Whether to remove leading zeros before the decimal point.
	 * @param {VecItem[]} [trailingItems=[]] - The trailing items of the RawVector Item.
	 * @returns {string} The RawVector Item as a string.
	 * @throws {string} Invalid RawVector Item.
	 * */
	public asString(decimals = 4, minify = false, trailingItems: VecItem[] = []): string {
		const strValues = [this.values, ...trailingItems.map(it => it.values)]
			.reduce((acc, val) => acc.concat(val), [])
			.map(it => formatNumber(it, decimals, minify));
		return [this.getType(), ...strValues].join(' ');
	}
}

/**
 * Represents an RawVector Item that does nothing.
 * @extends VecItem
 */
class DummyVectorItem extends VecItem {
	constructor() {
		super([], false);
	}
}
/**
 * Represents an RawVector Item that moves to a point.
 * @extends VecItem
 */
export class MoveTo extends VecItem {
	static readonly key = 'M';
}

/**
 * Represents an RawVector Item that draws a line to a point.
 * @extends VecItem
 */
export class LineTo extends VecItem {
  isRed: boolean = false;
	static readonly key = 'L';
}

/**
 * Represents an RawVector Item that draws a curve to a point.
 * @extends VecItem
 * */
export class CurveTo extends VecItem {
	static readonly key = 'C';

	/**
	 * Refreshes the absolute control points of the RawVector Item.
	 * @param {Point} origin - The origin of the RawVector Item.
	 * @param {VecItem | null} previousTarget - The previous target of the RawVector Item.
	 * @throws {string} Invalid RawVector Item.
	 * */
	public override refreshAbsoluteControlPoints(origin: Point, previousTarget: VecItem | null) {
		if (!previousTarget) {
			throw 'Invalid path';
		}
		this.absoluteControlPoints = [
			new VectorControlPoint(this.absolutePoints[0], [previousTarget.targetLocation()]),
			new VectorControlPoint(this.absolutePoints[1], [this.targetLocation()])
		];
	}
	/**
	 * Gets the RawVector Item as a standalone string.
	 * @returns {string} The RawVector Item as a standalone string.
	 * @throws {string} Invalid RawVector Item.
	 */
	public override resetControlPoints(previousTarget: VecItem) {
		const a = previousTarget.targetLocation();
		const b = this.targetLocation();
		const d = this.relative ? a : new Point(0, 0);
		this.values[0] = 2 * a.x / 3 + b.x / 3 - d.x; // x1
		this.values[1] = 2 * a.y / 3 + b.y / 3 - d.y; // y1
		this.values[2] = a.x / 3 + 2 * b.x / 3 - d.x; // x2
		this.values[3] = a.y / 3 + 2 * b.y / 3 - d.y;	// y2
	}
}

/**
 * Represents an RawVector Item that draws a smooth curve to a point.
 * @extends VecItem
 */
export class SmoothCurveTo extends VecItem {
	static readonly key = 'S';

	/**
	 * Refreshes the absolute control points of the RawVector Item.
	 * @param {Point} origin - The origin of the RawVector Item.
	 * @param {VecItem | null} previousTarget - The previous target of the RawVector Item.
	 * @throws {string} Invalid RawVector Item.
	 * */
	public override refreshAbsoluteControlPoints(origin: Point, previousTarget: VecItem | null) {
		this.absoluteControlPoints = [];
		if ((previousTarget instanceof CurveTo || previousTarget instanceof SmoothCurveTo)) {
			const prevLoc     = previousTarget.targetLocation();
			const prevControl = previousTarget.absoluteControlPoints[1];
			const pts         = new Point(2 * prevLoc.x - prevControl.x, 2 * prevLoc.y - prevControl.y);

			this.absoluteControlPoints.push(
				new VectorControlPoint(pts, [prevLoc], false)
			);
		} else {
			const current = previousTarget ? previousTarget.targetLocation() : new Point(0, 0);
			const pts     = new Point(current.x, current.y);

			this.absoluteControlPoints.push(
				new VectorControlPoint(pts, [], false)
			);
		}
		this.absoluteControlPoints.push(
			new VectorControlPoint(this.absolutePoints[0], [this.targetLocation()]),
		);
	}
	/**
	 * Gets the RawVector Item as a standalone string.
	 * @returns {string} The RawVector Item as a standalone string.
	 */
	public override asStandaloneString(): string {
		return [
			'M',
			this.previousPoint.x,
			this.previousPoint.y,
			'C',
			this.absoluteControlPoints[0].x,
			this.absoluteControlPoints[0].y,
			this.absoluteControlPoints[1].x,
			this.absoluteControlPoints[1].y,
			this.absolutePoints[1].x,
			this.absolutePoints[1].y
		].join(' ');
	}
	/**
	 * Resets the control points of the RawVector Item.
	 * @param {VecItem} previousTarget - The previous target of the RawVector Item.
	 * @throws {string} Invalid RawVector Item.
	 */
	public override resetControlPoints(previousTarget: VecItem) {
		const a = previousTarget.targetLocation();
		const b = this.targetLocation();
		const d = this.relative ? a : new Point(0, 0);

		this.values[0] = a.x / 3 + 2 * b.x / 3 - d.x; // x1
		this.values[1] = a.y / 3 + 2 * b.y / 3 - d.y; // y1
	}

	/**
	 * Sets the control location of the RawVector Item.
	 * @param {number} idx - The index of the control point.
	 * @param {Point} pts - The new control location of the RawVector Item.
	 * @throws {string} Invalid RawVector Item.
	 * */
	public override setControlLocation(idx: number, pts: Point) {
		const loc = this.absoluteControlPoints[1];
		const dx  = pts.x - loc.x;
		const dy  = pts.y - loc.y;

		this.values[0] += dx;
		this.values[1] += dy;
	}
}

/**
 * Represents an RawVector Item that draws a quadratic bezier curve to a point.
 * @extends VecItem
 */
export class QuadraticBezierCurveTo extends VecItem {
	static readonly key = 'Q';

	/**
	 * Refreshes the absolute control points of the RawVector Item.
	 * @param {Point} origin - The origin of the RawVector Item.
	 * @param {VecItem | null} previousTarget - The previous target of the RawVector Item.
	 * @throws {string} Invalid RawVector Item.
	 * */
	public override refreshAbsoluteControlPoints(origin: Point, previousTarget: VecItem | null) {
		if (!previousTarget) {
			throw 'Invalid path';
		}
		this.absoluteControlPoints = [
			new VectorControlPoint(this.absolutePoints[0], [previousTarget.targetLocation(), this.targetLocation()])
		];
	}

	/**
	 * Resets the control points of the RawVector Item.
	 * @param {VecItem} previousTarget - The previous target of the RawVector Item.
	 * @throws {string} Invalid RawVector Item.
	 */
	public override resetControlPoints(previousTarget: VecItem) {
		const a = previousTarget.targetLocation();
		const b = this.targetLocation();
		const d = this.relative ? a : new Point(0, 0);

		this.values[0] = a.x / 2 + b.x / 2 - d.x; // x1
		this.values[1] = a.y / 2 + b.y / 2 - d.y; // y1
	}
}

/**
 * Represents an RawVector Item that draws a smooth quadratic bezier curve to a point.
 * @extends VecItem
 */
export class SmoothQuadraticBezierCurveTo extends VecItem {
	static readonly key = 'T';

	/**
	 * Refreshes the absolute control points of the RawVector Item.
	 * @param {Point} origin - The origin of the RawVector Item.
	 * @param {VecItem | null} previousTarget - The previous target of the RawVector Item.
	 * @throws {string} Invalid RawVector Item.
	 * */
	public override refreshAbsoluteControlPoints(origin: Point, previousTarget: VecItem | null) {
		if (!(previousTarget instanceof QuadraticBezierCurveTo || previousTarget instanceof SmoothQuadraticBezierCurveTo)) {
			const previous = previousTarget ? previousTarget.targetLocation() : new Point(0, 0);
			const pts      = new Point(previous.x, previous.y);

			this.absoluteControlPoints = [
				new VectorControlPoint(pts, [], false)
			];
		} else {
			const prevLoc     = previousTarget.targetLocation();
			const prevControl = previousTarget.absoluteControlPoints[0];
			const pts         = new Point(2 * prevLoc.x - prevControl.x, 2 * prevLoc.y - prevControl.y);

			this.absoluteControlPoints = [
				new VectorControlPoint(pts, [prevLoc, this.targetLocation()], false)
			];
		}
	}
	/**
	 * Gets the RawVector Item as a standalone string.
	 * @returns {string} The RawVector Item as a standalone string.
	 * @throws {string} Invalid RawVector Item.
	 */
	public override asStandaloneString(): string {
		return [
			'M',
			this.previousPoint.x,
			this.previousPoint.y,
			'Q',
			this.absoluteControlPoints[0].x,
			this.absoluteControlPoints[0].y,
			this.absolutePoints[0].x,
			this.absolutePoints[0].y
		].join(' ');
	}
}

/**
 * Represents an RawVector Item that closes a path.
 * @extends VecItem
 */
export class ClosePath extends VecItem {
	static readonly key = 'Z';

	/**
	 * Refreshes the absolute points of the RawVector Item.
	 * @param {Point} origin - The origin of the RawVector Item.
	 * @param {VecItem | null} previous - The previous RawVector Item.
	 * @throws {string} Invalid RawVector Item.
	 * */
	public override refreshAbsolutePoints(origin: Point, previous: VecItem | null) {
		this.previousPoint  = previous ? previous.targetLocation() : new Point(0, 0);
		this.absolutePoints = [new VectorPoint(origin.x, origin.y, false)];
	}

}

/**
 * Represents an RawVector Item that draws a horizontal line to a point.
 * @extends VecItem
 * */
export class HorizontalLineTo extends VecItem {
	static readonly key = 'H';


	/**
	 * Refreshes the absolute points of the RawVector Item.
	 * @param ox The x-coordinate of the origin of the rotation.
	 * @param oy The y-coordinate of the origin of the rotation.
	 * @param angle The degrees to rotate the RawVector Item by.
	 * @param force Whether to force the rotation or not.
	 */
	public override rotate(ox: number, oy: number, angle: number, force = false) {
		if (angle == 180) {
			this.values[0] = -this.values[0];
		}
	}

	/**
	 * Refreshes the absolute points of the RawVector Item.
	 * @param {Point} origin - The origin of the RawVector Item.
	 * @param {VecItem | null} previous - The previous RawVector Item.
	 * @throws {string} Invalid RawVector Item.
	 * */
	public override refreshAbsolutePoints(origin: Point, previous: VecItem | null) {
		this.previousPoint = previous ? previous.targetLocation() : new Point(0, 0);
		if (this.relative) {
			this.absolutePoints = [new VectorPoint(this.values[0] + this.previousPoint.x, this.previousPoint.y)];
		} else {
			this.absolutePoints = [new VectorPoint(this.values[0], this.previousPoint.y)];
		}
	}

	/**
	 * Translates the RawVector Item.
	 * @param pts The new target location of the RawVector Item.
	 */
	public override setTargetLocation(pts: Point) {
		const loc = this.targetLocation();
		const dx  = pts.x - loc.x;

		this.values[0] += dx;
	}
}

/**
 * Represents an RawVector Item that draws a vertical line to a point.
 * @extends VecItem
 * */
export class VerticalLineTo extends VecItem {
	static readonly key = 'V';

	/**
	 * Refreshes the absolute points of the RawVector Item.
	 * @param ox The x-coordinate of the origin of the rotation.
	 * @param oy The y-coordinate of the origin of the rotation.
	 * @param angle The degrees to rotate the RawVector Item by.
	 * @param force Whether to force the rotation or not.
	 * */
	public override rotate(ox: number, oy: number, angle: number, force = false) {
		if (angle == 180) {
			this.values[0] = -this.values[0];
		}
	}

	/**
	 * Refreshes the absolute points of the RawVector Item.
	 * @param {number} x - The x-coordinate to translate the RawVector Item by.
	 * @param {number} y - The y-coordinate to translate the RawVector Item by.
	 * @param {boolean} [force=false] - Whether to force the translation or not.
	 * */
	public override translate(x: number, y: number, force = false) {
		if (!this.relative) {
			this.values[0] += y;
		}
	}
	public override scale(kx: number, ky: number) {
		this.values[0] *= ky;
	}
	public override refreshAbsolutePoints(origin: Point, previous: VecItem | null) {
		this.previousPoint = previous ? previous.targetLocation() : new Point(0, 0);
		if (this.relative) {
			this.absolutePoints = [new VectorPoint(this.previousPoint.x, this.values[0] + this.previousPoint.y)];
		} else {
			this.absolutePoints = [new VectorPoint(this.previousPoint.x, this.values[0])];
		}
	}
	public override setTargetLocation(pts: Point) {
		const loc = this.targetLocation();
		const dy = pts.y - loc.y;
		this.values[0] += dy;
	}
}
export class EllipticalArcTo extends VecItem {
	static readonly key = 'A';
	public override translate(x: number, y: number, force = false) {
		if (!this.relative) {
			this.values[5] += x;
			this.values[6] += y;
		}
	}
	public override rotate(ox: number, oy: number, degrees: number, force = false) {
		this.values[2] = (this.values[2] + degrees) % 360; // α
		const rad = degrees * Math.PI / 180; // α (radians)
		const cos = Math.cos(rad); // cosα
		const sin = Math.sin(rad); // sinα

		const px = this.values[5];
		const py = this.values[6];
		const x  = this.relative && !force ? 0 : ox; 		// x0
		const y  = this.relative && !force ? 0 : oy; 		// y0
		const qx = (px - x) * cos - (py - y) * sin + x; // x' = (x-x0)cosα - (y-y0)sinα + x0
		const qy = (px - x) * sin + (py - y) * cos + y; // y' = (x-x0)sinα + (y-y0)cosα + y0

		this.values[5] = qx;
		this.values[6] = qy;
	}
	public override scale(kx: number, ky: number) {
		const a     = this.values[0];																							// a
		const b     = this.values[1];																							// b
		const angle = Math.PI * this.values[2] / 180.0;														// α (radians)
		const cos   = Math.cos(angle);																						// cosα
		const sin   = Math.sin(angle);																						// sinα
		const A     = b * b * ky * ky * cos * cos + a * a * ky * ky * sin * sin;  // A = a²sin² + b²cos²
		const B     = 2 * kx * ky * cos * sin * (b * b - a * a);								  // B = 2(cosαsinα)(b²-a²)
		const C     = a * a * kx * kx * cos * cos + b * b * kx * kx * sin * sin;  // C = a²cos² + b²sin²
		const F     = -(a * a * b * b * kx * kx * ky * ky);											  // F = -a²b²
		const det   = B * B - 4 * A * C;																				  //  Δ = B² - 4AC
		const val1  = Math.sqrt((A - C) * (A - C) + B * B); 										  //  √(A-C)² + B²

		// New rotation:
		this.values[2] = B !== 0
			? Math.atan((C - A - val1) / B) * 180 / Math.PI 												// 2 * atan((C-A-√Δ)/B)
			: (A < C ? 0 : 90); 																										// B = 0, so 2 * atan(∞) = 90°

		// New radius-x, radius-y
		if (det !== 0) {
			this.values[0] = -Math.sqrt(2 * det * F * ((A + C) + val1)) / det; 			// -√(2ΔF/(A+C+√Δ))
			this.values[1] = -Math.sqrt(2 * det * F * ((A + C) - val1)) / det; 			// -√(2ΔF/(A+C-√Δ))
		}

		// New target
		this.values[5] *= kx; // x
		this.values[6] *= ky; // y

		// New sweep flag
		this.values[4] = kx * ky >= 0 ? this.values[4] : 1 - this.values[4]; // s
	}
	public override refreshAbsolutePoints(origin: Point, previous: VecItem | null) {
		this.previousPoint = previous ? previous.targetLocation() : new Point(0, 0);
		if (this.relative) {
			this.absolutePoints = [new VectorPoint(this.values[5] + this.previousPoint.x, this.values[6] + this.previousPoint.y)];
		} else {
			this.absolutePoints = [new VectorPoint(this.values[5], this.values[6])];
		}
	}

	public override asString(decimals = 4, minify = false, trailingItems: VecItem[] = []): string {
		if (!minify) {
			return super.asString(decimals, minify, trailingItems);
		} else {
			const strValues = [this.values, ...trailingItems.map(it => it.values)]
				.map(it => it.map(it2 => formatNumber(it2, decimals, minify)))
				.map(v => `${v[0]} ${v[1]} ${v[2]} ${v[3]}${v[4]}${v[5]} ${v[6]}`);
			return [this.getType(), ...strValues].join(' ');
		}
	}
}


export class RawVector {
	paths: VecItem[] = [];

	// Ajout des champs x et y
  get rawX() {
    return this.paths[0].values[0];
  }

  get rawY() {
    return this.paths[0].values[1];
  }

  x: number = 0;
  y: number = 0;
  rotation: number = 0;

	constructor(path: string) {
		this.rebuild(path);
	}

  clone() {
    return new RawVector(this.asString());
  }

	// Modifications de la classe RawVector


	// Ajout de la méthode normalize
	normalize(): void { /* Code in older commit */	}


	rebuild(path: string) {
		const rawPath = PathParser.parse(path);
		this.paths = rawPath.map(it => VecItem.Make(it));
		this.refreshAbsolutePositions();
	}

	onDispose?: () => void;
	onUpdate?: () => void;

	// Calcul du centre du chemin
	getCenter(): Point {
		const x = this.paths.map(it => it.absolutePointsOnly.map(it2 => it2.x)).reduce((acc, val) => acc.concat(val), []); // On récupère les valeurs x de tous les VecItem
		const y = this.paths.map(it => it.absolutePointsOnly.map(it2 => it2.y)).reduce((acc, val) => acc.concat(val), []); // On récupère les valeurs y de tous les VecItem
		const minX = Math.min(...x); // On récupère la valeur minimale de x
		const maxX = Math.max(...x); // On récupère la valeur maximale de x
		const minY = Math.min(...y); // On récupère la valeur minimale de y
		const maxY = Math.max(...y); // On récupère la valeur maximale de y
		return new Point((minX + maxX) / 2, (minY + maxY) / 2); // On retourne le centre du chemin
	}

	getBounds() {
		const x = this.paths.map(it => it.absolutePointsOnly.map(it2 => it2.x)).reduce((acc, val) => acc.concat(val), []); // On récupère les valeurs x de tous les VecItem
		const y = this.paths.map(it => it.absolutePointsOnly.map(it2 => it2.y)).reduce((acc, val) => acc.concat(val), []); // On récupère les valeurs y de tous les VecItem
		const minX = Math.min(...x); // On récupère la valeur minimale de x
		const maxX = Math.max(...x); // On récupère la valeur maximale de x
		const minY = Math.min(...y); // On récupère la valeur minimale de y
		const maxY = Math.max(...y); // On récupère la valeur maximale de y

		return {
			x      : minX,
			y      : minY,
			width  : maxX - minX,
			height : maxY - minY
		};
	}


	translate(dx: number, dy: number): RawVector {
		this.paths.forEach((it, idx) => {
			it.translate(dx, dy, idx === 0);
		});
		this.refreshAbsolutePositions();
		return this;
	}

	scale(kx: number, ky: number): RawVector {
		this.paths.forEach((it) => {
			it.scale(kx, ky);
		});
		this.refreshAbsolutePositions();
		return this;
	}

	centeredRotate(degrees: number): RawVector {
		const center = this.getCenter();
		this.rotate(center.x, center.y, degrees);
		return this;
	}

	rotate(ox: number, oy: number, degrees: number): RawVector {
		degrees %= 360;
		if (degrees == 0) {
			return this;
		}

		this.paths.forEach((it, idx) => {
			const lastInstanceOf = it.constructor;
			if (degrees !== 180) {
				if (it instanceof HorizontalLineTo || it instanceof VerticalLineTo) {
					const newType = it.relative ? LineTo.key.toLowerCase() : LineTo.key;
					it = this.changeType(it, newType) || it;
				}
			}

			it.rotate(ox, oy, degrees, idx === 0);

			if (degrees === 90 || degrees === 270) {
				if (lastInstanceOf === HorizontalLineTo) {
					this.refreshAbsolutePositions();

					const newType = it.relative ? VerticalLineTo.key.toLowerCase() : VerticalLineTo.key;
					this.changeType(it, newType);
				} else if (lastInstanceOf === VerticalLineTo) {
					this.refreshAbsolutePositions();

					const newType = it.relative ? HorizontalLineTo.key.toLowerCase() : HorizontalLineTo.key;
					this.changeType(it, newType);
				}
			}
		});
		this.refreshAbsolutePositions();
		return this;
	}

	setRelative(newRelative: boolean) {
		this.paths.forEach((it) => {
			it.setRelative(newRelative);
		});
		this.refreshAbsolutePositions();
		return this;
	}

	delete(item: VecItem) {
		const idx = this.paths.indexOf(item);
		if (idx !== -1) {
			this.paths.splice(idx, 1);
			this.refreshAbsolutePositions();
		}
		return this;
	}

	getByIndex(idx: number): VecItem | null {
		if (idx >= 0 && idx < this.paths.length) {
			return this.paths[idx];
		}
		return null;
	}

  insertBefore(item: VecItem, before?: VecItem) {
    const idx = before ? this.paths.indexOf(before) : -1;
    if (idx !== -1) {
      this.paths.splice(idx, 0, item);
    } else {
      this.paths.unshift(item);
    }
    this.refreshAbsolutePositions();
    return idx;
  }

	insert(item: VecItem, after?: VecItem) {
		const idx = after ? this.paths.indexOf(after) : -1;
		if (idx !== -1) {
			this.paths.splice(idx + 1, 0, item);
		} else {
			this.paths.push(item);
		}
		this.refreshAbsolutePositions();
		return idx;
	}

	changeType(item: VecItem, newType: string): VecItem | null {
		const idx = this.paths.indexOf(item);
		if (idx > 0) {
			const previous = this.paths[idx - 1];
			this.paths[idx] = VecItem.MakeFrom(item, previous, newType);
			this.refreshAbsolutePositions();
			return this.paths[idx];
		}
		return null;
	}

	asString(decimals = 4, minify = false): string {
		return this.paths
			.reduce((acc: { type?: string, item: VecItem, trailing: VecItem[] }[], it: VecItem) => {
				// Group together the items that can be merged (M 0 0 L 1 1 => M 0 0 1 1)
				const type = it.getType();
				if (minify && acc.length > 0) {
					const last = acc[acc.length - 1];
					if (last.type === type) {
						last.trailing.push(it);
						return acc;
					}
				}
				acc.push({
					type: type === 'm' ? 'l' : (type === 'M' ? 'L' : type),
					item: it,
					trailing: []
				});
				return acc;
			}, [])
			.map(it => {
				const str = it.item.asString(decimals, minify, it.trailing);
				if (minify) {
					return str
						.replace(/^([a-z]) /i, '$1')
						.replace(/ -/g, '-')
						.replace(/(\.[0-9]+) (?=\.)/g, '$1');
				} else {
					return str;
				}
			}).join(minify ? '' : ' ');
	}

	targetLocations(): VectorPoint[] {
		return this.paths.map((it) => it.targetLocation());
	}

	controlLocations(): VectorControlPoint[] {
		let result: VectorControlPoint[] = [];
		for (let i = 1; i < this.paths.length; ++i) {
			const controls = this.paths[i].controlLocations();
			controls.forEach((it, idx) => {
				it.subIndex = idx;
			});
			result = [...result, ...controls];
		}
		return result;
	}


	setLocation(ptReference: VectorPoint, to: Point) {
		if (ptReference instanceof VectorControlPoint) {
			ptReference.itemReference.setControlLocation(ptReference.subIndex, to);
		} else {
			ptReference.itemReference.setTargetLocation(to);
		}
		this.refreshAbsolutePositions();
	}


	refreshAbsolutePositions() {
		let previous: VecItem | null = null;
		let origin = new Point(0, 0);
		for (const item of this.paths) {
			item.refreshAbsolutePoints(origin, previous);
			item.refreshAbsoluteControlPoints(origin, previous);

			item.absolutePoints.forEach(it => it.itemReference = item);
			item.absoluteControlPoints.forEach(it => it.itemReference = item);

			if (item instanceof MoveTo || item instanceof ClosePath) {
				origin = item.targetLocation();
			}
			previous = item;
		}
	}
}
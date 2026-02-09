import { TConfig } from "./Constant";

declare var getConfig: () => TConfig;
declare var setConfig: (config: TConfig) => void;

class LiveConfig {
  _wrapDistance = 20;
  _rotation = 15;
  doubleCut = false;
  unitOfMeasure = 2 as 2 | 3;
  _curvedSplitEnabled = false;
  _curvedSplitDepth = 100;
  _boxSelectionMode = false;

  constructor() {
    (async () => {
      const _config = await getConfig();
      this.rotation = _config.rotationStep ?? 15;
      this._curvedSplitEnabled = _config.curvedSplitEnabled ?? false;
      this.curvedSplitDepth = _config.curvedSplitDepth ?? 100;
    })();
  }

  get rotation() {
    return this._rotation;
  }

  set rotation(value) {
    if (value < 0) {
      value = 0;
    }
    if (value > 180) {
      value = 180;
    }
    this._rotation = value;
    (async () => {
      const _config = await getConfig();
      _config.rotationStep = value;
      setConfig(_config);
    })();
  }

  get wrapDistance() {
    // Return in the current unit system
    if (this.unitOfMeasure === 3) {
      // Convert from mm to inches for display
      return Number((this._wrapDistance / 25.4).toFixed(2));
    }
    return this._wrapDistance;
  }

  set wrapDistance(value) {
    // Validate based on the current unit system
    if (this.unitOfMeasure === 3) {
      // Imperial (inches) - allow 0.039 to 10 inches
      if (value < 0.039) {
        value = 0.039;
      }
      if (value > 10) {
        value = 10;
      }
      // Store as mm internally
      this._wrapDistance = Number((value * 25.4).toFixed(2));
    } else {
      // Metric (mm) - allow 1 to 254 mm
      if (value < 1) {
        value = 1;
      }
      if (value > 254) {
        value = 254;
      }
      this._wrapDistance = Number(value.toFixed(2));
    }
  }

  get curvedSplitDepth() {
    return this._curvedSplitDepth;
  }

  set curvedSplitDepth(value: number) {
    if (value < 5) {
      value = 5;
    }
    if (value > 500) {
      value = 500;
    }
    this._curvedSplitDepth = value;
    (async () => {
      const _config = await getConfig();
      _config.curvedSplitDepth = value;
      setConfig(_config);
    })();
  }

  get curvedSplitEnabled() {
    return this._curvedSplitEnabled;
  }

  set curvedSplitEnabled(value: boolean) {
    this._curvedSplitEnabled = value;
    (async () => {
      const _config = await getConfig();
      _config.curvedSplitEnabled = value;
      setConfig(_config);
    })();
  }

  get boxSelectionMode() {
    return this._boxSelectionMode;
  }

  set boxSelectionMode(value: boolean) {
    this._boxSelectionMode = value;
  }
}

export const liveConfig = new LiveConfig();

export function convertMm(value: string | number, toUnit: 'inches' | 'feet'): [number, 'Imperial' | 'Metric'] {
  // Ensure value is treated as a number
  const mmValue = typeof value === 'string' ? parseFloat(value) : value;

  // Conversion factors
  const MM_TO_INCHES = 0.0393701;
  const MM_TO_FEET = 0.00328084;

  // Perform the conversion based on the unit specified and round to 2 decimal places
  let result: number;
  if (toUnit === 'inches') {
      result = mmValue * MM_TO_INCHES;
  } else if (toUnit === 'feet') {
      result = mmValue * MM_TO_FEET;
  } else {
      throw new Error("Invalid unit. Please specify 'inches' or 'feet'.");
  }

  // Return the result rounded to 2 decimal places
  const currentUnit = liveConfig.unitOfMeasure;
  return [currentUnit === 3 ? parseFloat(result.toFixed(2)) : parseFloat(Number(value).toFixed(2)), currentUnit === 3 ? 'Imperial' : 'Metric'];
}
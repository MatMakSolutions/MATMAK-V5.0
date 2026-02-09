import { protocol } from "electron";

export const ZOOM_STEP           = 0.05;  // Zoom step
export const INITIAL_ZOOM        = 0.20;  // Initial zoom
export const MIN_ZOOM            = 0.05;  // Minimum zoom
export const MAX_ZOOM            = 3.0;   // Maximum zoom
export const ROTATION_ANGLE_STEP = 5;     // Rotation angle step

export const ITEM_COLOR_WHEN_SELECTED      = 0X094E6A;  // Color when item is selected
export const ITEM_FILL_ALPHA_WHEN_SELECTED = 0.5;       // Alpha when item is selected
export const ITEM_LINE_ALPHA_WHEN_SELECTED = 0.5;       // Alpha when item is overlaped

export const ITEM_COLOR_WHEN_OVERLAPED      = 0xFF0000;  // Color when item is overlaped
export const ITEM_FILL_ALPHA_WHEN_OVERLAPED = 0.5;       // Alpha when item is overlaped
export const ITEM_LINE_ALPHA_WHEN_OVERLAPED = 0.5;       // Alpha when item is overlaped

// Default values, will be overrided by config.json
export let config = {
  // Board settings
  boardWidth   : 1600,
  boardLenght  : 5000,
  rotationStep : 15,
  curvedSplitEnabled : false,
  curvedSplitDepth : 100,
  nesting      : {
    polyognTolerance  : 10,
    spaceBetweenParts : 10,   // 2cm
    rotationSteps     : 4,
    geneticAlgorithm  : {
      populationSize : 10,
      mutationRate   : 4,
      generation     : 0,
    }
  },

  // Cut settings
  cut: {
    target: "IP" as "PRINTER" | "SUMMA" | "IP" | "COMPORT"| "USB",
    printer: {
      name: "SummaCut",
    },
    summa: {
      model : "",
      blade : "",
    },
      usb: {
    path: "",
    },
    network: {
      ip   : "127.0.0.1",
      port : 9001
    },
    ////////////////////////comport and cutting settings ///////////////////////////////
    COMPORT: {
      portName : "",
      baudRate : '',
      parity   : "none" as "none" | "mark" | "even" | "odd" | "space",
      Bytesize : 8 as 5 | 6 | 7 | 8,
      stopBits : 1 as 1 | 2 | 1.5,


    },
    cuttingProtocol : "HPGL",
    swapAxis        : "",
    returntooringin : "true",
    feedaftercut    : "false",
    Velocity        : "",
    Force           : "",
    ForceValue      : "",
    VelocityValue   : ""

  } ,
  custom: {
      plotterName : "",
      model       : "",
      protocol    : "HPGL",
      moveUp      : "",
      moveDown    : "",
      start       : "",
      finish      : ""
    }

}

export type TConfig = typeof config;
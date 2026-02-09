/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f
} from "@ekkojs/web-controls";

import { _boardEvts, _evtBus, _evts } from "../../../core/EventBus";
import { L } from "../../../utils/L";
import { config, TConfig } from "../../../core/Constant";
import { liveConfig } from "../../../core/LiveConfig";
import { surfaceCollection } from "../../../data/repository/SurfaceCollection";
import "../../../utils/css/settings.css";


const isDebug = !true;

// Type definition for a single plotter object from plotters.json
type Plotter = {
  "Plotter Name": string;
  "Model": string | number;
  "Protocol": string;
  "Move Up": string;
  "Move Down": string;
  "Start": string;
  "Finish": string;
 

};


declare var getConfig: () => Promise<TConfig>;
declare var setConfig: (config: TConfig) => void;
declare var getPlotters: () => Promise<Plotter[]>;


export class Settings extends BaseComponent {
  width           : number                     = 0;
  length          : number                     = 0;
  plotterType     : string                     = "";
  printerList     : [string, string][]         = [];
  summaList       : [string, string][]         = [];
  bladeNumbers    : [string, string][]         = [];
  ip              : string                     = "";
  port            : string                     = "";
  selectedPrinter : string                     = "";
  selectedSumma   : string                     = "";
  selectedBlade   : string                     = "";
  target          : "IP" | "SUMMA" | "COMPORT"| "PRINTER" | "USB" = "IP";
  cuttingProtocol : string ="";
  swapAxis        : string ;
  Velocity        : string ;
  Force           : string ;
  ForceValue      : string ;
  VelocityValue   : string ;
  feedaftercut    : string ;
  returntooringin : string ;
  portName        : string = "";
  baudRate        : any ;
  parity          : any;
  Bytesize        : any;
  stopBits        : any;
 usbDevicePath    : string;
  activeTab       : "board" | "protocol" | "connection" = "board";



  plotterData         : Plotter[] = []; // Use the Plotter type
  plotterNames        : string[] = [];
  availableModels     : (string | number)[] = [];
  selectedPlotterName : string = "";
  selectedModel       : string | number = "";
  customMoveUp        : string = "";
  customMoveDown      : string = "";
  customStart         : string = "";
  customFinish        : string = "";
  customProtocol      : string = "";
  availableProtocols  : string[] = [];

  constructor() {
    super("Profile");
    this.registerTemplate("default",_default);

    this.addEventListener("mount", async () => {
  
      const [_config, _plotterData] = await Promise.all([getConfig(), getPlotters()]);

      this.plotterData = _plotterData;
      const uniqueNames = [...new Set(this.plotterData.map(p => p["Plotter Name"]))];
      this.usbDevicePath = _config.cut.usb?.path || "";
      this.plotterNames = uniqueNames.sort();
      
      this.width           = _config.boardWidth;
      this.length          = _config.boardLenght;
      
      if (liveConfig.unitOfMeasure === 3) {
        this.width = this.width / 25.4;
        this.length = this.length / 25.4;
      }
      this.plotterType     = _config.cut.target;
      this.ip              = _config.cut.network.ip;
      this.port            = _config.cut.network.port.toString();
      this.selectedPrinter = _config.cut.printer.name;
      this.selectedSumma   = _config.cut.summa.model;
      this.selectedBlade   = _config.cut.summa.blade;
      this.cuttingProtocol = _config.cut.cuttingProtocol;
      this.Force           = _config.cut.Force ;
      this.Velocity        = _config.cut.Velocity ;
      this.VelocityValue   = _config.cut.VelocityValue ;
      this.ForceValue      = _config.cut.ForceValue ;
      this.returntooringin = _config.cut.returntooringin ;
      this.swapAxis        = _config.cut.swapAxis;
      this.feedaftercut    = _config.cut.feedaftercut ;
      this.portName        = _config.cut.COMPORT.portName ;
      this.baudRate        = _config.cut.COMPORT.baudRate ;
      this.Bytesize        = _config.cut.COMPORT.Bytesize ;
      this.parity          = _config.cut.COMPORT.parity ;
      this.stopBits        = _config.cut.COMPORT.stopBits ;
      this.swapAxis        = _config.cut.swapAxis;

      // Load custom plotter settings if 'Custom' is the saved protocol
      if (_config.cut.cuttingProtocol === "Custom" && _config.custom) {
        const customConfig = _config.custom;
        this.selectedPlotterName = customConfig.plotterName;
        this.availableModels = this.plotterData
            .filter(p => p["Plotter Name"] === this.selectedPlotterName)
            .map(p => p["Model"]);
        this.selectedModel = customConfig.model;
        
        // Find the plotter to populate the protocols list on initial load
        const plotter = this.plotterData.find(p => 
            p["Plotter Name"] === this.selectedPlotterName && 
            p.Model.toString() === this.selectedModel.toString()
        );
        if (plotter) {
            this.availableProtocols = plotter.Protocol.split('/');
        }

        this.customProtocol = customConfig.protocol;
        this.customMoveUp = customConfig.moveUp;
        this.customMoveDown = customConfig.moveDown;
        this.customStart = customConfig.start;
        this.customFinish = customConfig.finish;
      }

      this.update();
    });

    this.registerDependencyProperties([
      "width", "length", "plotterType", "printerList", "summaList",
      "ip", "port", "selectedPrinter", "selectedSuma", "selectedBlade",
      "portName", "baudRate", "parity", "Bytesize", "stopBits",
      "cuttingProtocol", "swapAxis", "Velocity", "Force", "ForceValue", "VelocityValue",
      "selectedPlotterName", "selectedModel", "plotterNames", "availableModels","customProtocol",
      "customMoveUp", "customMoveDown", "customStart", "customFinish","availableProtocols","usbDevicePath","activeTab"
    ]);
  }
}


const _default: TRenderHandler = ($this:Settings) => {
    const handleModelChange = async (e: Event) => {
        const selectedModelValue = (e.currentTarget as HTMLSelectElement).value;
        $this.selectedModel = selectedModelValue;

        $this.availableProtocols = [];

        const plotter = $this.plotterData.find(p => p["Plotter Name"] === $this.selectedPlotterName && p.Model.toString() === selectedModelValue);

        if (plotter) {
            const protocols = plotter.Protocol.split('/');
            $this.availableProtocols = protocols;
            $this.customProtocol = protocols[0]; 

            $this.customMoveUp = plotter["Move Up"];
            $this.customMoveDown = plotter["Move Down"];
            $this.customStart = plotter.Start;
            $this.customFinish = plotter.Finish;


            const config = await getConfig();
            if (!config.custom) {
                config.custom = {
                    plotterName: '', model: '', protocol: '',
                    moveUp: '', moveDown: '', start: '', finish: ''
                };
            }
            config.custom.plotterName = $this.selectedPlotterName;
            config.custom.model = selectedModelValue;
            config.custom.protocol = $this.customProtocol;
            config.custom.moveUp = $this.customMoveUp;
            config.custom.moveDown = $this.customMoveDown;
            config.custom.start = $this.customStart;
            config.custom.finish = $this.customFinish;
        ;
            await setConfig(config);
        } else {
            $this.customProtocol = "";
            $this.customMoveUp = "";
            $this.customMoveDown = "";
            $this.customStart = "";
            $this.customFinish = "";
 
        }
        $this.update();
    };

    const handleProtocolChange = async (e: Event) => {
        const selectedProtocol = (e.currentTarget as HTMLSelectElement).value;
        $this.customProtocol = selectedProtocol;

        const config = await getConfig();
        if (config.custom) {
            config.custom.protocol = selectedProtocol;
            await setConfig(config);
        }
        $this.update();
    };

  return <>
    <div class="page-container">
        <div class="page-header">General Settings</div>
        
        {/* Tab Navigation */}
        <div class="tabs-container">
            <div class="tabs-header">
                <button 
                    class={`tab-button ${$this.activeTab === "board" ? "active" : ""}`}
                    onClick={() => {
                        $this.activeTab = "board";
                        $this.update();
                    }}
                >
                    Board
                </button>
                <button 
                    class={`tab-button ${$this.activeTab === "protocol" ? "active" : ""}`}
                    onClick={() => {
                        $this.activeTab = "protocol";
                        $this.update();
                    }}
                >
                    Cutting Protocol
                </button>
                <button 
                    class={`tab-button ${$this.activeTab === "connection" ? "active" : ""}`}
                    onClick={() => {
                        $this.activeTab = "connection";
                        $this.update();
                    }}
                >
                    Plotter Connection
                </button>
            </div>

            {/* Tab Content */}
            <div class="tab-content">
                {/* Board Tab */}
                {$this.activeTab === "board" && (
                    <>
                    <div class="settings-card">
                        <div class="card-header">
                            <div class="card-title">Board</div>
                            <p class="card-description">Define the default board size settings. Width is the size representing 
                            the roll size. Length is the size representing the roll length..</p>
                        </div>
                        <div class="card-body">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="width">Width ({liveConfig.unitOfMeasure === 3 ? "in" : "mm"})</label>
                                <input id="width" class="form-input" type="text" value={$this.width} onChange={async (_) => {
                                    const _uom = liveConfig.unitOfMeasure;
                                    let _value = Number(_.currentTarget.value);
                                    let mmValue = _value;
                                    if (_uom === 3) { mmValue = _value * 25.4; }
                                    $this.width = _value;
                                    const _config = await getConfig();
                                    _config.boardWidth = mmValue;
                                    setConfig(_config);
                                    config.boardWidth = mmValue;
                                    surfaceCollection.collection.forEach((surfaceData) => { surfaceData.boardWidth = mmValue; });
                                    _evtBus.emit(_boardEvts.BoardSurface.onReloadConfig, {});
                                }}/>
                            </div>
                             <div class="form-group">
                                <label for="length">Length ({liveConfig.unitOfMeasure === 3 ? "in" : "mm"})</label>
                                <input id="length" class="form-input" type="text" value={$this.length} onChange={async (_) => {
                                    const _uom = liveConfig.unitOfMeasure;
                                    let _value = Number(_.currentTarget.value);
                                    let mmValue = _value;
                                    if (_uom === 3) { mmValue = _value * 25.4; }
                                    $this.length = _value;
                                    const _config = await getConfig();
                                    _config.boardLenght = mmValue;
                                    setConfig(_config);
                                    config.boardLenght = mmValue;
                                    surfaceCollection.collection.forEach((surfaceData) => { surfaceData.boardLength = mmValue; });
                                    _evtBus.emit(_boardEvts.BoardSurface.onReloadConfig, {});
                                }}/>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Unit of Measure</label>
                            <div class="static-text">{liveConfig.unitOfMeasure === 3 ? "Imperial" : "Metric"}</div>
                        </div>
                    </div>
                </div>
                    </>
                )}

                {/* Cutting Protocol Tab */}
                {$this.activeTab === "protocol" && (
                    <div class="settings-card">
                        <div class="card-header">
                            <div class="card-title">Cutting Protocol</div>
                            <p class="card-description">Select the communication protocol and cutting parameters.</p>
                        </div>
                        <div class="card-body">
                         <div class="form-group">
                            <label for="cutting-protocol">Protocol</label>
                            <select id="cutting-protocol" class="form-select" value={$this.cuttingProtocol} onChange={async (e) => {
                                $this.cuttingProtocol = e.currentTarget.value ;
                                const config = await getConfig();
                                config.cut.cuttingProtocol = $this.cuttingProtocol;
                                setConfig(config);
                            }}>
                                <option value="HPGL">HPGL</option>
                                <option value="DMPL1">DMPL1</option>
                                <option value="DMPL2">DMPL2</option>
                                <option value="DMPL3">DMPL3</option>
                                <option value="DMPL4">DMPL4</option>
                                <option value="DMPL6">DMPL6</option>
                                <option value="GPGL">GPGL</option>
                                <option value="CAMMGL">CAMMGL</option>
                                <option value="CAMMGLMode1">CAMMGLMode1</option> 
                                <option value="Custom">Custom</option>
                            </select>
                        </div>
                        
                        {$this.cuttingProtocol === "Custom" && (
                            <div class="sub-settings-group">
                                <div class="form-group">
                                    <label for="plotter-name">Plotter Name</label>
                                    <select id="plotter-name" class="form-select" value={$this.selectedPlotterName} onChange={(e) => {
                                        const newPlotterName = e.currentTarget.value;
                                        $this.selectedPlotterName = newPlotterName;
                                        $this.availableModels = $this.plotterData
                                            .filter(p => p["Plotter Name"] === newPlotterName)
                                            .map(p => p["Model"]);
                                        $this.selectedModel = "";
                                        $this.customProtocol = "";
                                        $this.customMoveUp = "";
                                        $this.customMoveDown = "";
                                        $this.customStart = "";
                                        $this.customFinish = "";
                                  
                                        $this.update();
                                    }}>
                                        <option value="">Select Plotter...</option>
                                        {$this.plotterNames.map(name => <option value={name}>{name}</option>)}
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="plotter-model">Model</label>
                                    <select id="plotter-model" class="form-select" value={$this.selectedModel} disabled={!$this.selectedPlotterName} onChange={handleModelChange}>
                                        <option value="">Select Model...</option>
                                        {$this.availableModels.map(model => <option value={model}>{model}</option>)}
                                    </select>
                                </div>
                                {$this.selectedModel && (
                                    <div class="custom-commands-grid">
                                        <div class="form-group">
                                            <label for="custom-protocol">Protocol</label>
                                            {$this.availableProtocols.length > 1 ? (
                                                <select id="custom-protocol" class="form-select" value={$this.customProtocol} onChange={handleProtocolChange}>
                                                {$this.availableProtocols.map(protocol => <option value={protocol}>{protocol}</option>)}
                                                </select>
                                            ) : (
                                                <div class="static-text">{$this.customProtocol || "N/A"}</div>
                                            )}
                                        </div>
                                                
                                        <div class="form-group">
                                            <label for="move-up">Pen Up</label>
                                            <input id="move-up" class="form-input" type="text" value={$this.customMoveUp} onChange={async (e) => {
                                                $this.customMoveUp = e.currentTarget.value;
                                                const config = await getConfig();
                                                if (config.custom)config.custom.moveUp = $this.customMoveUp;
                                                await setConfig(config); $this.update();
                                            }} />
                                        </div>
                                        <div class="form-group">
                                            <label for="move-down">Pen Down</label>
                                            <input id="move-down" class="form-input" type="text" value={$this.customMoveDown} onChange={async (e) => {
                                                $this.customMoveDown = e.currentTarget.value;
                                                const config = await getConfig();
                                                if (config.custom) config.custom.moveDown = $this.customMoveDown;
                                                await setConfig(config); $this.update();
                                            }}/>
                                        </div>
                                        <div class="form-group">
                                            <label for="start-cmd">Start</label>
                                            <input id="start-cmd" class="form-input" type="text" value={$this.customStart} onChange={async (e) => {
                                                $this.customStart = e.currentTarget.value;
                                                const config = await getConfig();
                                                if (config.custom) config.custom.start = $this.customStart;
                                                await setConfig(config); $this.update();
                                            }}/>
                                        </div>
                                        <div class="form-group">
                                            <label for="finish-cmd">Finish</label>
                                            <input id="finish-cmd" class="form-input" type="text" value={$this.customFinish} onChange={async (e) => {
                                                $this.customFinish = e.currentTarget.value;
                                                const config = await getConfig();
                                                if (config.custom) config.custom.finish = $this.customFinish;
                                                await setConfig(config); $this.update();
                                            }}/>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        <div class="divider"/>
                         <div class="checkbox-group">
                            <input type="checkbox" id="Return-to-origin" class="form-checkbox" checked={$this.returntooringin === "true"} onChange={async (e) => {
                                const input = e.target as HTMLInputElement;
                                $this.returntooringin = input.checked ? "true" : "false";
                                const config = await getConfig();
                                config.cut.returntooringin = $this.returntooringin;
                                await setConfig(config);
                            }}/>
                            <label for="Return-to-origin">Return to origin (0,0)</label>
                        </div>
                        <div class="checkbox-group">
                             <input type="checkbox" id="feed-after-cut" class="form-checkbox" checked={$this.feedaftercut === "true"} onChange={async (e) => {
                                const input = e.target as HTMLInputElement;
                                $this.feedaftercut = input.checked ? "true" : "false";
                                const config = await getConfig();
                                config.cut.feedaftercut = $this.feedaftercut;
                                await setConfig(config);
                            }}/>
                            <label for="feed-after-cut">Feed after cut</label>
                        </div>
                         <div class="checkbox-group">
                             <input type="checkbox" id="swap-axis" class="form-checkbox" checked={$this.swapAxis === "true"} onChange={async (e) => {
                                const input = e.target as HTMLInputElement;
                                $this.swapAxis = input.checked ? "true" : "false";
                                const config = await getConfig();
                                config.cut.swapAxis = $this.swapAxis;
                                await setConfig(config);
                            }}/>
                            <label for="swap-axis">Swap X/Y Axis (Orientation)</label>
                        </div>
                        <div class="divider"/>
                        <div class="checkbox-group-dynamic">
                             <div class="checkbox-part">
                                <input type="checkbox" id="Velocity" class="form-checkbox" checked={$this.Velocity === "true"} onChange={async (e) => {
                                    const input = e.target as HTMLInputElement;
                                    $this.Velocity = input.checked ? "true" : "false";
                                    const config = await getConfig();
                                    config.cut.Velocity = $this.Velocity;
                                    if ($this.Velocity === "false") { $this.VelocityValue = ""; config.cut.VelocityValue = ""; }
                                    await setConfig(config);
                                }}/>
                                <label for="Velocity">Velocity</label>
                            </div>
                            {$this.Velocity === "true" && (
                                <input type="text" placeholder="Enter Velocity" class="form-input" value={$this.VelocityValue || ""} onChange={async (e) => {
                                    const input = e.target as HTMLInputElement;
                                    $this.VelocityValue = input.value;
                                    const config = await getConfig();
                                    config.cut.VelocityValue = $this.VelocityValue;
                                    await setConfig(config);
                                }}/>
                            )}
                        </div>
                         <div class="checkbox-group-dynamic">
                              <div class="checkbox-part">
                                <input type="checkbox" id="Force" class="form-checkbox" checked={$this.Force === "true"} onChange={async (e) => {
                                    const input = e.target as HTMLInputElement;
                                    $this.Force = input.checked ? "true" : "false";
                                    const config = await getConfig();
                                    config.cut.Force = $this.Force;
                                    if ($this.Force === "false") { $this.ForceValue = ""; config.cut.ForceValue = "";}
                                    await setConfig(config);
                                }}/>
                                <label for="Force">Force</label>
                            </div>
                            {$this.Force === "true" && (
                                <input type="text" placeholder="Enter Force" class="form-input" value={$this.ForceValue || ""} onChange={async (e) => {
                                    const input = e.target as HTMLInputElement;
                                    $this.ForceValue = input.value;
                                    const config = await getConfig();
                                    config.cut.ForceValue = $this.ForceValue;
                                    await setConfig(config);
                                }} />
                            )}
                        </div>
                    </div>
                </div>
                )}
                
                {/* Plotter Connection Tab */}
                {$this.activeTab === "connection" && (
                    <div class="settings-card">
                        <div class="card-header">
                            <div class="card-title">Plotter Connection</div>
                            <p class="card-description">Choose how the plotter is connected to the computer.</p>
                        </div>
                        <div class="card-body">
                        {/* Printer Plotter */}
                        <div class="radio-option-group">
                           <div class="radio-title-group">
                                <input type="radio" id="printerPlotter" name="plotter" class="form-radio" value="PRINTER" checked={$this.plotterType === "PRINTER"} onClick={async () => {
                                    const config = await getConfig();
                                    config.cut.target = "PRINTER";
                                    $this.plotterType = "PRINTER";
                                    setConfig(config);
                                }}/>
                                <label for="printerPlotter">Printer Plotter</label>
                            </div>
                            <p class="radio-description">Check this option if the plotter should be reached like a standard printer device.</p>
                             {$this.plotterType === 'PRINTER' && <div class="radio-content">
                                <select class="form-select" onChange={async (e) => {
                                    const printer = e.currentTarget.selectedOptions[0].value;
                                    const config = await getConfig();
                                    config.cut.printer.name = printer;
                                    $this.selectedPrinter = printer;
                                    setConfig(config);
                                }}>
                                    <option value="">Select a printer</option>
                                    {$this.printerList.map((item) => {
                                        return <option value={item[0]} selected={item[0] === $this.selectedPrinter}>{item[1]}</option>;
                                    })}
                                </select>
                             </div>}
                        </div>
                        <div class="divider"/>
                        {/* Summa Plotter */}
                        <div class="radio-option-group">
                            <div class="radio-title-group">
                                <input type="radio" id="sumaPlotter" name="plotter" class="form-radio" value="SUMMA" checked={$this.plotterType === "SUMMA"} onClick={async () => {
                                    const config = await getConfig();
                                    config.cut.target = "SUMMA";
                                    $this.plotterType = "SUMMA";
                                    setConfig(config);
                                }}/>
                                <label for="sumaPlotter">Summa Plotter</label>
                            </div>
                             <p class="radio-description">Check this option if the plotter is a Summa plotter.</p>
                             {$this.plotterType === 'SUMMA' && <div class="radio-content">
                                 <select class="form-select" onChange={async (e) => {
                                        const model = e.currentTarget.selectedOptions[0].value;
                                        const config = await getConfig();
                                        config.cut.summa.model = model;
                                        setConfig(config);
                                    }}>
                                    <option value="">Select a model</option>
                                    {$this.summaList.map((item) => {
                                        return <option value={item[0]} selected={item[0] === $this.selectedSumma}>{item[1]}</option>;
                                    })}
                                </select>
                              
                             </div>}
                        </div>
                        <div class="divider"/>
                        {/* IP Plotter */}
                         <div class="radio-option-group">
                             <div class="radio-title-group">
                                <input type="radio" id="ipPlotter" name="plotter" class="form-radio" value="IP" checked={$this.plotterType === "IP"} onClick={async () => {
                                    const config = await getConfig();
                                    config.cut.target = "IP";
                                    $this.plotterType = "IP";
                                    setConfig(config);
                                }}/>
                                <label for="ipPlotter">IP Plotter</label>
                            </div>
                             <p class="radio-description">Check this option if the plotter is a IP plotter.</p>
                              {$this.plotterType === 'IP' && <div class="radio-content form-row">
                                <div class="form-group">
                                    <label for="ipAddress">IP Address</label>
                                    <input class="form-input" type="text" id="ipAddress" value={$this.ip} onChange={async (e) => {
                                        $this.ip = e.currentTarget.value;
                                        const config = await getConfig();
                                        config.cut.network.ip = $this.ip;
                                        setConfig(config);
                                    }}/>
                                </div>
                                <div class="form-group">
                                    <label for="port">Port</label>
                                    <input type="number" id="port" class="form-input" value={$this.port} onChange={async (e) => {
                                        $this.port = e.currentTarget.value;
                                        const config = await getConfig();
                                        config.cut.network.port = Number($this.port);
                                        setConfig(config);
                                    }}/>
                                </div>
                              </div>}
                        </div>
                       <div class="divider"/>
                        <div class="radio-option-group">
                             <div class="radio-title-group">
                                <input type="radio" id="usbPlotter" name="plotter" class="form-radio" value="USB" checked={$this.plotterType === "USB"} onClick={async () => {
                                    const config = await getConfig();
                                    config.cut.target = "USB";
                                    $this.plotterType = "USB";
                                    setConfig(config);
                                }}/>
                                <label for="usbPlotter">Direct USB Plotter</label>
                            </div>
                             <p class="radio-description">Check this option if the plotter is a USB plotter.</p>
                             {$this.plotterType === 'USB' && 
                               <div class="radio-content form-group">
                                   <label for="usbPath">Device Path</label>
                                   <input class="form-input" type="text" id="usbPath" placeholder="Enter device path" value={$this.usbDevicePath} onChange={async (e) => {
                                       $this.usbDevicePath = e.currentTarget.value;
                                       const config = await getConfig();
                                       if (!config.cut.usb) config.cut.usb = { path: "" };
                                       config.cut.usb.path = $this.usbDevicePath;
                                       setConfig(config);
                                   }}/>
                               </div>
                             }
                        </div>
                        <div class="divider"/>
                        {/* COM Port Plotter */}
                        <div class="radio-option-group">
                             <div class="radio-title-group">
                                <input type="radio" id="comPortPlotter" name="plotter" class="form-radio" value="COMPORT" checked={$this.plotterType === "COMPORT"} onClick={async () => {
                                    const config = await getConfig();
                                    config.cut.target = "COMPORT";
                                    $this.plotterType = "COMPORT";
                                    setConfig(config);
                                }}/>
                                <label for="comPortPlotter">COM Port Plotter</label>
                            </div>
                            <p class="radio-description">Check this option if the plotter is a COM port plotter.</p>
                             {$this.plotterType === 'COMPORT' && <div class="radio-content">
                                 <div class="form-row">
                                     <div class="form-group">
                                        <label for="comportName">COM Port</label>
                                        <input class="form-input" type="text" id="comportName" value={$this.portName} onChange={async (e) => {
                                            $this.portName = e.currentTarget.value;
                                            const config = await getConfig();
                                            config.cut.COMPORT.portName = $this.portName;
                                            setConfig(config);
                                        }}/>
                                     </div>
                                      <div class="form-group">
                                        <label for="baudRate">Baud Rate</label>
                                        <select id="baudRate" class="form-select" value={$this.baudRate} onChange={async (e) => {
                                            $this.baudRate = e.currentTarget.value;
                                            const config = await getConfig();
                                            config.cut.COMPORT.baudRate = $this.baudRate;
                                            setConfig(config);
                                        }}>
                                            <option>300</option><option>600</option><option>1200</option><option>2400</option><option>4800</option><option selected>9600</option><option>19200</option><option>38400</option><option>57600</option><option>115200</option><option>230400</option><option>460800</option><option>921600</option>
                                        </select>
                                      </div>
                                 </div>
                                  <div class="form-row">
                                     <div class="form-group">
                                        <label for="bytesize">Byte Size</label>
                                        <select id="bytesize" class="form-select" value={$this.Bytesize} onChange={async (e) => {
                                            $this.Bytesize = e.currentTarget.value;
                                            const config = await getConfig();
                                            config.cut.COMPORT.Bytesize = $this.Bytesize;
                                            setConfig(config);
                                        }}>
                                            <option>5</option><option>6</option><option>7</option><option selected>8</option>
                                        </select>
                                      </div>
                                       <div class="form-group">
                                        <label for="StopBits">Stop Bits</label>
                                        <select id="StopBits" class="form-select" value={$this.stopBits} onChange={async (e) => {
                                            $this.stopBits = e.currentTarget.value;
                                            const config = await getConfig();
                                            config.cut.COMPORT.stopBits = $this.stopBits;
                                            setConfig(config);
                                        }}>
                                            <option selected>1</option><option>1.5</option><option>2</option>
                                        </select>
                                    </div>
                                      <div class="form-group">
                                        <label for="parity">Parity</label>
                                        <select id="parity" class="form-select" value={$this.parity} onChange={async (e) => {
                                            $this.parity = e.currentTarget.value;
                                            const config = await getConfig();
                                            config.cut.COMPORT.parity = $this.parity;
                                            setConfig(config);
                                        }}>
                                            <option value="none">None</option><option value="even">Even</option><option value="odd">Odd</option><option value="mark">Mark</option><option value="space">Space</option>
                                        </select>
                                      </div>
                                 </div>
                             </div>}
                        </div>
                    </div>
                </div>
                )}
            </div>
        </div>
    </div>
  </>;
};


/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f,
  JSXInternal
} from "@ekkojs/web-controls";
import { MainFrame } from "../../../ui/layout/Frame";
import { getUow } from "../../..//uof/UnitOfWork";
import { searchResults, sFetch } from "../../../uof/Globals";
import { TUserresponse } from "../../../uof/UserType";
import { Profile } from "../buttons/Profile";
import { _boardEvts, _evtBus, _evts, CancelEvent, nestingEvents } from "../../../core/EventBus";
import { config } from "../../../core/Constant";
import { UserSettingsResponse } from "../../../data/models/UserSettingResponse";
import { liveConfig } from "../../../core/LiveConfig";
import "../../../utils/css/popup.css"; 
import  "../../../Graphics/SurfaceManager";
import { SurfaceManager, surfaceManager } from "../../../Graphics/SurfaceManager";
import "../../../utils/css/popup.css"; 




export class Popup extends BaseComponent {
  width : number | string = 500;
  height: number | string = 400;
  isPrompt: boolean = false;
  content: string | JSXInternal.Element | BaseComponent = "";
  isVisible: boolean = false;
  title: string = "Popup";
  actions: JSXInternal.Element[] = [];
  currentresolver: (value: string) => void = () => {};
  interval?: NodeJS.Timeout;
  show() {
    this.isVisible = true;
    this.update();
    return new Promise<string>((resolve) => {
      this.currentresolver = resolve;
    });
  }
  hide() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    this.isVisible = false;
    this.update();
  }
  constructor() {
    super("Popup");
    this.registerTemplate("default", _default);
  }
}

const _default: TRenderHandler = ($this: Popup) => {
  return <>
    <div className={`popup-background ${$this.isVisible ? 'visible' : 'hidden'}`}></div>
    <div className={`popup-container ${$this.isVisible ? 'visible' : 'hidden'}`} style={{ width: `${$this.width}px`, height: `${$this.height}px`, top: `calc(50% - (${$this.height}px)/2)`, left: `calc(50% - (${$this.width}px)/2)` }}>
      <div className="popup-title">{ $this.title }</div>
      <div className="popup-content">{ ($this.content as BaseComponent)?.vdom ?? $this.content }</div>
      <div className="popup-actions">{ $this.actions }</div>
    </div>
  </>;
};




export async function ppSoftwareUpdate() {
  const popup = new Popup();
  const mainFrame = getUow<MainFrame>("mainFrame");
  mainFrame.children.push(popup);
  mainFrame.update();

  const msgAsk = "There is a new version of the software available. Would you like to update?";
  const inProgress = "Updating software... Please wait.";
  const success = "Software updated successfully. Please restart the application.";
  let pct = 0;
  let isAsking = true;

  const contentAsk = (
    <div className="popup-nesting-content">
      <div className="popup-message">{msgAsk}</div>
    </div>
  );

  const contentInProgress = () =>
    <div className="popup-nesting-content">
      <div className="popup-message">{inProgress}</div>
      <div className="progress-bar-container">
        <div className="progress-bar" style={{ width: `${pct}%` }}></div>
      </div>
    </div>;

  const contentSuccess = () => 
    <div className="popup-nesting-content">
      <div className="popup-message">{success}</div>
    </div>;

  popup.title = "Software Update";
  popup.height = 250;
  popup.content = contentAsk;

  popup.actions = [
    <div className="popup-action-button" onClick={() => {
      isAsking = false;
      popup.content = contentInProgress();
      popup.update();
      (window as any).installUpdate();

      const idx = setInterval(async () => {
        pct = await (window as any).updateProgress();
        popup.content = contentInProgress();
        popup.update();

        popup.actions = [<div className="popup-action-button popup-action-disabled" >{"Ok"}</div>];
        if (pct >= 100) {
          clearInterval(idx);
          popup.content = contentSuccess();
          popup.actions = [<div className="popup-action-button" onClick={() => {
            (window as any).close();
          }}>{"Ok"}</div>];
          popup.update();
        }
      }, 200);
    }}>{"Ok"}</div>,
    <div className="popup-action-button popup-action-cancel" onClick={() => {
      popup.hide();
      popup.currentresolver(void 0);
      const btnProfile = getUow<Profile>("profile");
      _evtBus.emit(_evts.ButtonBar.Click, {id: btnProfile.guid, name: "profile"});
      (window as any).forceMaximize();
    }}>{"Cancel"}</div>,
  ];
  popup.update();
  return popup.show();
}


export async function ppLogin() {
  searchResults.clear();
  localStorage.removeItem("token");
  localStorage.removeItem("user");

  const popup = new Popup();
  const mainFrame = getUow<MainFrame>("mainFrame");
  mainFrame.children.push(popup);
  mainFrame.update();
  let value = 1;
  let userName = "";
  let password = "";
  const rememberMe = localStorage.getItem("rememberMe") === "true";
  if (rememberMe) {
    userName = atob(localStorage.getItem("guid1") as string);
    password = atob(localStorage.getItem("guid2") as string);
  }
  popup.update();
  mainFrame.update();

  function togglePassword() {
    const rememberMe = localStorage.getItem("rememberMe") === "true";
    if (rememberMe) {
      const passwordField = document.querySelector(".password-input") as HTMLInputElement;
      passwordField.type = "password";
      return;
    }

    const passwordField = document.querySelector(".password-input") as HTMLInputElement;
    if (passwordField.type === "password") {
      passwordField.type = "text";
    } else {
      passwordField.type = "password";
    }
  }

  popup.title = "Sign In";
  popup.height = 480;
  popup.content = <div className="popup-login-content">
    <div className="popup-message">{"Please log in with your credentials"}</div>
    <div className="popup-input-group">
      <span>Login</span>
      <input type="text" value={userName} className="popup-input" onKeyUp={(e) => {
        userName = (e.target as HTMLInputElement).value;
      }} />
    </div>
    <div className="popup-input-group">
      <span>Password</span>
      <div className="password-container">
        <input type="password" className="password-input" value={password} onKeyUp={(e) => {
          password = (e.target as HTMLInputElement).value;
        }} />
        <span className="toggle-password" onClick={() => togglePassword()}>👁️</span>
      </div>
    </div>
    <div className="popup-checkbox-group">
      <input type="checkbox" checked={rememberMe} className="popup-checkbox" onChange={(e) => {
        const isChecked = (e.target as HTMLInputElement).checked;
        localStorage.setItem("rememberMe", isChecked ? "true" : "false");
        if (!isChecked) {
          localStorage.removeItem("guid1");
          localStorage.removeItem("guid2");
          password = "";
          document.querySelector<HTMLInputElement>(".password-input").value = "";
        }
      }} />
      <label>Remember me</label>
    </div>
  </div>;
  popup.actions = [
    <div className="popup-action-button" onClick={async () => {
      try {
        const user = await sFetch("authentication/signin/client", "POST", {
          "email": userName,
          "password": password
        }, true) as TUserresponse;

        if (user) {
          localStorage.setItem("token", user.payload.token);
          console.log("token", localStorage.getItem("token"));
          localStorage.setItem("user", user.payload.user_id);

          const isChecked = localStorage.getItem("rememberMe") === "true";
          if (isChecked) {
            localStorage.setItem("guid1", btoa(userName));
            localStorage.setItem("guid2", btoa(password));
          }
          try {
            const subscription: any = await sFetch("account/subscriptionvalidity", "POST", {
              "value": "000001.3657qvfmrck",
              "hash": -542307620
            });

            if (!(subscription.statusCode === 200)) {
              await ppInfo("Error", "No valid subscription found");
              (window as any).close();
              return;
            }
          } catch (ex) {
            await ppInfo("Error", "No valid subscription found");
            (window as any).close();
            return;
          }

          try {
            const userSettings = await sFetch<UserSettingsResponse>("user/settings", "GET", null);
            liveConfig.unitOfMeasure = userSettings.update_preference_request.unit_of_measure as 2 | 3;
          } catch (ex) {
            await ppInfo("Error", "No valid subscription found");
            (window as any).close();
            return;
          }

          const update = await (window as any).checkForUpdate(localStorage.getItem("token"));
          if (update) {
            ppSoftwareUpdate();
            popup.hide();
            popup.currentresolver(void 0);
            return;
          }
          popup.hide();
          popup.currentresolver(void 0);

          const btnProfile = getUow<Profile>("profile");
          _evtBus.emit(_evts.ButtonBar.Click, {id: btnProfile.guid, name: "profile"});
          (window as any).forceMaximize();
        } else {
          ppInfo("Error", "Invalid credentials");
        }
      } catch {
        ppInfo("Error", "Invalid credentials");
      }
    }}>{"Sign In"}</div>,
    <div className="popup-action-button popup-action-cancel" onClick={async () => {
      try {
        (window as any).close();
      } catch {
        ppInfo("Error", "Invalid credentials");
      }
    }}>{"Close"}</div>
  ];
  popup.update();
  return await popup.show();
}


export async function ppProjectStatus() {
  const popup = new Popup();
  const mainFrame = getUow<MainFrame>("mainFrame");
  mainFrame.children.push(popup);
  mainFrame.update();
  let value = 1;

  const projectStatusList = ((await sFetch("userproject/projectstatus", "GET", null)) as any).payload;
  
  // Get current theme to apply appropriate styles
  const themeManager = (window as any).themeManager;
  const isDark = themeManager?.isDarkMode ? themeManager.isDarkMode() : false;
  const selectStyle = {
    height: "32px",
    fontSize: "0.875rem",
    padding: "6px 30px 6px 10px",
    border: isDark ? "1px solid #374151" : "1px solid #555",
    borderRadius: "4px",
    backgroundColor: isDark ? "#2a2a2a" : "#3a3a3a",
    color: isDark ? "#E5E7EB" : "#e0e0e0",
    cursor: "pointer",
    WebkitAppearance: "none" as const,
    MozAppearance: "none" as const,
    appearance: "none" as const,
    backgroundImage: isDark 
      ? "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"%23E5E7EB\"><path d=\"M7 10l5 5 5-5z\"/></svg>')"
      : "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"%23000000\"><path d=\"M7 10l5 5 5-5z\"/></svg>')",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 8px center",
    backgroundSize: "16px",
  };

  popup.title = "Project Status";
  popup.height = 210;
  popup.content = <div className="popup-status-content">
    <span className="popup-message">Select the status of your project</span>
    <select className="popup-select" style={selectStyle} onChange={(e) => {
      value = parseInt((e.target as HTMLSelectElement).value);
    }}>
      {projectStatusList.map((status: any) => {
        return <option value={status.id} style={{
          backgroundColor: isDark ? "#2a2a2a" : "#3a3a3a",
          color: isDark ? "#E5E7EB" : "#e0e0e0",
        }}>{status.statusName}</option>;
      })}
    </select>
  </div>;
  popup.actions = [
    <div className="popup-action-button" onClick={() => {
      popup.hide();
      popup.currentresolver(value.toString());
    }}>{"Ok"}</div>,
    <div className="popup-action-button popup-action-cancel" onClick={() => {
      popup.hide();
      popup.currentresolver("");
    }}>{"Cancel"}</div>,
  ];
  popup.update();
  return await popup.show();
}

export async function ppCutStatus() {
  const popup = new Popup();
  const mainFrame = getUow<MainFrame>("mainFrame");
  mainFrame.children.push(popup);
  mainFrame.update();
  let value = 1;

  const projectStatusList = ((await sFetch("usercuttes/feedback/statuses", "GET", null)) as any).payload;
  
  // Get current theme to apply appropriate styles
  const themeManager = (window as any).themeManager;
  const isDark = themeManager?.isDarkMode ? themeManager.isDarkMode() : false;
  const selectStyle = {
    height: "32px",
    fontSize: "0.875rem",
    padding: "6px 30px 6px 10px",
    border: isDark ? "1px solid #374151" : "1px solid #555",
    borderRadius: "4px",
    backgroundColor: isDark ? "#2a2a2a" : "#3a3a3a",
    color: isDark ? "#E5E7EB" : "#e0e0e0",
    cursor: "pointer",
    WebkitAppearance: "none" as const,
    MozAppearance: "none" as const,
    appearance: "none" as const,
    backgroundImage: isDark 
      ? "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"%23E5E7EB\"><path d=\"M7 10l5 5 5-5z\"/></svg>')"
      : "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"%23000000\"><path d=\"M7 10l5 5 5-5z\"/></svg>')",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 8px center",
    backgroundSize: "16px",
  };

  popup.title = "Project Status";
  popup.height = 210;
  popup.content = <div className="popup-status-content">
    <span className="popup-message">Give a Feedback of the Pattern Quality</span>
    <select className="popup-select" style={selectStyle} onChange={(e) => {
      value = parseInt((e.target as HTMLSelectElement).value);
    }}>
      {projectStatusList.map((status: any) => {
        return <option value={status.id} style={{
          backgroundColor: isDark ? "#2a2a2a" : "#3a3a3a",
          color: isDark ? "#E5E7EB" : "#e0e0e0",
        }}>{status.status}</option>;
      })}
    </select>
  </div>;
  popup.actions = [
    <div className="popup-action-button" onClick={() => {
      popup.hide();
      popup.currentresolver(value.toString());
    }}>{"Ok"}</div>,
    <div className="popup-action-button popup-action-cancel" onClick={() => {
      popup.hide();
      popup.currentresolver("");
    }}>{"Cancel"}</div>,
  ];
  popup.update();
  return await popup.show();
}

export function ppInfo(title: string, message: string, okText: string = "Ok", width: number = 500, height: number = 230) {
  const popup = new Popup();
  const mainFrame = getUow<MainFrame>("mainFrame");
  mainFrame.children.push(popup);
  mainFrame.update();

  popup.title = title;
  popup.width = width;
  popup.height = height;
  popup.content = <div className="popup-info-content">
    <span className="popup-message">{message}</span>
  </div>;
  popup.actions = [
    <div className="popup-action-button" onClick={() => {
      popup.hide();
      popup.currentresolver("ok");
    }}>{okText}</div>,
  ];
  popup.update();
  return popup.show();
}

export function ppConfirm(title: string, message: string, okText: string = "Ok", cancelText: string = "Cancel") {
  const popup = new Popup();
  const mainFrame = getUow<MainFrame>("mainFrame");
  mainFrame.children.push(popup);
  mainFrame.update();

  popup.title = title;
  popup.height = 210;
  popup.content = <div className="popup-info-content">
    <span className="popup-message">{message}</span>
  </div>;
  popup.actions = [
    <div className="popup-action-button" onClick={() => {
      popup.hide();
      popup.currentresolver("ok");
    }}>{okText}</div>,
    <div className="popup-action-button popup-action-cancel" onClick={() => {
      popup.hide();
      popup.currentresolver("cancel");
    }}>{cancelText}</div>,
  ];
  popup.update();
  return popup.show();
}

export function ppPrompt(title: string, defaultText: string, okText: string, cancelText: string) {
  const popup = new Popup();
  let value = defaultText;
  const mainFrame = getUow<MainFrame>("mainFrame");
  mainFrame.children.push(popup);
  mainFrame.update();

  popup.title = title;
  popup.height = 210;
  popup.content = <div className="popup-prompt-content">
    <input type="text" defaultValue={defaultText} className="popup-input" onChange={(e) => {
      value = (e.target as HTMLInputElement).value;
    }} />
  </div>;
  popup.actions = [
    <div className="popup-action-button" onClick={() => {
      popup.hide();
      popup.currentresolver(value);
    }}>{okText}</div>,
    <div className="popup-action-button popup-action-cancel" onClick={() => {
      popup.hide();
      popup.currentresolver("");
    }}>{cancelText}</div>,
  ];
  popup.update();
  return popup.show();
}

export function ppWait(title: string, message: string, width: number = 500, height: number = 230) {
  const popup = new Popup();
  const mainFrame = getUow<MainFrame>("mainFrame");
  mainFrame.children.push(popup);
  mainFrame.update();

  popup.title = title;
  popup.width = width;
  popup.height = height;
  popup.content = <div className="popup-info-content">
    <span className="popup-message">{message}</span>
  </div>;
  popup.actions = [];
  popup.update();
  return popup;
}

/////new function for nesting 

export function ppNesting() {  
  const popup = new Popup();
  const mainFrame = getUow<MainFrame>("mainFrame");
  mainFrame.children.push(popup);
  mainFrame.update();
  const msgAsk = "Do you want to apply nesting to the selected items? this may take a while.";
  let inProgress = "Nesting in progress, please wait...!";
  const success = "Nesting completed successfully.Press Esc if you want to keep the nesting at it place or click any where in the board if you want to place it somewhere else";
  let pct = 0;
  const contentAsk = (
    <div className="popup-nesting-content">
      <div className="popup-message">{msgAsk}</div>
    </div>
  );
  const contentInProgress = () =>
    <div className="popup-nesting-content">
      <div className="popup-message">{inProgress}</div>
      <div className="progress-bar-container">
        <div className="progress-bar" style={{ width: `${pct}%` }}></div>
      </div>
    </div>;
  const contentSuccess = () =>
    <div className="popup-nesting-content">
      <div className="popup-message">{success}</div>
    </div>;

  popup.title = "Super Nesting";
  popup.height = 250;
  popup.content = contentInProgress();  
  popup.update();

  const onOff = [] as CancelEvent[];

  onOff.push(nestingEvents.progress.waitFor((_) => {
    pct = (_.progress * 100 as number) >> 0;
    inProgress = `Nesting in progress !, please wait... Iteration ${_.generation + 1}/${config.nesting.geneticAlgorithm.generation + 1}`;
    popup.content = contentInProgress();
    popup.update();  
  }));

  onOff.push(nestingEvents.packingResult.waitFor((_) => {
    popup.content = contentSuccess();
      popup.actions = []; 
    popup.update(); 
    setTimeout(() => {
      popup.hide();
      onOff.forEach((e) => { e.off(); });
    }, 4500);  
  }));

  onOff.push(nestingEvents.stop.handle(() => {
    popup.hide();
    onOff.forEach((e) => { e.off(); });
  }));

  popup.actions = [
    <div className="popup-action-button" onClick={() => {
      popup.content = contentInProgress();
      popup.update();  
      popup.actions.shift();  
      let localOnOff = [] as CancelEvent[];
      localOnOff.push(_evtBus.on(_boardEvts.BoardSurface.onNestingComplete, (_: any) => {
        popup.hide();
        localOnOff.forEach((e) => { e.off(); });
      }));
      _evtBus.emit(_boardEvts.BoardSurface.onNesting);
    }}>{"Ok"}</div>,
    <div className="popup-action-button popup-action-cancel" onClick={() => {
     nestingEvents.stop.do();  
  surfaceManager.cleanupNestingCopies();
   
      popup.hide();
      popup.currentresolver(void 0);
   
     onOff.forEach((e) => { e.off(); });
     
   
    
    }}>{"Cancel"}</div>,
  ];
  popup.actions.shift(); 
  popup.update();  
  popup.show();  
  return popup;  
}

///////////////////////////////////////

/////////////////////////////////
export async function ppNestingQuality() {
  const popup = new Popup();
  const mainFrame = getUow<MainFrame>("mainFrame");
  mainFrame.children.push(popup);
  mainFrame.update();
  let qualityIndex = 2; 
  const getQuality = (idx: number): string => idx === 1 ? 'fast' : idx === 2 ? 'balanced' : 'high_quality';
  popup.title = "Nesting Quality";
  popup.height = 300;
  popup.content = <div className="popup-quality-content">
    <div className="popup-message">Choose the quality of nesting</div>
    <input
      type="range"
      min="1"
      max="3"
      value={qualityIndex}
      step="1"
      className="quality-slider"
      onInput={(e) => {
        qualityIndex = parseInt((e.target as HTMLInputElement).value);
      }}
    />
    <div className="quality-labels">
      <legend>Fast (1 min)</legend>
      <legend>Balanced (4 min)</legend>
      <legend>High Quality (11 min)</legend>
    </div>
  </div>;
  popup.actions = [
    <div className="popup-action-button" onClick={() => {
      popup.hide();
      popup.currentresolver(getQuality(qualityIndex));
    }}>{"Ok"}</div>,
    <div className="popup-action-button popup-action-cancel" onClick={() => {
      popup.hide();
      popup.currentresolver("");
    }}>{"Cancel"}</div>,
  ];
  popup.update();
  return await popup.show();
}


 export function ppNestingProgress(title: string, estimatedSeconds: number) {
  const popup = new Popup();
  const mainFrame = getUow<MainFrame>("mainFrame");
  mainFrame.children.push(popup);
  mainFrame.update();
  let remaining = estimatedSeconds;
  const success = "Nesting completed successfully.Press Esc if you want to keep the nesting at its current place or click any where in the board if you want to place it somewhere else on the board";
  popup.title = title;
  popup.height = 250;
  popup.content = (
    <div className="popup-nesting-content">
      <div className="popup-message">Nesting in progress, please wait...</div>
      <div className="timer-display">{`${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, '0')}`}</div>
      <div className="progress-bar-container">
        <div className="progress-bar" style={{ width: `${(remaining / estimatedSeconds) * 100}%` }}></div>
      </div>
    </div>
  );
  popup.actions = [];
  const interval = setInterval(() => {
    remaining--;
    if (remaining < 0) remaining = 0;
    popup.content = (
      <div className="popup-nesting-content">
        <div className="popup-message">Nesting in progress, please wait...</div>
        <div className="timer-display">{`${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, '0')}`}</div>
        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: `${(remaining / estimatedSeconds) * 100}%` }}></div>
        </div>
      </div>
    );
    popup.update();
    if (remaining <= 0) {
      clearInterval(interval);
    }
  }, 1000);
  popup.interval = interval;
  // Save original hide method before overriding
  const originalHide = popup.hide.bind(popup);
  popup.hide = () => {
    clearInterval(interval);
    originalHide();
  };
  popup.update();
  popup.show();
  return popup;
}
  
export async function ppChooseNesting() {
  const popup = new Popup();
  const mainFrame = getUow<MainFrame>("mainFrame");
  mainFrame.children.push(popup);
  mainFrame.update();
  popup.title = "Nesting Type";
  popup.height = 250;
  popup.content = <div className="popup-nesting-content">
    <div className="popup-message">Local : Runs on your Device, good for 1 to 5 patterns</div>
    <div className="popup-message">Cloud : Runs on our servers, good for 2+ patterns More Accurate</div>
   
  </div>;
  popup.actions = [
    <div className="popup-action-button" onClick={() => {
      popup.hide();
      popup.currentresolver("local");
    }}>{"Local Nesting"}</div>,
    <div className="popup-action-button" onClick={() => {
      popup.hide();
      popup.currentresolver("cloud");
    }}>{"Cloud Nesting"}</div>,
    <div className="popup-action-button popup-action-cancel" onClick={() => {
      popup.hide();
      popup.currentresolver("");
    }}>{"Cancel"}</div>,
  ];
  popup.update();
  return await popup.show();
}

export function ppCutOrPreview(title: string, message: string) {
  const popup = new Popup();
  const mainFrame = getUow<MainFrame>("mainFrame");
  mainFrame.children.push(popup);
  mainFrame.update();

  popup.title = title;
  popup.height = 240;
  
  // Split message by newlines and render each as a separate element
  const messageLines = message.split('\n').filter(line => line.trim());
  
  popup.content = <div className="popup-info-content">
    {messageLines.map((line, idx) => (
      <span 
        key={idx} 
        className="popup-message" 
        style={{ 
          display: 'block', 
          marginBottom: idx < messageLines.length - 1 ? '8px' : '0',
          fontWeight: idx === 0 ? 'bold' : 'normal',
          fontSize: idx === 0 ? '16px' : '14px'
        }}
      >{line}</span>
    ))}
  </div>;
  popup.actions = [
    <div className="popup-action-button" onClick={() => {
      popup.hide();
      popup.currentresolver("preview");
    }}>{"Preview"}</div>,
    <div className="popup-action-button" onClick={() => {
      popup.hide();
      popup.currentresolver("direct");
    }}>{"Cut Directly"}</div>,
    <div className="popup-action-button popup-action-cancel" onClick={() => {
      popup.hide();
      popup.currentresolver("cancel");
    }}>{"Cancel"}</div>,
  ];
  popup.update();
  return popup.show();
}

/**
 * Popup to ask user whether to save as new board or update existing board
 * @param boardName The name of the existing saved board
 * @returns Promise<"new" | "update" | "cancel">
 */
export function ppSaveChoice(boardName: string): Promise<string> {
  const popup = new Popup();
  const mainFrame = getUow<MainFrame>("mainFrame");
  mainFrame.children.push(popup);
  mainFrame.update();

  popup.title = "Save Board";
  popup.height = 250;
  popup.width = 450;
  popup.content = <div className="popup-info-content">
    <span className="popup-message" style={{ marginBottom: '10px', display: 'block' }}>
      This board was loaded from a saved board:
    </span>
    <span className="popup-message" style={{ fontWeight: 'bold', color: '#4CAF50', marginBottom: '15px', display: 'block' }}>
      "{boardName}"
    </span>
    <span className="popup-message">
      Would you like to update the existing board or save as a new one?
    </span>
  </div>;
  popup.actions = [
    <div className="popup-action-button" onClick={() => {
      popup.hide();
      popup.currentresolver("update");
    }}>{"Update Existing"}</div>,
    <div className="popup-action-button" onClick={() => {
      popup.hide();
      popup.currentresolver("new");
    }}>{"Save as New"}</div>,
    <div className="popup-action-button popup-action-cancel" onClick={() => {
      popup.hide();
      popup.currentresolver("cancel");
    }}>{"Cancel"}</div>,
  ];
  popup.update();
  return popup.show();
}

export function ppPartialWrapDirection(wrapDistance: string): Promise<string> {
  return new Promise((resolve) => {
    // Create simple inline prompt near mouse or center
    const overlayId = 'partial-wrap-direction-overlay';
    
    // Remove existing overlay if any
    const existing = document.getElementById(overlayId);
    if (existing) {
      existing.remove();
    }
    
    // Create minimal overlay
    const overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-bg-overlay);
      z-index: 10000;
    `;
    
    // Create compact dialog box
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      background: var(--color-bg-main);
      border: 1px solid var(--color-border-primary);
      border-radius: 4px;
      padding: 20px;
      min-width: 300px;
      box-shadow: var(--shadow-lg);
    `;
    
    // Title
    const title = document.createElement('div');
    title.textContent = 'Partial Wrap Direction';
    title.style.cssText = `
      font-size: 14px;
      font-weight: 600;
      color: var(--color-text-primary);
      margin-bottom: 15px;
      text-align: center;
    `;
    
    // Buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
    `;
    
    // Create button
    const createButton = (type: 'outward' | 'inward') => {
      const btn = document.createElement('button');
      const isOutward = type === 'outward';
      
      btn.innerHTML = `
        <div style="font-size: 20px; margin-bottom: 4px;">${isOutward ? '↗' : '↙'}</div>
        <div style="font-size: 12px; font-weight: 600;">${isOutward ? 'Expand' : 'Contract'}</div>
        <div style="font-size: 11px; margin-top: 2px;">${isOutward ? '+' : '-'}${wrapDistance}</div>
      `;
      
      btn.style.cssText = `
        flex: 1;
        background: var(--color-bg-tertiary);
        border: 2px solid var(--color-border-light);
        border-radius: 4px;
        padding: 12px 8px;
        cursor: pointer;
        color: var(--color-text-primary);
        transition: all 0.15s ease;
      `;
      
      btn.addEventListener('mouseenter', () => {
        btn.style.borderColor = 'var(--color-primary)';
        btn.style.background = 'var(--color-bg-hover)';
      });
      
      btn.addEventListener('mouseleave', () => {
        btn.style.borderColor = 'var(--color-border-light)';
        btn.style.background = 'var(--color-bg-tertiary)';
      });
      
      btn.addEventListener('click', () => {
        overlay.remove();
        resolve(type);
      });
      
      return btn;
    };
    
    const outwardBtn = createButton('outward');
    const inwardBtn = createButton('inward');
    
    buttonsContainer.appendChild(outwardBtn);
    buttonsContainer.appendChild(inwardBtn);
    
    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
      width: 100%;
      background: transparent;
      border: 1px solid var(--color-border-light);
      border-radius: 4px;
      padding: 8px;
      cursor: pointer;
      color: var(--color-text-primary);
      font-size: 12px;
      transition: all 0.15s ease;
    `;
    
    cancelBtn.addEventListener('mouseenter', () => {
      cancelBtn.style.borderColor = 'var(--color-primary)';
      cancelBtn.style.color = 'var(--color-primary)';
    });
    
    cancelBtn.addEventListener('mouseleave', () => {
      cancelBtn.style.borderColor = 'var(--color-border-light)';
      cancelBtn.style.color = 'var(--color-text-primary)';
    });
    
    cancelBtn.addEventListener('click', () => {
      overlay.remove();
      resolve('cancel');
    });
    
    // Assemble
    dialog.appendChild(title);
    dialog.appendChild(buttonsContainer);
    dialog.appendChild(cancelBtn);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    // Close on ESC key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        overlay.remove();
        resolve('cancel');
        document.removeEventListener('keydown', handleKeyDown);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
  });
}
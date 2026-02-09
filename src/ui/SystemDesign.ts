import { SystemDesign } from "@ekkojs/web-controls";
import '../../src/utils/css/themes.css'
import '../../src/utils/css/system.css'
import '../../src/utils/css/specific-popups.css'




export const systemDesign = new SystemDesign("mm", {
  white: "#FFFFFF",
  black: "#333333",
  primary: "#25A9E0",
  secondary: "#1a8cc4",
  accent: "#CDE7F2",
  error: "#D32F2F",
  background: "#F5F5F5"
}, {
  "bar-background": {
    color: "var(--mm-ref-black)"
  },
  "icon-background": {
    background: "linear-gradient(45deg, var(--mm-ref-primary), var(--mm-ref-secondary))"
  }
}, {
  "left-bar": {
    bg: "var(--mm-sys-bar-background-color)",
    size: "clamp(80px, 8vw, 127px)"
  },
  "top-bar": {
    bg: "var(--mm-sys-bar-background-color)",
    size: "clamp(1.8rem, 4vh, 2.5rem)",
    "expanded-size": "clamp(2.5rem, 5vh, 3.5rem)"
  },
  ButtonBar: {
    position: "relative",
    width: "clamp(80px, 10vw, 134px)",
    height: "clamp(60px, 12vh, 108px)",
    text: {
      color: "var(--mm-ref-white)",
      fontFamily: "'Montserrat', -apple-system, sans-serif",
      fontSize: "clamp(0.75rem, 1.5vw, 0.9rem)"
    },
    selected: {
      bg: "linear-gradient(45deg, var(--mm-ref-secondary), var(--mm-ref-primary))",
      borderRadius: "12px",
      boxShadow: "0 2px 6px rgba(37, 169, 224, 0.3)"
    }
  }
});
systemDesign.addCssSheet("main", `
  .main-panel.no-top-bar {
    top: 0px;
  }
`);

systemDesign.targetShadowRoot = false;
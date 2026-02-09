/** @jsx h */
/** @jsxFrag f */
import {
  BaseComponent,
  TRenderHandler,
  h, f
} from "@ekkojs/web-controls";
import { sFetch } from "../../../uof/Globals";
import { Label } from "../search/cmp/Label";
import { _evtBus, _evts } from "../../../core/EventBus";
import { evts } from "@ekkojs/web-controls/dist/cjs/Events/EventBus";
import { ButtonBar } from "../buttons/ButtonBar";
import { getUow } from "../../../uof/UnitOfWork";
import { ppConfirm, ppInfo } from "../popup/Popup";
import { LoginScreen } from "../../LoginScreen";
import { MainFrame } from "../../layout/Frame";
import { ThemeToggle } from "../ThemeToggle/ThemeToggle";
import '../../../utils/css/profile.css'

export class Profile extends BaseComponent {
  firstName  : Label;
  lastName   : Label;
  email      : Label;
  phone      : Label;
  company    : Label;
  vat        : Label;
  credit     : Label;
  region     : Label;
  country    : Label;
  postalCode : Label;
  themeToggle: ThemeToggle;
  user: any;


  constructor() {
    super("Profile");
    this.registerTemplate("default", _default);

    this.addEventListener("mount", async () => {
      try {
        const user = await sFetch<any>("user/profile", "get", null, true);
        if (!user) throw new Error("Failed to fetch user profile");

        this.user = user;
        this.firstName = new Label();
        this.firstName.text = user.first_name || "N/A";
        this.firstName.title = "First Name";

        this.lastName = new Label();
        this.lastName.text = user.last_name || "N/A";
        this.lastName.title = "Last Name";

        this.email = new Label();
        this.email.text = user.email || "N/A";
        this.email.title = "Email";

        this.phone = new Label();
        this.phone.text = user.phone_number ? `(${user.country_code || ""})${user.phone_number}` : "N/A";
        this.phone.title = "Phone";

        this.company = new Label();
        this.company.text = user.company || "N/A";
        this.company.title = "Company";

        this.vat = new Label();
        this.vat.text = user.vat || "N/A";
        this.vat.title = "VAT";

        // Fetch credit from user/settings
        const userSettings = await sFetch<any>("user/settings", "get", null, true);
        if (userSettings && userSettings.credit) {
          this.credit = new Label();
          const creditAmount = userSettings.credit.availableCredit || 0;
          const unitOfMeasure = userSettings.update_preference_request?.unit_of_measure || 2;
          
          // Convert sqm to sqft if user prefers imperial units (unit_of_measure = 3)
          if (unitOfMeasure === 3) {
            const creditInSqft = creditAmount * 10.7639; // 1 sqm = 10.7639 sqft
            this.credit.text = `${creditInSqft.toFixed(2)} SQFT`;
          } else {
            this.credit.text = `${creditAmount.toFixed(2)} SQM`;
          }
          this.credit.title = "Available Credit";
        } else {
          this.credit = new Label();
          this.credit.text = "0 SQM";
          this.credit.title = "Available Credit";
        }

        // Initialize theme toggle
        this.themeToggle = new ThemeToggle();

        this.update();
      } catch (err) {
        console.error("Profile mount error:", err);
        await ppInfo("Error", "Failed to load user profile. Please try again.");
      }
    });
  }

  async handleLogout() {
    try {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      localStorage.removeItem("loginAttempts");
      localStorage.removeItem("lastAttempt");

      const mainFrame = getUow<MainFrame>("mainFrame");
      const loginScreen = new LoginScreen();
      mainFrame.children = [loginScreen];
      mainFrame.update();
    } catch (err) {
      console.error("Logout error:", err);
      await ppInfo("Error", "Failed to log out. Please try again.");
    }
  }
}

const _default: TRenderHandler = ($this: Profile) => {
  return (
    <div class="profile-container">
       <div class="theme-toggle-container">
           
           {$this?.themeToggle?.vdom ?? ""}
         </div>
      <div class="profile-content" role="region" aria-labelledby="profile-title">
   <div class="profile-greeting">
          <div class="greeting-text">Hi, {$this.user?.first_name || "User"}</div>
         
          <div class="subscription-badge">{$this.user?.subscription_plan || "N/A"} Plan</div>
        </div>
        <div id="profile-title" class="profile-subtitle">Your Account Details</div>
        <div class="profile-grid">
          <div class="profile-field">{$this?.firstName?.vdom ?? "N/A"}</div>
          <div class="profile-field">{$this?.lastName?.vdom ?? "N/A"}</div>
          <div class="profile-field">{$this?.email?.vdom ?? "N/A"}</div>
          <div class="profile-field">{$this?.phone?.vdom ?? "N/A"}</div>
          <div class="profile-field">{$this?.company?.vdom ?? "N/A"}</div>
          <div class="profile-field">{$this?.vat?.vdom ?? "N/A"}</div>
          <div class="profile-field credit-with-theme">
            {$this?.credit?.vdom ?? "N/A"}
           
          </div>
          
        </div>
        <div class="profile-actions">
          <button
            class="logout-button"
            aria-label="Logout"
            onClick={() => $this.handleLogout()}
          >
            <svg viewBox="0 0 24 24" class="logout-icon" aria-hidden="true">
              <path fill="currentColor" d="M16 17v-2H9V9h7V7l5 5-5 5zm-8 0H4V7h4v10z" />
            </svg>
            LOGOUT
          </button>
        </div>
        <div class="profile-footer">
          <div class="social-links">
            <div class="social-link-item">
              <a
     
                aria-label="Watch video tutorials on YouTube"
                onClick={() => window.electronAPI.openExternal('https://www.youtube.com/@matmaksoftware')}
              >
                <svg viewBox="0 0 24 24" class="social-icon" aria-hidden="true">
                  <path fill="currentColor" d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33zM9.75 15.02l5.75-3.27-5.75-3.27v6.54z" />
                </svg>
                Video Tutorial
              </a>
            </div>
            <div class="social-link-item">
              <a
                
                aria-label="Chat with us on WhatsApp"
                onClick={() => window.electronAPI.openExternal('https://api.whatsapp.com/send/?phone=971568854416&text=Hello%21+I%E2%80%99m+interested+in+learning+more+about+MATMAK+Software.+Could+you+share+details+about+the+available+plans%2C+features%2C+and+pricing%3F+Looking+forward+to+your+response%21&type=phone_number&app_absent=0')}
              >
                <svg viewBox="0 0 24 24" class="social-icon" aria-hidden="true">
                  <path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.134.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.074-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                </svg>
                WhatsApp
              </a>
            </div>
            <div class="social-link-item">
              <a
             
                aria-label="Follow us on Instagram"
                onClick={() => window.electronAPI.openExternal('https://www.instagram.com/matmaksoftware/')}
              >
                <svg viewBox="0 0 24 24" class="social-icon" aria-hidden="true">
                  <path fill="currentColor" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.948-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
                Instagram
              </a>
            </div>
          </div>
          <div class="footer-text">
            Powered by <a
              href="https://matmaksolutions.com"
              onClick={() => window.electronAPI.openExternal('https://matmaksolutions.com')}
            >MATMAK SOLUTIONS</a> © {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </div>
  );
};
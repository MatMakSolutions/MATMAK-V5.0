/** @jsx h */
/** @jsxFrag f */
import { BaseComponent, TRenderHandler, h, f } from '@ekkojs/web-controls';
import { MainFrame } from '../ui/layout/Frame';
import { getUow } from '../uof/UnitOfWork';
import { sFetch } from '../uof/Globals';
import { TUserresponse, TSubscriptionResponse, TUserSettingsResponse } from '../uof/UserType';
import { Profile } from '../ui/controls/buttons/Profile';
import { _evtBus, _evts } from '../core/EventBus';
import { liveConfig } from '../core/LiveConfig';
import { ppInfo, ppSoftwareUpdate } from '../ui/controls/popup/Popup';
import { leftBar, topBar, mainPanel } from '../rendererUpdate';
import '../../src/utils/css/login.css';

interface ElectronAPI {
  storeCredentials: (creds: { email: string; password: string }) => Promise<void>;
  getCredentials: () => Promise<{ email: string; password: string } | null>;
  clearCredentials: () => Promise<void>;
  checkForUpdate: (token: string) => Promise<boolean>;
  forceMaximize: () => void;
  close: () => void;
  openExternal: (url: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    minimize: () => void;
    maximize: () => void;
    restore: () => void;
    forceMaximize: () => void;
    checkForUpdate: (token: string) => Promise<boolean>;
    openExternal: (url: string) => Promise<void>;
  }
}

interface CarKit {
  pattern_id: string;
  name: string;
  bitmap_image: string;
  car_name: string;
  created_date: string;
  status: string | null;
}

interface BlogPost {
  id: string;
  title: string;
  content: string;
  thumbnail_image: string;
  date_created: string;
}

interface HomeResponse {
  message: string;
  payload: {
    patterns: CarKit[];
    blogs: BlogPost[];
  };
  statusCode: number;
}

export class LoginScreen extends BaseComponent {
  email: string = '';
  password: string = '';
  rememberMe: boolean = false;
  showPassword: boolean = false;
  loading: boolean = false;
  error: string = '';
  loginAttempts: number = parseInt(localStorage.getItem('loginAttempts') || '0');
  lastAttempt: number = parseInt(localStorage.getItem('lastAttempt') || '0');
  activeInputId: string | null = null;
  isReady: boolean = false;
  renderKey: string = 'initial';
  carKits: CarKit[] = [];
  latestBlogs: BlogPost[] = [];
  currentCarIndex: number = 0;

  constructor() {
    super('LoginScreen');
    this.registerTemplate('default', defaultTemplate);
    this.loadCredentials();
    this.fetchHomeData();
  }

  async fetchHomeData() {
    try {
      const response = await sFetch<HomeResponse>('pattern/home?isClient=false', 'GET', null, true);
      if (response.statusCode === 200) {
        this.carKits = response.payload.patterns
          .sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())
          .slice(0, 20);
        this.latestBlogs = response.payload.blogs
          .sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime())
          .slice(0, 2);
        this.renderKey = Date.now().toString();
        this.update();
      }
    } catch (err) {
      console.error('fetchHomeData: Error:', err);
    }
  }

  handleCarScroll(direction: 'prev' | 'next') {
    if (direction === 'next' && this.currentCarIndex < this.carKits.length - 1) {
      this.currentCarIndex++;
    } else if (direction === 'prev' && this.currentCarIndex > 0) {
      this.currentCarIndex--;
    }
    this.renderKey = Date.now().toString();
    this.update();
  }

  async loadCredentials() {
    try {
      const rememberMeStored = localStorage.getItem('rememberMe') === 'true';
      this.rememberMe = rememberMeStored;
      if (rememberMeStored) {
        const creds = await window.electronAPI.getCredentials();
        if (creds && creds.email && creds.password) {
          this.email = creds.email;
          this.password = creds.password;
        } else {
          this.rememberMe = false;
          localStorage.setItem('rememberMe', 'false');
        }
      }
      this.isReady = true;
      this.renderKey = Date.now().toString();
      this.update();
      setTimeout(() => {
        const emailInput = document.getElementById('email') as HTMLInputElement;
        const passwordInput = document.getElementById('password') as HTMLInputElement;
        if (emailInput && emailInput.value !== this.email) {
          emailInput.value = this.email;
        }
        if (passwordInput && passwordInput.value !== this.password) {
          passwordInput.value = this.password;
        }
        this.update();
      }, 0);
    } catch (err) {
      console.error('loadCredentials: Error:', err);
      this.rememberMe = false;
      localStorage.setItem('rememberMe', 'false');
      this.isReady = true;
      this.renderKey = Date.now().toString();
      this.update();
    }
  }

  handleRememberMeChange(checked: boolean) {
    if (checked && (!this.email || !this.password)) {
      return;
    }
    this.rememberMe = checked;
    localStorage.setItem('rememberMe', checked.toString());
    if (!checked) {
      this.email = '';
      this.password = '';
      this.showPassword = false;
      window.electronAPI.clearCredentials().catch(err => console.error('handleRememberMeChange: Failed to clear credentials:', err));
    }
    this.renderKey = Date.now().toString();
    this.update();
  }

  async handleLogin() {
    if (this.loginAttempts >= 17 && Date.now() - this.lastAttempt < 15 * 60 * 1000) {
      this.error = 'Too many failed attempts. Try again later.';
      this.update();
      return;
    }

    if (!this.email || !this.email.includes('@')) {
      this.error = 'Please enter a valid email';
      this.update();
      return;
    }
    if (!this.password) {
      this.error = 'Please enter a password';
      this.update();
      return;
    }

    this.loading = true;
    this.error = '';
    this.update();

    try {

      if (!navigator.onLine) {
        throw new Error('No internet connection');
      }

      const user = await sFetch<TUserresponse>('authentication/signin/client', 'POST', {
        email: this.email,
        password: this.password,
      }, true);

      if (!user || user.statusCode !== 200) {
        throw new Error('Invalid credentials');
      }

      localStorage.setItem('token', user.payload.token);
      localStorage.setItem('user', user.payload.user_id);

      if (this.rememberMe) {
        await window.electronAPI.storeCredentials({ email: this.email, password: this.password });
        localStorage.setItem('rememberMe', 'true');
      } else {
        await window.electronAPI.clearCredentials();
        localStorage.setItem('rememberMe', 'false');
      }

      const subscription = await sFetch<TSubscriptionResponse>('account/subscriptionvalidity', 'POST', {
        value: '000001.3657qvfmrck',
        hash: -542307620,
      });

      if (subscription.statusCode !== 200) {
        throw new Error('No valid subscription');
      }

      const userSettings = await sFetch<TUserSettingsResponse>('user/settings', 'GET', null);

      liveConfig.unitOfMeasure = userSettings.update_preference_request.unit_of_measure;

      // Store user roll data for cost calculations
      (window as any).userRollData = userSettings.update_preference_request.user_roll_types;
      (window as any).userCurrency = userSettings.update_preference_request.currency;
      (window as any).selectedRollIndex = 0; // Default to first roll

    /*  try {
        if (await window.checkForUpdate(user.payload.token)) {
          await ppSoftwareUpdate();
        }
      } catch (updateCheckError) {
        console.warn('Update check failed:', updateCheckError);
        // Continue with login even if update check fails
      }*/

      this.loginAttempts = 0;
      localStorage.setItem('loginAttempts', '0');
      localStorage.setItem('lastAttempt', '0');

      const btnProfile = getUow<Profile>('profile');
      _evtBus.emit(_evts.ButtonBar.Click, { id: btnProfile.guid, name: 'profile' });
      window.forceMaximize();

      const mainFrame = getUow<MainFrame>('mainFrame');
      mainFrame.children = [leftBar, topBar, mainPanel];
      mainFrame.update();
    } catch (ex: any) {
      console.error('handleLogin: Error:', ex.message, ex.stack);
      let errorMessage = 'Failed to connect to server';
      if (ex.message === 'Invalid credentials') {
        errorMessage = 'Invalid email or password';
      } else if (ex.message === 'No valid subscription') {
        errorMessage = 'No valid subscription found';
      } else if (ex.message === 'No internet connection') {
        errorMessage = 'No internet connection. Please check your network.';
      } else if (ex.message.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      }
      this.error = errorMessage;
      this.loginAttempts++;
      this.lastAttempt = Date.now();
      localStorage.setItem('loginAttempts', this.loginAttempts.toString());
      localStorage.setItem('lastAttempt', this.lastAttempt.toString());
      await ppInfo('Error', this.error);
    } finally {
      this.loading = false;
      this.renderKey = Date.now().toString();
      this.update();
    }
  }

  handleForgotPassword() {
    ppInfo('Password Recovery', 'Contact support at support@matmaksolutions.com');
  }

  restoreFocus() {
    if (this.activeInputId) {
      const input = document.getElementById(this.activeInputId);
      if (input) {
        input.focus();
      }
    }
  }

  update() {
    super.update();
    setTimeout(() => {
      this.restoreFocus();
      const emailInput = document.getElementById('email') as HTMLInputElement;
      const passwordInput = document.getElementById('password') as HTMLInputElement;
    }, 0);
  }
}

const defaultTemplate: TRenderHandler = ($this: LoginScreen) => {
  return (
    <div class="main-containerl">
      <div class="container-wrapper">
        <div class="login-container">
          <div class="login-card">
            <div class="login-header">
              <img src="./assets/logo.png" alt="MATMAK SOLUTIONS Logo" class="login-logo" />
              <h1>Unleash Precision with MATMAK Precut Solution</h1>
            </div>
            <div class="error-message" style={{ display: $this.error ? 'block' : 'none' }}>
              {$this.error}
            </div>
            <div class="input-group" key={$this.renderKey}>
              <label for="email">Email Address</label>
              <input
                type="text"
                id="email"
                value={$this.email}
                onKeyUp={(e: any) => {
                  $this.activeInputId = 'email';
                  $this.email = e.target.value;
                  $this.update();
             
                }}
                onKeyPress={(e: any) => e.key === 'Enter' && $this.handleLogin()}
                onFocus={(e: any) => {
                  $this.activeInputId = 'email';
             
                }}
                aria-label="Email address"
                disabled={$this.loading}
              />
            </div>
            <div class="input-group" key={$this.renderKey + '-password'}>
              <label for="password">Password</label>
              <div class="password-container">
                <input
                  type={$this.showPassword ? 'text' : 'password'}
                  id="password"
                  value={$this.password}
                  onKeyUp={(e: any) => {
                    $this.activeInputId = 'password';
                    $this.password = e.target.value;
                    $this.update();
              
                  }}
                  onKeyPress={(e: any) => e.key === 'Enter' && $this.handleLogin()}
                  onFocus={(e: any) => {
                    $this.activeInputId = 'password';
                 
                  }}
                  aria-label="Password"
                  disabled={$this.loading}
                />
                <span
                  class="toggle-password"
                  disabled={$this.rememberMe || $this.loading}
                  onClick={() => {
                    if (!$this.rememberMe && !$this.loading) {
                      $this.showPassword = !$this.showPassword;
                      $this.update();
               
                    }
                  }}
                >
                  {$this.showPassword ? '🙈' : '👁️'}
                </span>
              </div>
            </div>
            <div class="options">
              <label>
                <input
                  type="checkbox"
                  checked={$this.rememberMe}
                  onChange={(e: any) => $this.handleRememberMeChange(e.target.checked)}
                  disabled={$this.loading || (!$this.rememberMe && (!$this.email || !$this.password))}
                />
                Remember Me
              </label>
              <a href="#" onClick={() => window.electronAPI.openExternal('https://www.matmaksolutions.com/?rta=forgotPassword')}>
                Forgot Password?
              </a>
            </div>
            <div class="actions">
              <button
                onClick={() => $this.handleLogin()}
                disabled={$this.loading}
                aria-label="Sign in"
              >
                {$this.loading ? 'Signing In...' : 'Sign In'}
                {$this.loading && <span class="spinner"></span>}
              </button>
              <button
                onClick={() => window.close()}
                disabled={$this.loading}
                aria-label="Close application"
              >
                Close
              </button>
            </div>
          </div>
          <div class="qr-code">
            <div>
              <svg viewBox="0 0 448 512" aria-label="Instagram Icon">
                <path d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z" />
              </svg>
              <img src="./assets/qr-instagram.png" alt="Instagram QR Code" />
              <div class="social-links">
                <a href="#" onClick={() => window.electronAPI.openExternal('https://www.instagram.com/matmaksoftware/')}>
                  Follow us
                </a>
              </div>
            </div>
            <div>
              <svg viewBox="0 0 448 512" aria-label="WhatsApp Icon">
                <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
              </svg>
              <img src="./assets/qr-whatsapp.png" alt="WhatsApp QR Code" />
              <div class="social-links">
                <a href="#" onClick={() => window.electronAPI.openExternal('https://api.whatsapp.com/send/?phone=971568854416&text=Hello%21+I%E2%80%99m+interested+in+learning+more+about+MATMAK+Software.+Could+you+share+details+about+the+available+plans%2C+features%2C+and+pricing%3F+Looking+forward+to+your+response%21&type=phone_number&app_absent=0')}>
                  Chat with us
                </a>
              </div>
            </div>
          </div>
        </div>
        <div class="content-container">
          <div class="content-card">
            <div class="content-header">
              <h2>What's New at MATMAK</h2>
              <div class="content-tagline">Explore Our Latest Updates</div>
            </div>
            <div class="car-kits-section">
              <h3>Latest Car Kits</h3>
              <div class="car-kits-carousel">
                <button
                  class="carousel-arrow prev"
                  onClick={() => $this.handleCarScroll('prev')}
                  disabled={$this.currentCarIndex === 0}
                  aria-label="Previous car kit"
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6z" />
                  </svg>
                </button>
                <div class="carousel-content">
                  {$this.carKits.length > 0 ? (
                    <div class="car-kit-item" key={$this.carKits[$this.currentCarIndex].pattern_id}>
                      <img
                        src={$this.carKits[$this.currentCarIndex].bitmap_image}
                        alt={$this.carKits[$this.currentCarIndex].name}
                        class="pattern-image1"
                      />
                      <div class="car-details">
                        <h4>{$this.carKits[$this.currentCarIndex].car_name}</h4>
                        <p><strong>Kit:</strong> {$this.carKits[$this.currentCarIndex].name}</p>
                      </div>
                    </div>
                  ) : (
                    <p>No car kits available</p>
                  )}
                </div>
                <button
                  class="carousel-arrow next"
                  onClick={() => $this.handleCarScroll('next')}
                  disabled={$this.currentCarIndex === $this.carKits.length - 1}
                  aria-label="Next car kit"
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M8.59 16.59L13.17 12l-4.58-4.59L10 6l6 6-6 6z" />
                  </svg>
                </button>
              </div>
            </div>
            <div class="blog-section">
              <h3>News and Updates</h3>
              {$this.latestBlogs.length > 0 ? (
                $this.latestBlogs.slice(0, 2).map(blog => (
                  <div class="blog-item" key={blog.id}>
                    <img
                      src={blog.thumbnail_image}
                      alt={blog.title}
                      class="blog-image"
                    />
                    <div class="blog-details">
                      <h4>{blog.title}</h4>
                      <p class="blog-date">{new Date(blog.date_created).toLocaleDateString()}</p>
                      <a
                        href="#"
                        onClick={() => window.electronAPI.openExternal('https://matmaksolutions.com/blog')}
                        class="read-more"
                      >
                        Read More
                      </a>
                    </div>
                  </div>
                ))
              ) : (
                <p>No blog posts available</p>
              )}
            </div>
          </div>
        </div>
      </div>
      <footer class="main-footer">
        <div class="footer-content">
          <div class="footer-links">
            <span>Powered by <a href="#" onClick={() => window.electronAPI.openExternal('https://matmaksolutions.com')}>MATMAK PRECUT SOLUTIONS</a> © {new Date().getFullYear()}</span>
            <span class="footer-divider">|</span>
            <a href="#" onClick={() => window.electronAPI.openExternal('https://www.matmaksolutions.com/About/PrivacyPolicy')}>
              Privacy Policy
            </a>
            <span class="footer-divider">|</span>
            <a href="#" onClick={() => window.electronAPI.openExternal('https://www.matmaksolutions.com/About/TermsAndConditions')}>
              Terms & Conditions
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
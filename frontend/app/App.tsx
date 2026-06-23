import { useCallback, useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  ArrowRight,
  Help,
  Launch,
  Security,
  View,
  ViewOff,
} from '@carbon/icons-react';
import { login, logout, signup } from '../services/api';
import PortalApp from '../portal/PortalApp';
import '../styles/auth.scss';

type AuthPage = 'login' | 'signup';

const initialSignup = {
  fullName: '',
  email: '',
  dateOfBirth: '',
  patientId: '',
  password: '',
  acceptedTerms: false,
};

function AuthHeader({
  showLanguage = false,
  showHelpIcon = false,
}: {
  showLanguage?: boolean;
  showHelpIcon?: boolean;
}) {
  return (
    <header className="auth-header">
      <div className="auth-brand">
        <strong>OpenMRS O3</strong>
        <span />
        <p>Patient Portal</p>
      </div>
      <nav aria-label="Authentication support">
        <a href="#support">{showHelpIcon && <Help size={18} />}Support</a>
        {showLanguage && <a href="#language">Language</a>}
      </nav>
    </header>
  );
}

function AuthFooter() {
  return (
    <footer className="auth-footer">
      <div>
        <span>&copy; 2024 OpenMRS Inc.</span>
        <i />
        <a href="#accessibility">Accessibility</a>
        <a href="#compliance">Compliance</a>
      </div>
      <p><b />Systems Operational</p>
    </footer>
  );
}

function PasswordField({
  id,
  label,
  value,
  placeholder,
  onChange,
  withForgotPassword = false,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  withForgotPassword?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="auth-field" htmlFor={id}>
      <span>
        {label}
        {withForgotPassword && <a href="#forgot-password">Forgot password?</a>}
      </span>
      <div className="auth-password">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button type="button" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)}>
          {visible ? <ViewOff size={20} /> : <View size={20} />}
        </button>
      </div>
    </label>
  );
}

function LoginPage({ onAuthenticated }: { onAuthenticated: (token: string) => void }) {
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const response = await login(usernameOrEmail, password);
      onAuthenticated(response.token);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not sign in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page auth-page--login">
      <AuthHeader showLanguage />
      <section className="login-content">
        <div className="login-intro">
          <h1>Sign In</h1>
          <p>Log in to manage your health records and appointments.</p>
        </div>
        <form className="auth-card login-card" onSubmit={handleSubmit}>
          <label className="auth-field" htmlFor="login-identity">
            <span>Username or Email</span>
            <input
              id="login-identity"
              type="text"
              placeholder="Enter your ID or email"
              value={usernameOrEmail}
              onChange={(event) => setUsernameOrEmail(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <PasswordField
            id="login-password"
            label="Password"
            value={password}
            onChange={setPassword}
            withForgotPassword
          />
          <label className="auth-check" htmlFor="remember-me">
            <input id="remember-me" type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
            <span>Remember me</span>
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button className="auth-primary" type="submit" disabled={submitting}>
            <strong>{submitting ? 'Signing In...' : 'Sign In'}</strong>
            <ArrowRight size={24} />
          </button>
          <div className="auth-divider"><i /><span>OR</span><i /></div>
          <p className="auth-switch">New to O3? <a href="#signup">Create an account <Launch size={15} /></a></p>
        </form>
        <aside className="security-note">
          <Security size={20} />
          <p>This is a secure clinical portal. Unauthorized access is strictly prohibited and subject to monitoring. By signing in, you agree to our <strong>Terms of Service</strong> and <strong>Privacy Policy</strong>.</p>
        </aside>
      </section>
      <AuthFooter />
    </main>
  );
}

function PasswordRule({ satisfied, children }: { satisfied: boolean; children: ReactNode }) {
  return <span className={satisfied ? 'satisfied' : ''}><i />{children}</span>;
}

function SignupPage({ onAuthenticated }: { onAuthenticated: (token: string) => void }) {
  const [form, setForm] = useState(initialSignup);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.acceptedTerms) {
      setError('Please accept the terms of service and privacy policy.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const response = await signup(form);
      onAuthenticated(response.token);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not create account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page auth-page--signup">
      <AuthHeader showHelpIcon />
      <div className="signup-layout">
        <aside className="signup-story">
          <div>
            <h2>Empowering Your Health Journey</h2>
            <p>Join the O3 Patient Portal to access medical records, manage appointments, and communicate with your care team in a secure, clinical environment.</p>
            <strong>O3 Model</strong>
            <span>Next-Gen Informatics</span>
          </div>
          <img src="/assets/clinical-workstation.png" alt="Clinical informatics workstation" />
        </aside>
        <section className="signup-content">
          <form className="auth-card signup-card" onSubmit={handleSubmit}>
            <div className="signup-intro">
              <h1>Create Patient Account</h1>
              <p>Enter your clinical details to register.</p>
            </div>
            <label className="auth-field" htmlFor="signup-name">
              <span>Full Name (as per ID)</span>
              <input id="signup-name" placeholder="e.g. Johnathan Doe" value={form.fullName} onChange={(event) => update('fullName', event.target.value)} required />
            </label>
            <div className="auth-field-row">
              <label className="auth-field" htmlFor="signup-email">
                <span>Email Address</span>
                <input id="signup-email" type="email" placeholder="name@example.com" value={form.email} onChange={(event) => update('email', event.target.value)} required />
              </label>
              <label className="auth-field" htmlFor="signup-dob">
                <span>Date of Birth</span>
                <input
                  id="signup-dob"
                  type="date"
                  value={form.dateOfBirth}
                  onInput={(event) => update('dateOfBirth', event.currentTarget.value)}
                  onChange={(event) => update('dateOfBirth', event.target.value)}
                  required
                />
              </label>
            </div>
            <label className="auth-field" htmlFor="signup-patient-id">
              <span>Patient ID Number <em>Optional</em></span>
              <input id="signup-patient-id" placeholder="XX-XXXX-XXX" value={form.patientId} onChange={(event) => update('patientId', event.target.value)} />
              <small>Used for automatic record synchronization.</small>
            </label>
            <PasswordField id="signup-password" label="Create Password" value={form.password} onChange={(value) => update('password', value)} />
            <div className="password-rules">
              <PasswordRule satisfied={form.password.length >= 8}>8+ Characters</PasswordRule>
              <PasswordRule satisfied={/[A-Z]/.test(form.password)}>Uppercase Letter</PasswordRule>
              <PasswordRule satisfied={/\d/.test(form.password)}>One Number</PasswordRule>
              <PasswordRule satisfied={/[^A-Za-z0-9]/.test(form.password)}>Special Char</PasswordRule>
            </div>
            <hr />
            <label className="auth-check auth-check--terms" htmlFor="signup-terms">
              <input id="signup-terms" type="checkbox" checked={form.acceptedTerms} onChange={(event) => update('acceptedTerms', event.target.checked)} />
              <span>I agree to the <a href="#terms">Terms of Service</a> and acknowledge the <a href="#privacy">Patient Privacy Policy</a>.</span>
            </label>
            {error && <p className="auth-error">{error}</p>}
            <button className="auth-primary auth-primary--center" type="submit" disabled={submitting}>
              <strong>{submitting ? 'Creating Account...' : 'Create Account'}</strong>
              <ArrowRight size={24} />
            </button>
            <p className="auth-switch">Already have a clinical account? <a href="#login">Log In</a></p>
          </form>
        </section>
      </div>
    </main>
  );
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('emr-auth-token') || '');
  const [authPage, setAuthPage] = useState<AuthPage>(() => (location.hash === '#signup' ? 'signup' : 'login'));

  useEffect(() => {
    const handleHashChange = () => {
      if (location.hash === '#signup') setAuthPage('signup');
      if (location.hash === '#login') setAuthPage('login');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleAuthenticated = useCallback((nextToken: string) => {
    localStorage.setItem('emr-auth-token', nextToken);
    setToken(nextToken);
    location.hash = '#dashboard';
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch {
      // A stale session is already signed out server-side.
    } finally {
      localStorage.removeItem('emr-auth-token');
      setToken('');
      location.hash = '#login';
    }
  }, []);

  if (token) return <PortalApp onLogout={handleLogout} />;
  if (authPage === 'signup') return <SignupPage onAuthenticated={handleAuthenticated} />;
  return <LoginPage onAuthenticated={handleAuthenticated} />;
}

export default App;

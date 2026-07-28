import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  ArrowRight,
  Help,
  Launch,
  Security,
  View,
  ViewOff,
} from '@carbon/icons-react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  ApiError,
  UNAUTHORIZED_EVENT,
  changePassword,
  clearClientSession,
  clearLegacyAuthToken,
  getCurrentSession,
  login,
  logout,
  requestPasswordReset,
  resetPassword,
  signup,
} from '../../shared/api/api';
import type { AuthResponse } from '../../shared/api/api';
import '../../shared/styles/auth.scss';

const PortalApp = lazy(() => import('../portal').then((module) => ({ default: module.PortalApp })));

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
        <Link to="/support">{showHelpIcon && <Help size={18} />}Support</Link>
        {showLanguage && <span aria-label="Portal language">English (US)</span>}
      </nav>
    </header>
  );
}

function AuthFooter() {
  return (
    <footer className="auth-footer">
      <div>
        <span>&copy; {new Date().getFullYear()} OpenMRS Inc.</span>
        <i />
        <Link to="/accessibility">Accessibility</Link>
        <Link to="/privacy">Privacy Review</Link>
      </div>
      <p><b />Local portal environment</p>
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
        {withForgotPassword && <Link to="/forgot-password">Forgot password?</Link>}
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

function LoginPage({ onAuthenticated }: { onAuthenticated: (result: AuthResponse) => void }) {
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
      const result = await login(usernameOrEmail, password, rememberMe);
      onAuthenticated(result);
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
          <p className="auth-switch">New to O3? <Link to="/signup">Create an account <Launch size={15} /></Link></p>
        </form>
        <aside className="security-note">
          <Security size={20} />
          <p>This is a demo patient portal prototype. Do not use real patient data without organizational privacy, security, and compliance review. By signing in, you agree to our <strong>Terms of Service</strong> and <strong>Privacy Policy</strong>.</p>
        </aside>
      </section>
      <AuthFooter />
    </main>
  );
}

function PasswordRule({ satisfied, children }: { satisfied: boolean; children: ReactNode }) {
  return <span className={satisfied ? 'satisfied' : ''}><i />{children}</span>;
}

function SignupPage({ onAuthenticated }: { onAuthenticated: (result: AuthResponse) => void }) {
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
      const result = await signup(form);
      onAuthenticated(result);
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
            <p>Join the O3 Patient Portal to access medical records, manage appointments, and communicate with your care team in a protected demo environment.</p>
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
              <span>I agree to the <Link to="/terms">Terms of Service</Link> and acknowledge the <Link to="/privacy">Patient Privacy Policy</Link>.</span>
            </label>
            {error && <p className="auth-error">{error}</p>}
            <button className="auth-primary auth-primary--center" type="submit" disabled={submitting}>
              <strong>{submitting ? 'Creating Account...' : 'Create Account'}</strong>
              <ArrowRight size={24} />
            </button>
            <p className="auth-switch">Already have a clinical account? <Link to="/login">Log In</Link></p>
          </form>
        </section>
      </div>
    </main>
  );
}

function InformationPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="auth-page auth-page--login">
      <AuthHeader showHelpIcon />
      <section className="login-content">
        <div className="auth-card login-card">
          <h1>{title}</h1>
          <div>{children}</div>
          <p className="auth-switch"><Link to="/login">Return to sign in</Link></p>
        </div>
      </section>
      <AuthFooter />
    </main>
  );
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const result = await requestPasswordReset(email);
      setNotice(result.message || 'If the account exists, password reset instructions have been queued.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not request a password reset.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page auth-page--login">
      <AuthHeader showHelpIcon />
      <section className="login-content">
        <form className="auth-card login-card" onSubmit={submit}>
          <h1>Reset password</h1>
          <p>Enter the email address associated with your portal account.</p>
          <label className="auth-field" htmlFor="reset-email">
            <span>Email address</span>
            <input id="reset-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          {notice && <p role="status">{notice}</p>}
          {error && <p className="auth-error">{error}</p>}
          <button className="auth-primary" type="submit" disabled={submitting}>
            <strong>{submitting ? 'Requesting...' : 'Send reset instructions'}</strong>
            <ArrowRight size={24} />
          </button>
          <p className="auth-switch"><Link to="/login">Return to sign in</Link></p>
        </form>
      </section>
      <AuthFooter />
    </main>
  );
}

function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = new URLSearchParams(location.search).get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!token) {
      setError('This reset link is missing its one-time token. Request a new reset link.');
      return;
    }
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(token, password);
      navigate('/login', { replace: true, state: { notice: 'Password changed. Sign in with your new password.' } });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not reset the password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page auth-page--login">
      <AuthHeader showHelpIcon />
      <section className="login-content">
        <form className="auth-card login-card" onSubmit={submit}>
          <h1>Choose a new password</h1>
          <PasswordField id="reset-password" label="New password" value={password} onChange={setPassword} />
          <PasswordField id="reset-confirmation" label="Confirm new password" value={confirmation} onChange={setConfirmation} />
          {error && <p className="auth-error">{error}</p>}
          <button className="auth-primary" type="submit" disabled={submitting || !token}>
            <strong>{submitting ? 'Changing password...' : 'Change password'}</strong>
            <ArrowRight size={24} />
          </button>
          <p className="auth-switch"><Link to="/forgot-password">Request a new reset link</Link></p>
        </form>
      </section>
      <AuthFooter />
    </main>
  );
}

function ChangePasswordPage({ onChanged }: { onChanged: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmation) {
      setError('The new passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not change the password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page auth-page--login">
      <AuthHeader showHelpIcon />
      <section className="login-content">
        <form className="auth-card login-card" onSubmit={submit}>
          <h1>Change temporary password</h1>
          <p>Choose a private password before continuing to the portal.</p>
          <PasswordField id="current-password" label="Temporary password" value={currentPassword} onChange={setCurrentPassword} />
          <PasswordField id="new-password" label="New password" value={newPassword} onChange={setNewPassword} />
          <PasswordField id="new-password-confirmation" label="Confirm new password" value={confirmation} onChange={setConfirmation} />
          {error && <p className="auth-error">{error}</p>}
          <button className="auth-primary" type="submit" disabled={submitting}>
            <strong>{submitting ? 'Saving...' : 'Save password'}</strong>
            <ArrowRight size={24} />
          </button>
        </form>
      </section>
      <AuthFooter />
    </main>
  );
}

function NotFoundPage({ authenticated }: { authenticated: boolean }) {
  return (
    <InformationPage title="Page not found">
      <p>The requested portal page does not exist or is no longer available.</p>
      {authenticated && <p><Link to="/home">Return to portal home</Link></p>}
    </InformationPage>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [bootstrapError, setBootstrapError] = useState('');
  const navigate = useNavigate();
  const routeLocation = useLocation();

  useEffect(() => {
    const legacyRoute = location.hash.replace(/^#/, '');
    if (!legacyRoute) return;
    const target = legacyRoute === 'login' || legacyRoute === 'signup' ? `/${legacyRoute}` : `/${legacyRoute === 'settings' ? 'profile' : legacyRoute}`;
    history.replaceState(null, '', target);
    navigate(target, { replace: true });
  }, [navigate, routeLocation.pathname]);

  useEffect(() => {
    let active = true;
    getCurrentSession()
      .then((session) => {
        if (active) {
          const required = Boolean(session.user.mustChangePassword);
          setMustChangePassword(required);
          setAuthenticated(true);
          if (required && window.location.pathname !== '/change-password') navigate('/change-password', { replace: true });
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (!(error instanceof ApiError) || error.status !== 401) {
          setBootstrapError(error instanceof Error ? error.message : 'Could not verify your session.');
        }
        setAuthenticated(false);
      });
    return () => { active = false; };
  }, [navigate]);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearClientSession();
      setMustChangePassword(false);
      setAuthenticated(false);
      navigate('/login', { replace: true });
    };
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [navigate]);

  const handleAuthenticated = useCallback((result: AuthResponse) => {
    // HttpOnly cookies are authoritative. Bearer tokens already present in a
    // development browser are still read by the transport during bootstrap.
    clearLegacyAuthToken();
    const required = Boolean(result.user.mustChangePassword);
    setMustChangePassword(required);
    setAuthenticated(true);
    setBootstrapError('');
    navigate(required ? '/change-password' : '/home', { replace: true });
  }, [navigate]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch {
      // A stale session is already signed out server-side.
    } finally {
      clearClientSession();
      setMustChangePassword(false);
      setAuthenticated(false);
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  if (authenticated === null) {
    return <main className="app-loading" aria-live="polite"><p>Restoring your secure session...</p></main>;
  }

  const portalPaths = ['/home', '/dashboard', '/registration', '/records', '/appointments', '/messages', '/prescriptions', '/billing', '/family', '/resources', '/referrals', '/immunizations', '/trends', '/profile', '/admin/access-control'];

  return (
    <Routes>
      <Route path="/login" element={authenticated ? <Navigate to={mustChangePassword ? '/change-password' : '/home'} replace /> : <><LoginPage onAuthenticated={handleAuthenticated} />{bootstrapError && <span className="sr-only">{bootstrapError}</span>}</>} />
      <Route path="/signup" element={authenticated ? <Navigate to={mustChangePassword ? '/change-password' : '/home'} replace /> : <SignupPage onAuthenticated={handleAuthenticated} />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/change-password" element={authenticated ? <ChangePasswordPage onChanged={() => { setMustChangePassword(false); navigate('/home', { replace: true }); }} /> : <Navigate to="/login" replace />} />
      <Route path="/support" element={<InformationPage title="Portal support"><p>For urgent medical concerns, contact your local emergency service. For portal access, appointment, records, or billing help, contact your organization&apos;s patient support team.</p></InformationPage>} />
      <Route path="/terms" element={<InformationPage title="Terms of service"><p>This local portal is provided for authorized patient-care workflows. Do not enter real patient data unless your organization has approved this deployment.</p></InformationPage>} />
      <Route path="/privacy" element={<InformationPage title="Patient privacy"><p>Access is authenticated and audited. Only use the portal for patients and records you are authorized to access.</p></InformationPage>} />
      <Route path="/accessibility" element={<InformationPage title="Accessibility"><p>The portal supports keyboard navigation, semantic controls, and screen-reader labels. Contact support to report an accessibility barrier.</p></InformationPage>} />
      {portalPaths.map((path) => <Route key={path} path={path} element={authenticated ? (mustChangePassword ? <Navigate to="/change-password" replace /> : <Suspense fallback={<main className="app-loading"><p>Loading portal workspace...</p></main>}><PortalApp onLogout={handleLogout} /></Suspense>) : <Navigate to="/login" replace />} />)}
      <Route path="/" element={<Navigate to={authenticated ? (mustChangePassword ? '/change-password' : '/home') : '/login'} replace />} />
      <Route path="*" element={<NotFoundPage authenticated={authenticated} />} />
    </Routes>
  );
}

export default App;

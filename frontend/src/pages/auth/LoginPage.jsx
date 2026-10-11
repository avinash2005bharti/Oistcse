import React, { useState, useEffect } from 'react';
import { useERP } from '../../context/ERPContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { authApi } from '../../api/authApi';
import { Button } from '../../components/common';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  Building2,
  GraduationCap,
  Briefcase,
  Shield,
  Award,
  ShieldCheck,
  Zap,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  KeyRound,
  X
} from 'lucide-react';

export default function LoginPage() {
  const { login } = useERP();
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const initialRole = searchParams.get('role') || 'student';
  const [selectedRole, setSelectedRole] = useState(initialRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStep, setForgotStep] = useState(1); // 1 = enter email, 2 = enter otp & new pass
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  // Pre-seed inputs when navigating from registration
  useEffect(() => {
    if (location.state?.registeredEmail) {
      setEmail(location.state.registeredEmail);
      setPassword('');
      setSuccessNotice('Account registered successfully! Please log in with your credentials.');
    }
  }, [location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessNotice('');

    if (!email.trim() || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setLoading(true);

    try {
      const user = await login({
        email: email.trim().toLowerCase(),
        password,
        role: selectedRole
      });

      // Role routing based on authoritative backend verification
      const userRole = (user.role || '').toLowerCase();
      if (selectedRole === 'admin' || userRole === 'admin') {
        navigate('/admin');
      } else if (selectedRole === 'hod' || userRole === 'hod') {
        navigate('/hod');
      } else if (selectedRole === 'tg' || user.isTG || user.isAppointedTg) {
        navigate('/tg');
      } else if (selectedRole === 'faculty' || userRole === 'faculty' || userRole === 'teacher') {
        navigate('/teacher');
      } else {
        navigate('/student');
      }
    } catch (err) {
      setError(err.message || 'Invalid credentials. User not found in CSE records.');
    } finally {
      setLoading(false);
    }
  };

  // Forgot password modal handlers
  const handleOpenForgotModal = () => {
    setForgotEmail(email.trim().toLowerCase() || '');
    setForgotStep(1);
    setForgotError('');
    setForgotSuccess('');
    setOtpCode('');
    setNewPassword('');
    setShowForgotModal(true);
  };

  const handleCloseForgotModal = () => {
    setShowForgotModal(false);
    setForgotStep(1);
    setForgotError('');
    setForgotSuccess('');
    setOtpCode('');
    setNewPassword('');
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your registered email address.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await authApi.forgotPassword(forgotEmail.trim().toLowerCase());
      setForgotSuccess(res.message || 'If an account exists with this email, a password reset code has been sent.');
      setForgotStep(2);
    } catch (err) {
      setForgotError(err.message || 'Failed to send OTP. Please verify email.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    if (!otpCode.trim() || !newPassword) {
      setForgotError('OTP and new password are required.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await authApi.verifyOtp({
        email: forgotEmail.trim().toLowerCase(),
        otp: otpCode.trim(),
        newPassword
      });
      setForgotSuccess(res.message || 'Password successfully reset!');
      setTimeout(() => {
        handleCloseForgotModal();
        setPassword('');
        setEmail(forgotEmail.trim().toLowerCase());
      }, 1500);
    } catch (err) {
      setForgotError(err.message || 'Failed to verify OTP.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="split-login-container" style={{ minHeight: '100vh', display: 'flex' }}>
      {/* ========================================================================= */}
      {/* LEFT HALF: College Name, Accreditations & Key Highlights                   */}
      {/* ========================================================================= */}
      <div className="split-login-brand">
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
            <span className="accreditation-pill">
              <span className="agent-pulse" style={{ backgroundColor: '#10B981', width: '6px', height: '6px' }} />
              Official Institutional Gateway • Estd. 1995
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem' }}>
            <div className="brand-emblem-box">
              <img
                src="/oist.png"
                alt="Oriental Institute of Science & Technology"
                className="brand-emblem-img"
              />
            </div>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', color: '#93C5FD', textTransform: 'uppercase' }}>
                Oriental Group of Institutes
              </span>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.15, marginTop: '2px' }}>
                Oriental Institute of Science & Technology
              </h1>
              <p style={{ fontSize: '13px', color: '#CBD5E1', fontWeight: 600, marginTop: '4px' }}>
                Department of Computer Science & Engineering (CSE)
              </p>
            </div>
          </div>

          <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: 1.6, maxWidth: '520px', marginBottom: '1.75rem' }}>
            CampusFlow ERP — Enterprise academic management powering real-time attendance ledgers, timetable generation, multi-tier clearances, and transparent student governance.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span className="accreditation-pill">
              <Award size={13} color="#FBBF24" />
              NAAC 'A+' Grade Accredited
            </span>
            <span className="accreditation-pill">
              <Building2 size={13} color="#60A5FA" />
              Approved by AICTE, New Delhi
            </span>
            <span className="accreditation-pill">
              <GraduationCap size={13} color="#34D399" />
              Affiliated to RGPV, Bhopal
            </span>
            <span className="accreditation-pill">
              <ShieldCheck size={13} color="#F472B6" />
              NBA Accredited Programmes
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RIGHT HALF: Real Authentication Form & Role Quick-Switch Tabs             */}
      {/* ========================================================================= */}
      <div className="split-login-form-area" style={{ flex: 1, padding: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '460px' }}>
          {/* Centered Institutional Logo for Responsive Mode */}
          <div className="mobile-login-logo">
            <div className="mobile-logo-circle">
              <img
                src="/oist.png"
                alt="Oriental Institute of Science & Technology"
              />
            </div>
            <h3>Oriental Institute of Science & Technology</h3>
            <p>Department of Computer Science & Engineering</p>
          </div>

          {/* Header */}
          <div style={{ marginBottom: '1.75rem' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Authentication Gateway
            </span>
            <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginTop: '4px' }}>
              Sign in to CampusFlow
            </h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Enter your registered official email address and password to sign in.
            </p>
          </div>

          {error && (
            <div className="p-3 mb-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-800 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-danger-600" />
              <span>{error}</span>
            </div>
          )}

          {successNotice && (
            <div className="p-3 mb-4 rounded-xl bg-success-50 border border-success-200 text-success-800 text-xs flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-success-600" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {/* Role-Based Portal Selection Tabs */}
            <div>
              <label className="form-label" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
                Select Portal / Role
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.35rem', backgroundColor: 'var(--surface-low)', padding: '0.25rem', borderRadius: 'var(--radius-lg)' }}>
                {[
                  { role: 'student', label: 'Student', icon: <GraduationCap size={15} /> },
                  { role: 'faculty', label: 'Faculty', icon: <Briefcase size={15} /> },
                  { role: 'tg', label: 'TG', icon: <Award size={15} /> },
                  { role: 'hod', label: 'HOD', icon: <Building2 size={15} /> },
                  { role: 'admin', label: 'Admin', icon: <ShieldCheck size={15} /> }
                ].map((item) => {
                  const isActive = selectedRole === item.role;
                  return (
                    <button
                      key={item.role}
                      type="button"
                      id={`tab-role-${item.role}`}
                      onClick={() => {
                        setSelectedRole(item.role);
                        setError('');
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.25rem',
                        padding: '0.5rem 0.25rem',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        backgroundColor: isActive ? 'var(--surface)' : 'transparent',
                        color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                        fontWeight: isActive ? 700 : 500,
                        fontSize: 'var(--text-xs)',
                        boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="form-label" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'block' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  required
                  placeholder="name@college.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: '2.5rem' }}
                />
                <Mail size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label className="form-label" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 0 }}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleOpenForgotModal}
                  style={{ fontSize: 'var(--text-xs)', color: 'var(--primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Forgot Password?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                />
                <Lock size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '0.85rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              rightIcon={<ArrowRight size={16} />}
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              Sign In to ERP Portal
            </Button>
          </form>

          {/* Registration Links (Faculty Registration Removed per Production Auth Policy) */}
          <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', display: 'block', marginBottom: '0.75rem' }}>
              Student Self-Registration
            </span>
            <div>
              <Link
                to="/register/student"
                className="btn btn-outline"
                style={{
                  fontSize: 'var(--text-xs)',
                  padding: '0.7rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  textDecoration: 'none',
                  width: '100%',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-lg)'
                }}
              >
                <GraduationCap size={16} style={{ color: 'var(--primary)' }} />
                <span>New Student? Create Student Account</span>
                <ArrowRight size={14} style={{ color: 'var(--text-muted)', marginLeft: 'auto' }} />
              </Link>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '0.65rem', marginBottom: 0, textAlign: 'center' }}>
              Faculty & Staff accounts are provisioned exclusively by Department Administration.
            </p>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--surface)',
              borderRadius: 'var(--radius-xl)',
              padding: '2rem',
              width: '100%',
              maxWidth: '420px',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <KeyRound size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Reset Password
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseForgotModal}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {forgotError && (
              <div className="p-3 mb-3 rounded-lg bg-danger-50 border border-danger-200 text-danger-800 text-xs">
                {forgotError}
              </div>
            )}

            {forgotSuccess && (
              <div className="p-3 mb-3 rounded-lg bg-success-50 border border-success-200 text-success-800 text-xs">
                {forgotSuccess}
              </div>
            )}

            {forgotStep === 1 ? (
              <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                  Enter your registered CSE email address. A 6-digit OTP code will be generated to reset your password.
                </p>
                <div>
                  <label className="form-label" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'block' }}>Email Address</label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="input-field"
                    placeholder="e.g. student@college.edu or admin@mail.in"
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCloseForgotModal}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={forgotLoading}
                    style={{ flex: 2 }}
                  >
                    Send Reset Code
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-low)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    Email: <strong style={{ color: 'var(--text-primary)' }}>{forgotEmail}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep(1);
                      setForgotError('');
                      setForgotSuccess('');
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Change Email
                  </button>
                </div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                  Enter the 6-digit verification OTP code and your new password.
                </p>
                <div>
                  <label className="form-label" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'block' }}>6-Digit OTP Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="input-field"
                    placeholder="123456"
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem', display: 'block' }}>New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input-field"
                    placeholder="Min. 6 characters"
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setForgotStep(1);
                      setForgotError('');
                      setForgotSuccess('');
                    }}
                    style={{ flex: 1 }}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={forgotLoading}
                    style={{ flex: 2 }}
                  >
                    Verify & Reset
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

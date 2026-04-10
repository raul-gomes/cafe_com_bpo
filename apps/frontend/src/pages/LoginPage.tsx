import { LoginForm } from '../components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--ds-black)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle glow */}
      <div style={{
        position: 'absolute', top: '-100px', left: '50%', transform: 'translateX(-50%)',
        width: '600px', height: '300px',
        background: 'radial-gradient(ellipse at center, rgba(251,191,36,0.1) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <LoginForm />

      <p style={{ marginTop: '24px', fontSize: '12px', color: 'var(--ds-text-subtle)' }}>
        Café com BPO © {new Date().getFullYear()}
      </p>
    </div>
  );
}

import { LoginForm } from '../components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="login-page-wrapper">
      <div className="watermark-text" style={{ fontSize: '20vw', top: '20%', left: '30%' }}>CAFE</div>
      <div className="watermark-text" style={{ fontSize: '20vw', top: '80%', left: '70%', color: 'rgba(246, 184, 40, 0.05)' }}>BPO</div>
      
      <div className="brand-header animate-fade-up">
        <h1>Café com <span className="highlight">BPO</span></h1>
      </div>
      
      <div className="animate-fade-up delay-1" style={{width: '100%', zIndex: 10}}>
        <LoginForm />
      </div>
    </div>
  );
}

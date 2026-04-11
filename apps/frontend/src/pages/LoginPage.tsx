import { Navbar } from '../components/ui/Navbar';
import { LoginForm } from '../components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="login-page">
      <Navbar />

      {/* Glow blobs decorativos */}
      <div className="login-glow-top" />
      <div className="login-glow-bottom" />

      {/* BPO watermark — rodapé da página, canto inferior direito */}
      <span className="login-bpo-watermark">BPO</span>

      {/* Container de conteúdo */}
      <div className="login-content">
        <LoginForm />
        <p className="login-footer-note">
          Café com BPO © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

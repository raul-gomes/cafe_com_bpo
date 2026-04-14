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
        {sessionStorage.getItem('cafe_bpo_proposal') && (
          <div className="ds-alert ds-alert-warning" style={{ marginBottom: '20px', textAlign: 'center' }}>
            <strong>Quase lá!</strong> Faça login ou cadastre-se para salvar sua simulação e baixar sua proposta em PDF.
          </div>
        )}
        <LoginForm />
        <p className="login-footer-note">
          Café com BPO © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import HomePage from './HomePage';
import { LoginDialog } from '../components/auth/LoginDialog';
import { usePageMeta } from '../lib/seo';

/**
 * /login: a página inicial com a janela de login aberta por cima. Quem chega
 * aqui por link, convite ou sessão expirada vê o mesmo login suspenso que se
 * abre pelo botão do topo; fechar a janela volta para o início.
 */
export default function LoginPage() {
  usePageMeta({ title: 'Login', description: 'Entre na sua conta do Café com BPO.', path: '/login', noindex: true });
  const navigate = useNavigate();
  return (
    <>
      <HomePage />
      <LoginDialog onClose={() => navigate('/')} />
    </>
  );
}

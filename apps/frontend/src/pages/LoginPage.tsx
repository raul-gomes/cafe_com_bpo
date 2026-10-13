import { useNavigate } from 'react-router-dom';
import HomePage from './HomePage';
import { LoginDialog } from '../components/auth/LoginDialog';
import { usePageMeta } from '../lib/seo';

/**
 * /login: the landing page with the login dialog open on top. Whoever lands
 * here from a link, invitation or expired session sees the same dialog the
 * header button opens; closing it goes back home.
 *
 * @returns The page.
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

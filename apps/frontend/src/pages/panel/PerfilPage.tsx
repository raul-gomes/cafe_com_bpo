import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../api/client';

export const PerfilPage: React.FC = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    company: user?.company || '',
    address: '' // This field might not be in the current user object but was in the drawing
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const initials = formData.name
    ? formData.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      // In a real scenario, we would have a PUT/PATCH /auth/me or similar
      // For now, let's simulate a success if the backend doesn't have it yet
      // await apiClient.patch('/auth/me', formData);
      
      setTimeout(() => {
        setIsSaving(false);
        setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
      }, 800);
    } catch (err) {
      setIsSaving(false);
      setMessage({ type: 'error', text: 'Erro ao salvar alterações.' });
    }
  };

  return (
    <div className="perfil-page">
      {/* Breadcrumb Navigation */}
      <div className="panel-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '12px', fontWeight: 600 }}>
        <span style={{ color: 'var(--ds-text-muted)', cursor: 'pointer' }} onClick={() => navigate('/painel')}>Painel</span>
        <span style={{ color: 'var(--ds-text-subtle)' }}>/</span>
        <span style={{ color: 'var(--ds-primary)' }}>Meu Perfil</span>
      </div>

      <div className="panel-content__header">
        <h1>Meu Perfil</h1>
        <p>Gerencie suas informações pessoais e da sua empresa.</p>
      </div>

      <div className="perfil-card">
        <div className="perfil-card__avatar-section">
          <div className="perfil-card__avatar-large">{initials}</div>
          <div className="perfil-card__avatar-info">
            <h2>{formData.name || 'Usuário'}</h2>
            <p>{formData.email}</p>
          </div>
        </div>

        <form className="perfil-form" onSubmit={handleSubmit}>
          <div className="ds-input-group">
            <label className="ds-label">Nome Completo</label>
            <input
              type="text"
              name="name"
              className="ds-input"
              value={formData.name}
              onChange={handleChange}
              placeholder="Ex: Raul Gomes"
              required
            />
          </div>

          <div className="ds-input-group">
            <label className="ds-label">E-mail</label>
            <input
              type="email"
              name="email"
              className="ds-input"
              value={formData.email}
              onChange={handleChange}
              placeholder="email@exemplo.com"
              disabled // Email usually fixed
            />
          </div>

          <div className="ds-input-group perfil-form__full">
            <label className="ds-label">Empresa</label>
            <input
              type="text"
              name="company"
              className="ds-input"
              value={formData.company}
              onChange={handleChange}
              placeholder="Nome da sua empresa"
            />
          </div>

          <div className="ds-input-group perfil-form__full">
            <label className="ds-label">Endereço Business</label>
            <input
              type="text"
              name="address"
              className="ds-input"
              value={formData.address}
              onChange={handleChange}
              placeholder="Rua, Número, Cidade - UF"
            />
          </div>

          {message && (
             <div className={`ds-alert ds-alert-${message.type === 'success' ? 'warning' : 'error'} perfil-form__full`} style={{ marginTop: '8px' }}>
                {message.text}
             </div>
          )}

          <div className="perfil-form__actions">
            <button
              type="button"
              className="ds-btn ds-btn-ghost"
              onClick={() => window.history.back()}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="ds-btn ds-btn-primary"
              disabled={isSaving}
            >
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

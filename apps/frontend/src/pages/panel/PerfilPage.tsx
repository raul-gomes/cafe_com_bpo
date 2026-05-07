import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../api/client';
import { uploadAvatar } from '../../api/clients';
import { getApiUrl } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import type { User } from '../../context/AuthContext';

type TabType = 'personal' | 'company';

const SEGMENT_OPTIONS = [
  { value: '', label: 'Selecione um segmento' },
  { value: 'contabilidade', label: 'Contabilidade' },
  { value: 'consultoria', label: 'Consultoria' },
  { value: 'bpo_financeiro', label: 'BPO Financeiro' },
  { value: 'auditoria', label: 'Auditoria' },
  { value: 'outros', label: 'Outros' },
];

export const PerfilPage: React.FC = () => {
  const { user, setUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('personal');
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    company: user?.company || '',
    company_name: user?.company_name || '',
    company_segment: user?.company_segment || '',
    company_description: user?.company_description || '',
  });
  
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    user?.avatar_url ? (user.avatar_url.startsWith('http') ? user.avatar_url : `${getApiUrl()}${user.avatar_url}`) : null
  );

  useEffect(() => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
      company: user?.company || '',
      company_name: user?.company_name || '',
      company_segment: user?.company_segment || '',
      company_description: user?.company_description || '',
    });
  }, [user]);

  const initials = formData.name
    ? formData.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      if (avatarFile) {
        await uploadAvatar(avatarFile);
      }
      
      const updated = await apiClient.patch<User>('/auth/me', formData);
      
      setUser(updated.data);
      
      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
      setIsSaving(false);
    } catch (err) {
      setIsSaving(false);
      setMessage({ type: 'error', text: 'Erro ao salvar alterações.' });
    }
  };

  return (
    <div className="perfil-page">
      <Breadcrumb items={[{ label: 'Painel', to: '/painel' }, { label: 'Meu Perfil' }]} />

      <div className="perfil-card" style={{ maxWidth: '700px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ds-white)' }}>Meu perfil</h2>
          <p style={{ color: 'var(--ds-text-muted)', fontSize: '13px', marginTop: '2px' }}>Gerencie suas informações pessoais e da empresa.</p>
        </div>

        <div className="perfil-card__avatar-section" style={{ marginBottom: '24px' }}>
          {avatarPreview ? (
            <div 
              className="perfil-card__avatar-large" 
              style={{ 
                backgroundImage: `url(${avatarPreview})`, 
                backgroundSize: 'cover', 
                backgroundPosition: 'center', 
                color: 'transparent',
                border: '1px solid var(--ds-border)'
              }}
            >
              {initials}
            </div>
          ) : (
            <div className="perfil-card__avatar-large">{initials}</div>
          )}
          
          <div className="perfil-card__avatar-info">
            <h2 style={{ fontSize: '16px' }}>{formData.name || 'Usuário'}</h2>
            <p>{formData.email}</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--ds-border)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('personal')}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'personal' ? '2px solid var(--ds-primary)' : '2px solid transparent',
              color: activeTab === 'personal' ? 'var(--ds-white)' : 'var(--ds-text-muted)',
              cursor: 'pointer',
              fontWeight: activeTab === 'personal' ? 600 : 400,
            }}
          >
            Dados Pessoais
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('company')}
            style={{
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'company' ? '2px solid var(--ds-primary)' : '2px solid transparent',
              color: activeTab === 'company' ? 'var(--ds-white)' : 'var(--ds-text-muted)',
              cursor: 'pointer',
              fontWeight: activeTab === 'company' ? 600 : 400,
            }}
          >
            Dados da Empresa
          </button>
        </div>

        <form className="perfil-form" onSubmit={handleSubmit}>
          {activeTab === 'personal' && (
            <>
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
                  disabled
                />
              </div>

              <div className="ds-input-group perfil-form__full">
                <label className="ds-label">Empresa (Nome Legado)</label>
                <input
                  type="text"
                  name="company"
                  className="ds-input"
                  value={formData.company}
                  onChange={handleChange}
                  placeholder="Nome da sua empresa"
                />
              </div>

              <div className="ds-input-group perfil-form__full" style={{ marginTop: '16px' }}>
                <label className="ds-label">Upload da Logo (Avatar)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '4px' }}>
                  <label 
                    htmlFor="avatar-upload"
                    className="ds-btn ds-btn-outline ds-btn-sm" 
                    style={{ cursor: 'pointer', textAlign: 'center' }}
                  >
                    Escolher Arquivo
                  </label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleAvatarChange}
                    style={{ display: 'none' }}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--ds-text-muted)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {avatarFile ? avatarFile.name : 'Nenhum arquivo selecionado'}
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--ds-text-subtle)', marginTop: '4px' }}>Esta logo aparecerá na capa das propostas PDF em alta resolução.</p>
              </div>
            </>
          )}

          {activeTab === 'company' && (
            <>
              <div className="ds-input-group perfil-form__full">
                <label className="ds-label">Nome da Empresa</label>
                <input
                  type="text"
                  name="company_name"
                  className="ds-input"
                  value={formData.company_name}
                  onChange={handleChange}
                  placeholder="Ex: BPO Soluções Financeiras Ltda"
                />
              </div>

              <div className="ds-input-group perfil-form__full">
                <label className="ds-label">Segmento</label>
                <select
                  name="company_segment"
                  className="ds-input"
                  value={formData.company_segment}
                  onChange={handleChange as any}
                >
                  {SEGMENT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="ds-input-group perfil-form__full">
                <label className="ds-label">Descrição da Empresa</label>
                <textarea
                  name="company_description"
                  className="ds-input"
                  value={formData.company_description}
                  onChange={handleChange as any}
                  placeholder="Descreva brevemente o que sua empresa faz..."
                  rows={4}
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
            </>
          )}

          {message && (
             <div className={`ds-alert ds-alert-${message.type === 'success' ? 'warning' : 'error'} perfil-form__full`} style={{ marginTop: '8px' }}>
                {message.text}
             </div>
          )}

          <div className="perfil-form__actions">
            <Button 
              type="submit" 
              label="Salvar Alterações" 
              isLoading={isSaving} 
            />
          </div>
        </form>
      </div>
    </div>
  );
};

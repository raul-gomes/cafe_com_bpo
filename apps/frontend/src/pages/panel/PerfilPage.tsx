import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../api/client';
import { getClients, createClient, ClientData, uploadAvatar } from '../../api/clients';
import { getApiUrl } from '../../api/client';

export const PerfilPage: React.FC = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    company: user?.company || '',
    address: '' 
  });
  
  const [clients, setClients] = useState<ClientData[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Logo upload state
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    user?.avatar_url ? `${getApiUrl()}${user.avatar_url}` : null
  );

  // New Client state
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', cnpj: '', phone: '', email: '' });

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      const data = await getClients();
      setClients(data);
    } catch (err) {
      console.error('Failed to load clients', err);
    }
  };

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
      
      // Update basic profile info 
      // await apiClient.patch('/auth/me', formData);
      
      setTimeout(() => {
        setIsSaving(false);
        setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
        
        // Reload page to refresh AuthContext or trigger user refresh
        setTimeout(() => window.location.reload(), 1000);
      }, 500);
    } catch (err) {
      setIsSaving(false);
      setMessage({ type: 'error', text: 'Erro ao salvar alterações.' });
    }
  };

  const handleAddClient = async () => {
    if (!newClient.name) return;
    try {
      await createClient(newClient);
      setShowNewClientForm(false);
      setNewClient({ name: '', cnpj: '', phone: '', email: '' });
      await loadClients();
    } catch (e) {
      console.error(e);
      alert('Erro ao criar cliente.');
    }
  };

  return (
    <div className="perfil-page">
      <div className="panel-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '12px', fontWeight: 600 }}>
        <span style={{ color: 'var(--ds-text-muted)', cursor: 'pointer' }} onClick={() => window.history.back()}>Painel</span>
        <span style={{ color: 'var(--ds-text-subtle)' }}>/</span>
        <span style={{ color: 'var(--ds-primary)' }}>Meu Perfil</span>
      </div>

      <div className="panel-content__header">
        <h1>Meu Perfil</h1>
        <p>Gerencie suas informações pessoais e da sua empresa.</p>
      </div>

      <div className="perfil-card">
        <div className="perfil-card__avatar-section">
          {avatarPreview ? (
            <div className="perfil-card__avatar-large" style={{ backgroundImage: `url(${avatarPreview})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' }}>
              {initials}
            </div>
          ) : (
            <div className="perfil-card__avatar-large">{initials}</div>
          )}
          
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
              disabled
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

          <div className="ds-input-group perfil-form__full" style={{ marginTop: '16px' }}>
            <label className="ds-label">Upload da Logo (Avatar)</label>
            <input
              type="file"
              accept="image/png, image/jpeg, image/webp"
              onChange={handleAvatarChange}
              style={{ color: 'var(--ds-text-muted)', fontSize: '13px' }}
            />
            <p style={{ fontSize: '11px', color: 'var(--ds-text-subtle)', marginTop: '4px' }}>Esta logo aparecerá na capa das propostas PDF em alta resolução.</p>
          </div>

          {message && (
             <div className={`ds-alert ds-alert-${message.type === 'success' ? 'warning' : 'error'} perfil-form__full`} style={{ marginTop: '8px' }}>
                {message.text}
             </div>
          )}

          <div className="perfil-form__actions">
            <button type="submit" className="ds-btn ds-btn-primary" disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>

      <div className="perfil-card" style={{ marginTop: '40px' }}>
         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h2 style={{ color: 'var(--ds-white)', fontSize: '16px' }}>Meus Clientes / Empresas</h2>
              <p style={{ color: 'var(--ds-text-muted)', fontSize: '12px' }}>Gerencie as empresas vinculadas a você para uso nas precificações.</p>
            </div>
            <button className="ds-btn ds-btn-ghost" onClick={() => setShowNewClientForm(!showNewClientForm)}>
              {showNewClientForm ? 'Cancelar' : '+ Adicionar Empresa'}
            </button>
         </div>

         {showNewClientForm && (
           <div style={{ backgroundColor: 'var(--ds-surface)', padding: '16px', borderRadius: '8px', marginBottom: '24px', border: '1px solid var(--ds-border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="ds-input-group">
                  <label className="ds-label">Nome da Empresa</label>
                  <input type="text" className="ds-input" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} placeholder="Nome" />
                </div>
                <div className="ds-input-group">
                  <label className="ds-label">CNPJ</label>
                  <input type="text" className="ds-input" value={newClient.cnpj} onChange={e => setNewClient({...newClient, cnpj: e.target.value})} placeholder="00.000.000/0000-00" />
                </div>
                <div className="ds-input-group">
                  <label className="ds-label">Telefone</label>
                  <input type="text" className="ds-input" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} placeholder="(11) 99999-9999" />
                </div>
                <div className="ds-input-group">
                  <label className="ds-label">E-mail</label>
                  <input type="email" className="ds-input" value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} placeholder="contato@empresa.com" />
                </div>
              </div>
              <button 
                className="ds-btn ds-btn-primary" 
                style={{ marginTop: '16px' }}
                onClick={handleAddClient}
                disabled={!newClient.name}
              >
                Salvar Empresa
              </button>
           </div>
         )}

         {clients.length > 0 ? (
           <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {clients.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', backgroundColor: 'var(--ds-surface-hover)', borderRadius: '6px', border: '1px solid var(--ds-border)' }}>
                   <div>
                     <strong style={{ color: 'var(--ds-white)', fontSize: '14px', display: 'block' }}>{c.name}</strong>
                     <span style={{ color: 'var(--ds-text-subtle)', fontSize: '12px' }}>{c.cnpj || 'Sem CNPJ'} • {c.email || 'Sem E-mail'}</span>
                   </div>
                </div>
              ))}
           </div>
         ) : (
           <div style={{ textAlign: 'center', padding: '32px', color: 'var(--ds-text-subtle)', fontSize: '13px' }}>
              Nenhuma empresa cadastrada.
           </div>
         )}
      </div>
    </div>
  );
};

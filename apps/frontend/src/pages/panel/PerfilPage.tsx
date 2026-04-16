import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../api/client';
import { getClients, createClient, deleteClient, ClientData, uploadAvatar } from '../../api/clients';
import { getApiUrl } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { maskCNPJ, maskPhone, onlyNumbers } from '../../lib/formatters';

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
      const payload = {
        name: newClient.name,
        cnpj: onlyNumbers(newClient.cnpj),
        phone: onlyNumbers(newClient.phone),
        email: newClient.email.trim() || undefined
      };
      await createClient(payload);
      setShowNewClientForm(false);
      setNewClient({ name: '', cnpj: '', phone: '', email: '' });
      await loadClients();
    } catch (e) {
      console.error(e);
      alert('Erro ao criar cliente.');
    }
  };

  const handleDeleteClient = async (id: string, name: string) => {
    if (!window.confirm(`Deseja remover a empresa "${name}"? Esta ação não afetará propostas já emitidas.`)) return;
    
    try {
      // Optistic update
      setClients(prev => prev.filter(c => c.id !== id));
      await deleteClient(id);
    } catch (e) {
      console.error(e);
      alert('Erro ao excluir cliente.');
      await loadClients(); // revert
    }
  };

  return (
    <div className="perfil-page">
      <div className="panel-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '12px', fontWeight: 600 }}>
        <span style={{ color: 'var(--ds-text-muted)', cursor: 'pointer' }} onClick={() => window.history.back()}>Painel</span>
        <span style={{ color: 'var(--ds-text-subtle)' }}>/</span>
        <span style={{ color: 'var(--ds-primary)' }}>Meu Perfil</span>
      </div>

      <div className="perfil-responsive-grid">
        {/* LADO ESQUERDO: MEU PERFIL */}
        <div>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ds-white)' }}>Meu perfil</h2>
            <p style={{ color: 'var(--ds-text-muted)', fontSize: '13px', marginTop: '2px' }}>Gerencie suas informações pessoais e da sua empresa.</p>
          </div>
          <div className="perfil-card" style={{ height: 'calc(100% - 66px)' }}>
            <div className="perfil-card__avatar-section">
              {avatarPreview ? (
                <div className="perfil-card__avatar-large" style={{ backgroundImage: `url(${avatarPreview})`, backgroundSize: 'cover', backgroundPosition: 'center', color: 'transparent' }}>
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

        {/* LADO DIREITO: MINHAS EMPRESAS */}
        <div>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ds-white)', marginBottom: '2px' }}>Minhas empresas</h2>
                <p style={{ color: 'var(--ds-text-muted)', fontSize: '13px' }}>Empresas corporativas vinculadas a você.</p>
              </div>
              <Button 
                variant={showNewClientForm ? 'outline' : 'primary'}
                size="sm"
                onClick={() => setShowNewClientForm(!showNewClientForm)}
                label={showNewClientForm ? 'Cancelar' : '+ Nova Empresa'}
              />
           </div>
           
           <div className="perfil-card" style={{ height: 'calc(100% - 66px)', display: 'flex', flexDirection: 'column', gap: '16px', background: 'transparent', border: 'none', padding: 0 }}>
             {showNewClientForm && (
               <div style={{ backgroundColor: 'var(--ds-surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--ds-border)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="ds-input-group">
                      <label className="ds-label">Nome da Empresa</label>
                      <input type="text" className="ds-input" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} placeholder="Nome" />
                    </div>
                    <div className="ds-input-group">
                      <label className="ds-label">CNPJ</label>
                      <input 
                        type="text" 
                        className="ds-input" 
                        value={newClient.cnpj} 
                        onChange={e => setNewClient({...newClient, cnpj: maskCNPJ(e.target.value)})} 
                        placeholder="00.000.000/0000-00" 
                      />
                    </div>
                    <div className="ds-input-group">
                      <label className="ds-label">Telefone</label>
                      <input 
                        type="text" 
                        className="ds-input" 
                        value={newClient.phone} 
                        onChange={e => setNewClient({...newClient, phone: maskPhone(e.target.value)})} 
                        placeholder="(00) 00000-0000" 
                      />
                    </div>
                  </div>
                  <Button 
                    style={{ marginTop: '16px', width: '100%' }}
                    onClick={handleAddClient}
                    disabled={!newClient.name}
                    label="Salvar Empresa"
                  />
               </div>
             )}

             {clients.length > 0 ? (
               <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {clients.map(c => (
                    <div 
                      key={c.id}
                      className="orcamento-card"
                    >
                       <div className="orcamento-card__info">
                         <span className="orcamento-card__client">{c.name}</span>
                         <div className="orcamento-card__meta" style={{ marginTop: '2px', display: 'flex', gap: '8px' }}>
                           <span>{c.cnpj ? maskCNPJ(c.cnpj) : 'Sem CNPJ'}</span>
                           {c.phone && (
                             <>
                               <span className="orcamento-card__meta-dot" />
                               <span>{maskPhone(c.phone)}</span>
                             </>
                           )}
                         </div>
                       </div>
                       <div className="orcamento-card__actions">
                         <button 
                           className="orcamento-card__action-btn orcamento-card__action-btn--delete" 
                           onClick={() => handleDeleteClient(c.id, c.name)}
                           title="Excluir Empresa"
                         >
                           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                         </button>
                       </div>
                    </div>
                  ))}
               </div>
             ) : (
               <div style={{ textAlign: 'center', padding: '32px', color: 'var(--ds-text-subtle)', fontSize: '13px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px' }}>
                  Nenhuma empresa cadastrada.
               </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
};

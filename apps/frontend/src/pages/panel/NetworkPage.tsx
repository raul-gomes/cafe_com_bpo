import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPosts, createPost, PaginatedPosts } from '../../api/network';
import { RichTextEditor } from '../../components/ui/RichTextEditor';
import { NotificationBell } from '../../components/panel/NotificationBell';

export const NetworkPage: React.FC = () => {
  const [data, setData] = useState<PaginatedPosts | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newTags, setNewTags] = useState('');
  const [error, setError] = useState('');
  
  const navigate = useNavigate();

  const loadPosts = async () => {
    setLoading(true);
    try {
      const resp = await getPosts(20);
      setData(resp);
    } catch (e: any) {
      setError('Erro ao carregar tópicos da comunidade');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newMessage) {
      setError('Preencha título e mensagem.');
      return;
    }
    
    const tagsArray = newTags.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
    
    try {
      await createPost({ title: newTitle, message: newMessage, tags: tagsArray });
      setShowForm(false);
      setNewTitle('');
      setNewMessage('');
      setNewTags('');
      loadPosts();
    } catch (e: any) {
      setError('Erro ao criar tópico.');
    }
  };

  return (
    <>
      <div className="panel-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '12px', fontWeight: 600 }}>
        <span style={{ color: 'var(--ds-primary)' }}>Comunidade</span>
      </div>

      <div className="panel-content__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1>Fórum da Comunidade</h1>
          <p>Discuta, tire dúvidas e faça networking com outros profissionais de BPO.</p>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <NotificationBell />
          <button 
            className={showForm ? "ds-btn ds-btn-ghost" : "ds-btn ds-btn-primary"} 
            onClick={() => setShowForm(!showForm)}
            style={{ gap: '8px' }}
          >
            {showForm ? 'Cancelar' : 'Criar Tópico'}
          </button>
        </div>
      </div>

      {error && <div className="alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="panel-card" style={{ marginBottom: '32px', border: '1px solid rgba(255,255,255,0.07)', background: 'var(--ds-surface)' }}>
          <div className="ds-card-header">
             <h3 style={{ margin: 0, fontSize: '18px' }}>Novo Tópico</h3>
          </div>
          <div className="ds-card-body">
            <div className="ds-input-group">
              <label className="ds-label">Título do Tópico</label>
              <input 
                type="text" 
                className="ds-input" 
                value={newTitle} 
                onChange={e => setNewTitle(e.target.value)} 
                placeholder="Descreva seu desafio ou dúvida de forma clara"
              />
            </div>
            <div className="ds-input-group" style={{ marginTop: '16px' }}>
              <label className="ds-label">Mensagem</label>
              <div style={{ background: 'var(--ds-surface-2)', borderRadius: 'var(--radius-md)' }}>
                <RichTextEditor 
                  value={newMessage} 
                  onChange={setNewMessage} 
                  placeholder="Detalhe mais informações aqui..."
                />
              </div>
            </div>
            <div className="ds-input-group" style={{ marginTop: '16px' }}>
              <label className="ds-label">Tags (separadas por vírgula)</label>
              <input 
                type="text" 
                className="ds-input" 
                value={newTags} 
                onChange={e => setNewTags(e.target.value)} 
                placeholder="ex: duvida, vendas, operacional"
              />
            </div>
            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="ds-btn ds-btn-primary">Publicar Tópico</button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <div className="orcamentos-list">
          {Array.from({ length: 4 }).map((_, i) => (
             <div key={i} className="orcamento-card">
               <div className="orcamento-card__info">
                 <div className="panel-skeleton" style={{ width: '60%', height: '16px', marginBottom: '8px' }} />
                 <div className="panel-skeleton" style={{ width: '40%', height: '12px' }} />
               </div>
             </div>
          ))}
        </div>
      ) : (
        <div className="orcamentos-list">
          {data?.items.length === 0 && (
            <div className="panel-empty">
               <h3 style={{ marginTop: '16px' }}>Nenhum tópico encontrado</h3>
               <p>Seja o primeiro a puxar um assunto!</p>
            </div>
          )}
          {data?.items.map(post => (
            <div 
              key={post.id} 
              className="orcamento-card"
              onClick={() => navigate(`/painel/forum/${post.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={e => {
                if (e.key === 'Enter') navigate(`/painel/forum/${post.id}`);
              }}
              style={{ alignItems: 'flex-start' }}
            >
              <div className="orcamento-card__info" style={{ flex: 1 }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>
                  {post.title}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {post.tags.map(tag => (
                    <span key={tag} style={{ background: 'rgba(255,191,0,0.1)', color: 'var(--ds-primary)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                      #{tag}
                    </span>
                  ))}
                </div>
                <div className="orcamento-card__meta">
                  Autor: {post.author.name || post.author.email || 'Usuário'}
                  <span className="orcamento-card__meta-dot" />
                  {post.comments_count} {post.comments_count === 1 ? 'resposta' : 'respostas'}
                  <span className="orcamento-card__meta-dot" />
                  {new Date(post.created_at).toLocaleDateString('pt-BR')}
                </div>
              </div>
              <div className="orcamento-card__actions" style={{ marginLeft: '16px' }}>
                <button className="ds-btn ds-btn-ghost ds-btn-sm">
                  Ler Tópico
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

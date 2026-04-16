import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getPosts, createPost, PaginatedPosts } from '../../api/network';
import { RichTextEditor } from '../ui/RichTextEditor';

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
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>Fórum da Comunidade</h2>
        <button 
          className="btn-primary" 
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancelar' : 'Criar Tópico'}
        </button>
      </div>

      {error && <div className="alert-error" style={{ marginBottom: '16px' }}>{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: 'var(--panel-bg)', padding: '24px', borderRadius: '8px', marginBottom: '32px', border: '1px solid var(--border-color)' }}>
          <div className="form-group">
            <label>Título do Tópico</label>
            <input 
              type="text" 
              className="form-control" 
              value={newTitle} 
              onChange={e => setNewTitle(e.target.value)} 
              placeholder="Descreva seu desafio ou dúvida"
            />
          </div>
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label>Mensagem</label>
            <RichTextEditor 
              value={newMessage} 
              onChange={setNewMessage} 
              placeholder="Detalhe mais informações aqui..."
            />
          </div>
          <div className="form-group" style={{ marginTop: '16px' }}>
            <label>Tags (separadas por vírgula)</label>
            <input 
              type="text" 
              className="form-control" 
              value={newTags} 
              onChange={e => setNewTags(e.target.value)} 
              placeholder="ex: duvida, vendas, operacional"
            />
          </div>
          <button type="submit" className="btn-primary" style={{ marginTop: '16px' }}>Publicar Tópico</button>
        </form>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Carregando comunidade...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {data?.items.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', background: 'var(--panel-bg)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              Nenhum tópico encontrado. Seja o primeiro a puxar um assunto!
            </div>
          )}
          {data?.items.map(post => (
            <div 
              key={post.id} 
              className="forum-post-card"
              style={{ padding: '20px', background: 'var(--panel-bg)', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer', transition: ' border-color 0.2s', display: 'flex', flexDirection: 'column', gap: '12px' }}
              onClick={() => navigate(`/painel/forum/${post.id}`)}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary-color)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
            >
              <h3 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '18px' }}>{post.title}</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {post.tags.map(tag => (
                  <span key={tag} style={{ background: 'rgba(255,191,0,0.1)', color: 'var(--primary-color)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                    #{tag}
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px' }}>
                <span title={post.author.email}>Autor: {post.author.name || 'Usuário'}</span>
                <span style={{ display: 'flex', gap: '16px' }}>
                  <span>{post.comments_count} comentários</span>
                  <span>{new Date(post.created_at).toLocaleDateString()}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getPost, getComments, createComment, deletePost, PostResponse, CommentResponse } from '../../api/network';
import { RichTextEditor } from '../../components/ui/RichTextEditor';

export const NetworkPostPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [post, setPost] = useState<PostResponse | null>(null);
  const [comments, setComments] = useState<CommentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [error, setError] = useState('');
  const [showReplyPanel, setShowReplyPanel] = useState(false);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const parent = await getPost(id);
      setPost(parent);
      const thr = await getComments(id);
      setComments(thr);
    } catch (e: any) {
      setError('Tópico não encontrado ou erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !id) return;

    try {
      await createComment(id, newComment);
      setNewComment('');
      setShowReplyPanel(false);
      loadData();
    } catch (e: any) {
      setError('Erro ao enviar a resposta.');
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!window.confirm("Deseja alterar a exclusão do tópico? Só funciona se não existir respostas.")) return;
    
    try {
      await deletePost(id);
      navigate('/painel/forum');
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Erro ao excluir o post.');
    }
  };

  if (loading) return (
    <div className="orcamentos-list">
      <div className="panel-skeleton" style={{ width: '100%', height: '200px' }} />
    </div>
  );
  
  if (!post) return <div className="panel-empty" style={{ marginTop: '40px' }}>{error || '404 - Post offline'}</div>;

  return (
    <>
      <div className="panel-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '12px', fontWeight: 600 }}>
        <button 
          onClick={() => navigate('/painel/forum')} 
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
        >
          Comunidade
        </button>
        <span style={{ color: 'var(--text-secondary)' }}>/</span>
        <span style={{ color: 'var(--ds-primary)' }}>Tópico</span>
      </div>

      <div className="panel-content__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ marginBottom: '8px' }}>{post.title}</h1>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {post.tags.map(tag => (
              <span key={tag} style={{ background: 'rgba(255,191,0,0.1)', color: 'var(--ds-primary)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                #{tag}
              </span>
            ))}
          </div>
        </div>
        {post.author_id === user?.id && post.comments_count === 0 && (
          <button onClick={handleDelete} className="ds-btn ds-btn-danger">
            Excluir Tópico
          </button>
        )}
      </div>

      <div className="panel-info-card" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '24px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', border: '1px solid var(--border-color)' }}>
              {post.author.name?.slice(0, 2).toUpperCase() || 'U'}
            </div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{post.author.name || post.author.email || 'Usuário'}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Publicado em {new Date(post.created_at).toLocaleDateString('pt-BR')} às {new Date(post.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
         </div>
         <div 
           style={{ padding: '24px', fontSize: '15px', lineHeight: '1.6', color: 'var(--ds-text)' }} 
           dangerouslySetInnerHTML={{ __html: post.message }} 
           className="rich-text-content" 
         />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
        {comments.map(c => (
          <div key={c.id} className="panel-info-card" style={{ marginLeft: post.author_id === c.author_id ? '0' : '32px', padding: 0 }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 24px', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,191,0,0.1)', color: 'var(--ds-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>
                  {c.author.name?.slice(0, 2).toUpperCase() || 'U'}
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{c.author.name || 'Usuário'}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {new Date(c.created_at).toLocaleDateString('pt-BR')} às {new Date(c.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
             </div>
             <div 
               style={{ padding: '20px 24px', fontSize: '14px', lineHeight: '1.6', color: 'var(--ds-text)' }} 
               dangerouslySetInnerHTML={{ __html: c.message }} 
               className="rich-text-content" 
             />
          </div>
        ))}
      </div>

      <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
        <button 
          className="ds-btn ds-btn-primary" 
          onClick={() => setShowReplyPanel(!showReplyPanel)}
        >
          {showReplyPanel ? 'Cancelar Resposta' : 'Responder ao Tópico'}
        </button>
      </div>

      {showReplyPanel && (
        <div className="panel-card" style={{ marginTop: '16px', background: 'var(--ds-surface)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="ds-card-header">
            <h4 style={{ margin: 0, fontSize: '16px' }}>Escrever Resposta</h4>
          </div>
          <div className="ds-card-body">
            <form onSubmit={handleReply}>
              <div className="ds-input-group" style={{ marginBottom: '16px' }}>
                <div style={{ background: 'var(--ds-surface-2)', borderRadius: 'var(--radius-md)' }}>
                   <RichTextEditor 
                     value={newComment} 
                     onChange={setNewComment} 
                     placeholder="Sua contribuição é muito importante..."
                   />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                 <button type="submit" className="ds-btn ds-btn-primary">Enviar Resposta</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};


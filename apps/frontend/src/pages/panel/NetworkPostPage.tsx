import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getPost, getComments, createComment, deletePost, PostResponse, CommentResponse } from '../../api/network';
import { RichTextEditor } from '../ui/RichTextEditor';

export const NetworkPostPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [post, setPost] = useState<PostResponse | null>(null);
  const [comments, setComments] = useState<CommentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [error, setError] = useState('');

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

  if (loading) return <div style={{ textAlign: 'center', padding: '40px' }}>Carregando tópico...</div>;
  if (!post) return <div style={{ textAlign: 'center', padding: '40px' }}>{error || '404 - Post offline'}</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <button onClick={() => navigate('/painel/forum')} className="btn-secondary" style={{ marginBottom: '24px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}>
          &larr; Voltar para Comunidade
        </button>
      </div>

      <div style={{ background: 'var(--panel-bg)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: '0 0 16px 0', color: 'var(--primary-color)' }}>{post.title}</h1>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {post.tags.map(tag => (
                <span key={tag} style={{ background: 'rgba(255,191,0,0.1)', color: 'var(--primary-color)', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                  #{tag}
                </span>
              ))}
            </div>
          </div>
          {post.author_id === user?.id && post.comments_count === 0 && (
            <button onClick={handleDelete} className="btn-danger" style={{ background: 'red', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Excluir</button>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
            {post.author.name?.slice(0, 2).toUpperCase() || 'U'}
          </div>
          <div>
            <div style={{ fontWeight: 'bold' }}>{post.author.name || post.author.email}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Publicado em {new Date(post.created_at).toLocaleString()}</div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }} dangerouslySetInnerHTML={{ __html: post.message }} className="rich-text-content" />
      </div>

      <h3 style={{ margin: '16px 0 0 0' }}>{post.comments_count} Respostas</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {comments.map(c => (
          <div key={c.id} style={{ background: 'var(--panel-bg)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '20px', marginLeft: post.author_id === c.author_id ? '0' : '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,191,0,0.2)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                {c.author.name?.slice(0, 2).toUpperCase() || 'U'}
              </div>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{c.author.name || 'Usuário'}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{new Date(c.created_at).toLocaleString()}</div>
              </div>
            </div>
            <div dangerouslySetInnerHTML={{ __html: c.message }} className="rich-text-content" />
          </div>
        ))}
      </div>

      <div style={{ marginTop: '32px', background: 'var(--panel-bg)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '24px' }}>
        <h4 style={{ margin: '0 0 16px 0' }}>Adicionar Resposta</h4>
        <form onSubmit={handleReply}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <RichTextEditor 
              value={newComment} 
              onChange={setNewComment} 
              placeholder="Sua resposta e conhecimento importam..."
            />
          </div>
          <button type="submit" className="btn-primary">Responder</button>
        </form>
      </div>
    </div>
  );
};


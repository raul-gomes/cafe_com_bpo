import React from 'react';
import type { MemberProfile, ProfileComment } from '../../api/network';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Textarea } from '../ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar';
import { Breadcrumb } from '../ui/Breadcrumb';
import { MemberLink } from './MemberLink';
import { useGoBack } from '../../lib/useGoBack';
import { ArrowLeft, Trash2 } from 'lucide-react';

function formatMemberSince(dateStr: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(
    new Date(dateStr)
  );
}

function formatCommentDateTime(dateStr: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(dateStr));
}

function getInitials(name?: string | null) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0]?.slice(0, 2).toUpperCase() || 'U';
}

interface MemberProfileViewProps {
  profile: MemberProfile;
  comments: ProfileComment[];
  isLoadingComments?: boolean;
  currentUserId?: string | null;
  isSubmitting?: boolean;
  isDeleting?: boolean;
  onSubmitComment?: (message: string) => void | Promise<void>;
  onDeleteComment?: (commentId: string) => void;
}

export const MemberProfileView: React.FC<MemberProfileViewProps> = ({
  profile,
  comments,
  isLoadingComments = false,
  currentUserId,
  isSubmitting = false,
  isDeleting = false,
  onSubmitComment,
  onDeleteComment,
}) => {
  const goBack = useGoBack('/painel/forum');
  const [commentText, setCommentText] = React.useState('');

  const canComment = Boolean(profile.can_comment && !profile.is_owner);
  const showOwnerNotice = profile.is_owner;

  const canDeleteComment = (comment: ProfileComment) => {
    if (!currentUserId) return false;
    return comment.can_delete || comment.author_id === currentUserId;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = commentText.trim();
    if (!message || !onSubmitComment) return;
    await onSubmitComment(message);
    setCommentText('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={goBack}
          aria-label="Voltar"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <Breadcrumb
          items={[
            { label: 'Comunidade', to: '/painel/forum' },
            { label: profile.name || 'Perfil do membro' },
          ]}
        />
      </div>

      <Card className="p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <Avatar className="size-16">
              {profile.avatar_url ? (
                <AvatarImage
                  src={profile.avatar_url}
                  alt={profile.name || 'Membro'}
                />
              ) : null}
              <AvatarFallback>{getInitials(profile.name)}</AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {profile.name || 'Membro da Comunidade'}
              </h1>
              {profile.company_name && (
                <p className="text-sm font-medium text-foreground">
                  {profile.company_name}
                </p>
              )}
              {(profile.company_city || profile.company_state) && (
                <p className="text-sm text-muted-foreground">
                  {profile.company_city}
                  {profile.company_city && profile.company_state ? ' • ' : ''}
                  {profile.company_state}
                </p>
              )}
              {profile.company_segment && (
                <p className="text-sm text-muted-foreground">
                  Segmento: {profile.company_segment}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Membro desde {formatMemberSince(profile.created_at)}
              </p>
            </div>
          </div>
        </div>

        {profile.biografia && (
          <div className="mt-6 space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Sobre
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
              {profile.biografia}
            </p>
          </div>
        )}

        {profile.skills.length > 0 && (
          <div className="mt-6 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Habilidades
            </h2>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill) => (
                <span
                  key={skill.id}
                  className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary-strong"
                >
                  {skill.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Comentários sobre o trabalho</h2>
          <span className="text-sm text-muted-foreground">
            {profile.comments_count}{' '}
            {profile.comments_count === 1 ? 'comentário' : 'comentários'}
          </span>
        </div>

        {canComment && onSubmitComment && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <Textarea
              placeholder="Compartilhe sua experiência sobre o trabalho deste membro..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={3}
              maxLength={2000}
              disabled={isSubmitting}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Seu comentário é publicado na hora e é visível para a comunidade.
              </p>
              <Button
                type="submit"
                disabled={isSubmitting || !commentText.trim()}
              >
                {isSubmitting ? 'Publicando...' : 'Comentar'}
              </Button>
            </div>
          </form>
        )}

        {showOwnerNotice && (
          <div className="mt-4 rounded-md border border-muted bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            Este é o seu perfil. Você não pode comentar no próprio perfil.
          </div>
        )}

        <div className="mt-6 space-y-4">
          {isLoadingComments ? (
            <p className="text-sm text-muted-foreground">
              Carregando comentários...
            </p>
          ) : comments.length > 0 ? (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="rounded-lg border border-border bg-background p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="size-9">
                      {comment.author?.avatar_url ? (
                        <AvatarImage
                          src={comment.author.avatar_url}
                          alt={comment.author.name || 'Autor'}
                        />
                      ) : null}
                      <AvatarFallback>
                        {getInitials(comment.author?.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        <MemberLink
                          memberId={comment.author_id}
                          name={comment.author?.name}
                          className="font-medium"
                        />
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCommentDateTime(comment.created_at)}
                      </p>
                    </div>
                  </div>
                  {canDeleteComment(comment) && onDeleteComment && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDeleteComment(comment.id)}
                      disabled={isDeleting}
                      aria-label="Excluir comentário"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
                <div className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-foreground">
                  {comment.message}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Ainda não há comentários sobre o trabalho deste membro.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
};

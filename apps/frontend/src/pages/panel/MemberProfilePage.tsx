import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import {
  getMemberProfile,
  getProfileComments,
  createProfileComment,
  deleteProfileComment,
} from '../../api/network';
import { MemberProfileView } from '../../components/network/MemberProfileView';
import { useGoBack } from '../../lib/useGoBack';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

export const MemberProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const goBack = useGoBack('/painel/forum');
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: profile,
    isLoading: loadingProfile,
    isError: errorProfile,
  } = useQuery({
    queryKey: ['member-profile', userId],
    queryFn: () => getMemberProfile(userId!),
    enabled: Boolean(userId),
  });

  const {
    data: commentsData,
    isLoading: loadingComments,
  } = useQuery({
    queryKey: ['profile-comments', userId],
    queryFn: () => getProfileComments(userId!),
    enabled: Boolean(userId),
  });

  const createComment = useMutation({
    mutationFn: (message: string) => createProfileComment(userId!, message),
    onSuccess: () => {
      toast.success('Comentário publicado.');
      queryClient.invalidateQueries({ queryKey: ['profile-comments', userId] });
      queryClient.invalidateQueries({ queryKey: ['member-profile', userId] });
    },
    onError: () => {
      toast.error('Não foi possível publicar o comentário.');
    },
  });

  const deleteComment = useMutation({
    mutationFn: (commentId: string) => deleteProfileComment(commentId),
    onSuccess: () => {
      toast.success('Comentário excluído.');
      queryClient.invalidateQueries({ queryKey: ['profile-comments', userId] });
      queryClient.invalidateQueries({ queryKey: ['member-profile', userId] });
    },
    onError: () => {
      toast.error('Não foi possível excluir o comentário.');
    },
  });

  if (loadingProfile) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Carregando perfil...</p>
      </div>
    );
  }

  if (errorProfile || !profile) {
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
              { label: 'Perfil do membro' },
            ]}
          />
        </div>
        <Card className="p-6 text-center">
          <h2 className="text-lg font-semibold">Membro não encontrado</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O perfil solicitado não foi encontrado ou não está disponível.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <MemberProfileView
      profile={profile}
      comments={commentsData?.items ?? []}
      isLoadingComments={loadingComments}
      currentUserId={user?.id ?? null}
      isSubmitting={createComment.isPending}
      isDeleting={deleteComment.isPending}
      onSubmitComment={(message) => createComment.mutateAsync(message).then(() => undefined)}
      onDeleteComment={(commentId) => deleteComment.mutate(commentId)}
    />
  );
};

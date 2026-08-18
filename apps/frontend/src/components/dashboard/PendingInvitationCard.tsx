import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Check, X } from 'lucide-react';
import { PendingInvitation } from '../../api/hooks/useDashboard';
import { acceptInvitationById, declineInvitationById } from '../../api/team';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Alert } from '../ui/alert';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PendingInvitationCardProps {
  invitation: PendingInvitation;
}

export const PendingInvitationCard: React.FC<PendingInvitationCardProps> = ({ invitation }) => {
  const queryClient = useQueryClient();
  const [error, setError] = React.useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
  };

  const accept = useMutation({
    mutationFn: () => acceptInvitationById(invitation.invitation_id),
    onSuccess: invalidate,
    onError: (e: any) => setError(e.response?.data?.detail || 'Erro ao aceitar o convite.'),
  });

  const decline = useMutation({
    mutationFn: () => declineInvitationById(invitation.invitation_id),
    onSuccess: invalidate,
    onError: (e: any) => setError(e.response?.data?.detail || 'Erro ao recusar o convite.'),
  });

  return (
    <Card className="border-l-4 border-l-primary p-5 mb-10">
      <CardContent className="p-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
              <UserPlus size={22} className="text-primary-strong" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-foreground mb-1">
                Você foi chamado(a) para uma equipe!
              </h3>
              <p className="text-[13px] text-muted-foreground">
                {invitation.inviter_name ? (
                  <><strong className="text-foreground">{invitation.inviter_name}</strong> convidou você para fazer parte da equipe de </>
                ) : (
                  'Você foi convidado para fazer parte da equipe de '
                )}
                {invitation.client_name ? (
                  <strong className="text-foreground">{invitation.client_name}</strong>
                ) : (
                  'um cliente'
                )}
                .
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Convite enviado {formatDistanceToNow(new Date(invitation.created_at), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              onClick={() => accept.mutate()}
              disabled={accept.isPending || decline.isPending}
            >
              <Check size={15} /> Aceitar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => decline.mutate()}
              disabled={accept.isPending || decline.isPending}
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <X size={15} /> Recusar
            </Button>
          </div>
        </div>

        {error && <Alert variant="destructive" className="mt-4">{error}</Alert>}
      </CardContent>
    </Card>
  );
};

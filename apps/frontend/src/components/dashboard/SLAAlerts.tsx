import React from 'react';
import { AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { useTasks } from '../../api/hooks/useTasks';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';

export const SLAAlerts: React.FC = () => {
  const { useSLAAlerts } = useTasks();
  const { data: alerts, isLoading, refetch } = useSLAAlerts();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-[50px]" />
        <Skeleton className="h-[50px]" />
      </div>
    );
  }

  if (!alerts || (alerts.total_overdue === 0 && alerts.total_warning === 0)) {
    return (
      <Card className="p-0">
        <CardContent className="flex flex-col items-center py-5">
          <div className="text-2xl mb-2">✅</div>
          <p className="text-sm text-muted-foreground">Nenhum alerta de SLA. Todas as tarefas estão em dia!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-sm font-bold">🚨 Alertas de SLA</h3>
        <Button variant="ghost" size="icon-xs" onClick={() => refetch()} title="Atualizar">
          <RefreshCw size={14} />
        </Button>
      </div>

      {/* Overdue alerts */}
      {alerts.overdue.map((alert: { message: string; tasks: { title: string }[] }, idx: number) => (
        <Card
          key={`overdue-${idx}`}
          className="p-3 cursor-pointer transition-all bg-red-500/5 border-red-500/15 hover:bg-red-500/10"
          onClick={() => navigate('/painel/tarefas')}
        >
          <CardContent className="p-0 flex gap-2.5 items-start">
            <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-[13px] text-red-500">{alert.message}</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {alert.tasks.map(t => t.title).join(', ')}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Warning alerts */}
      {alerts.warning.map((alert: { message: string; tasks: { title: string }[] }, idx: number) => (
        <Card
          key={`warning-${idx}`}
          className="p-3 cursor-pointer transition-all bg-amber-500/5 border-amber-500/15 hover:bg-amber-500/10"
          onClick={() => navigate('/painel/tarefas')}
        >
          <CardContent className="p-0 flex gap-2.5 items-start">
            <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-[13px] text-amber-500">{alert.message}</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {alert.tasks.map(t => t.title).join(', ')}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

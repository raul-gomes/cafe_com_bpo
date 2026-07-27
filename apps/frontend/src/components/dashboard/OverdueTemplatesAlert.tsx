import React from 'react';
import { AlertTriangle, FileText, RefreshCw } from 'lucide-react';
import { useTasks } from '../../api/hooks/useTasks';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';

const RECURRENCE_LABELS: Record<string, string> = {
  once: 'Uma vez',
  daily: 'Diário',
  weekly: 'Semanal',
  monthly: 'Mensal',
  yearly: 'Anual',
};

export const OverdueTemplatesAlert: React.FC = () => {
  const { useOverdueTemplates } = useTasks();
  const { data: templates, isLoading, refetch } = useOverdueTemplates();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-[50px]" />
        <Skeleton className="h-[50px]" />
      </div>
    );
  }

  if (!templates || templates.length === 0) {
    return (
      <Card className="p-0">
        <CardContent className="flex flex-col items-center py-5">
          <div className="text-2xl mb-2">✅</div>
          <p className="text-sm text-muted-foreground">Nenhum template vencido. Tudo atualizado!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-sm font-bold">📋 Templates Vencidos</h3>
        <Button variant="ghost" size="icon-xs" onClick={() => refetch()} title="Atualizar">
          <RefreshCw size={14} />
        </Button>
      </div>

      {templates.map((tmpl) => (
        <Card
          key={tmpl.id}
          className="p-3 cursor-pointer transition-all border-amber-500/15 hover:bg-amber-500/5"
          onClick={() => navigate('/painel/templates')}
        >
          <CardContent className="p-0 flex gap-2.5 items-start">
            <FileText size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[13px] text-amber-600 dark:text-amber-400 truncate">
                {tmpl.name}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1">
                <span>{RECURRENCE_LABELS[tmpl.recurrence] || tmpl.recurrence}</span>
                <span>•</span>
                <span>{tmpl.activity_count} atividade{tmpl.activity_count !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 text-[12px] font-semibold text-destructive">
              <AlertTriangle size={12} />
              {tmpl.days_overdue}d
            </div>
          </CardContent>
        </Card>
      ))}

      {templates.length > 3 && (
        <Button
          variant="ghost"
          size="sm"
          className="text-[12px] text-muted-foreground"
          onClick={() => navigate('/painel/templates')}
        >
          Ver todos os {templates.length} templates vencidos →
        </Button>
      )}
    </div>
  );
};

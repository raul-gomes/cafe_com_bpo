/**
 * Helpers de prazo baseados em DATA DE CALENDÁRIO (não em instantes).
 *
 * Regra de negócio: o deadline é uma data — a tarefa só está atrasada
 * quando o dia do prazo já passou. "Vence hoje" nunca é "Atrasado".
 */

export const parseDeadlineDate = (value: string): Date => {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayDate = (): Date => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
};

export const daysOverdue = (deadline?: string | null): number => {
  if (!deadline) return 0;
  return Math.round((todayDate().getTime() - parseDeadlineDate(deadline).getTime()) / 86400000);
};

export const isDeadlineOverdue = (deadline?: string | null): boolean =>
  daysOverdue(deadline) > 0;

/** Agenda dos cafés: regras de data e canais onde o link do encontro é divulgado. */

/** Os encontros são sempre às 14h (horário de Brasília). */
export const HORARIO_CAFE = '14h';

/**
 * Próximo café aberto: a última quarta-feira do mês. Se a deste mês já passou
 * (o dia de hoje conta como "ainda vale"), devolve a do mês seguinte.
 */
export function proximoCafeAberto(hoje: Date): Date {
  const inicioDoDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  for (let offset = 0; offset < 3; offset++) {
    const candidato = ultimaQuarta(hoje.getFullYear(), hoje.getMonth() + offset);
    if (candidato >= inicioDoDia) return candidato;
  }
  return ultimaQuarta(hoje.getFullYear(), hoje.getMonth() + 1);
}

function ultimaQuarta(ano: number, mes: number): Date {
  const ultimoDia = new Date(ano, mes + 1, 0); // dia 0 do mês seguinte = último dia deste
  const recuo = (ultimoDia.getDay() - 3 + 7) % 7; // 3 = quarta-feira
  return new Date(ultimoDia.getFullYear(), ultimoDia.getMonth(), ultimoDia.getDate() - recuo);
}

export const CANAIS_CAFE = [
  {
    nome: 'Canal no WhatsApp',
    descricao: 'Avisos e o link de cada encontro.',
    url: 'https://whatsapp.com/channel/0029Va95EV54Y9lnz81xJH24',
    icone: 'mensagem',
  },
  {
    nome: 'Comunidade no YouTube',
    descricao: 'Gravações, materiais e o link dos encontros.',
    url: 'https://www.youtube.com/@cafecombpo/community',
    icone: 'encontro',
  },
  {
    nome: 'Página no LinkedIn',
    descricao: 'Novidades do movimento e o link dos encontros.',
    url: 'https://www.linkedin.com/showcase/caf%C3%A9-com-bpo/about/',
    icone: 'pessoas',
  },
] as const;

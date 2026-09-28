import { Briefcase, Handshake, Users } from 'lucide-react';
import { Card } from '../ui/card';

export interface ProjetoIndicadoresProps {
  /** Projetos em que o usuário é o dono. */
  criados: number;
  /** Projetos em que ele entrou como convidado (convite aceito). */
  participa: number;
  /** Propostas pendentes somando os projetos que ele cria. */
  aguardando: number;
}

const CARDS = [
  {
    chave: 'criados' as const,
    rotulo: 'Projetos que você criou',
    icone: Briefcase,
  },
  {
    chave: 'participa' as const,
    rotulo: 'Projetos que você participa',
    icone: Users,
  },
  {
    chave: 'aguardando' as const,
    rotulo: 'Propostas aguardando você',
    icone: Handshake,
  },
];

/** Resumo do topo da gestão de projetos: o dono vê na hora se tem proposta
 *  parada e se está em projeto de alguém mais. */
export function ProjetoIndicadores({
  criados,
  participa,
  aguardando,
}: ProjetoIndicadoresProps) {
  const valores = { criados, participa, aguardando };
  return (
    <div className="mb-5 grid gap-4 sm:grid-cols-3">
      {CARDS.map(({ chave, rotulo, icone: Icone }) => (
        <Card key={chave} className="flex items-center gap-3 p-4">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icone className="size-5" />
          </div>
          <div>
            <div className="text-[22px] font-extrabold leading-none text-foreground">
              {valores[chave]}
            </div>
            <div className="mt-1 text-[12px] text-muted-foreground">{rotulo}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}

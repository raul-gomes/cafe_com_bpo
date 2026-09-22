import React from 'react';

export const UnderConstructionPanelPage: React.FC = () => {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="text-6xl mb-6">🚧</div>
      <h1 className="text-2xl font-extrabold text-foreground mb-3">Em Construção</h1>
      <p className="max-w-[520px] text-sm leading-[1.6] text-muted-foreground">
        Nós não vendemos atalhos e processos de qualidade levam tempo. Esta área está sendo
        construída sob as fundações corretas.
      </p>
    </div>
  );
};
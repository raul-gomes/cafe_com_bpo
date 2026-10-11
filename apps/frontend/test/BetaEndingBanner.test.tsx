import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BetaEndingBanner } from '../src/components/panel/BetaEndingBanner';

/**
 * D12: o aviso no painel enquanto ainda há tempo para agir.
 *
 * A data é formatada em UTC de propósito: o backend grava `expires_at` em UTC
 * (meia-noite), e formatar no fuso do navegador daria 05/10 para um fim em
 * 06/10 — o mesmo instante contado em dias diferentes entre o e-mail e o
 * banner. O teste trava as duas metades dessa decisão.
 */

describe('BetaEndingBanner', () => {
  it('anuncia o fim do beta com a data em formato brasileiro', () => {
    render(<BetaEndingBanner expiresAt="2027-10-06T00:00:00Z" />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('06/10/2027');
    expect(alert).toHaveTextContent(/beta/i);
  });

  it('conta a data em UTC, não no fuso do navegador', () => {
    render(<BetaEndingBanner expiresAt="2027-10-06T00:00:00Z" />);

    expect(screen.getByRole('alert')).not.toHaveTextContent('05/10/2027');
  });
});

/**
 * useGeneratePDF.ts
 *
 * Hook para geração e download imediato do PDF da proposta comercial.
 * Usa @react-pdf/renderer no browser — sem backend, sem upload.
 *
 * O backend será acionado separadamente para persistir a proposta no BD
 * (endpoint /api/proposals — fase seguinte).
 */
import { useState, useCallback } from 'react';
import { pdf } from '@react-pdf/renderer';
import React from 'react';
import { ProposalDocument } from '../components/pdf/ProposalDocument';
import { PricingFormData } from '../schemas/pricing';
import { PricingResult } from './pricingEngine';

interface GeneratePDFOptions {
  form: PricingFormData;
  pricing: PricingResult;
  logoUrl: string;
  clientName?: string;
}

interface UseGeneratePDFReturn {
  generate: (opts: GeneratePDFOptions) => Promise<void>;
  isGenerating: boolean;
  error: string | null;
}

export function useGeneratePDF(): UseGeneratePDFReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (opts: GeneratePDFOptions) => {
    const { form, pricing, logoUrl, clientName = 'Cliente' } = opts;

    setIsGenerating(true);
    setError(null);

    try {
      // Renderiza o documento React como blob PDF
      const doc = React.createElement(ProposalDocument, {
        form,
        pricing,
        logoUrl,
        clientName,
        generatedAt: new Date().toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        }),
      });

      const blob = await pdf(doc as any).toBlob();

      // Gera o download automático no browser
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateSlug = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `proposta-bpo-${clientName.toLowerCase().replace(/\s+/g, '-')}-${dateSlug}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error('[useGeneratePDF] Error:', err);
      setError('Erro ao gerar o PDF. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { generate, isGenerating, error };
}

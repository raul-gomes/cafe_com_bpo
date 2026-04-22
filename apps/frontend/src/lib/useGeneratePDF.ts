/**
 * useGeneratePDF.ts
 *
 * Hook para geração e download imediato do PDF da proposta comercial.
 * Usa @react-pdf/renderer no browser — sem backend, sem upload.
 */
import { useState, useCallback } from 'react';
import { pdf } from '@react-pdf/renderer';
import React from 'react';
import { ProposalDocument } from '../components/pdf/ProposalDocument';
import { PricingFormData } from '../schemas/pricing';
import { PricingResult } from './pricingEngine';
import { getApiUrl } from '../api/client';

import { User } from '../context/AuthContext';

interface GeneratePDFOptions {
  form: PricingFormData;
  pricing: PricingResult;
  logoUrl: string;
  clientName?: string;
  clientEmail?: string;
  provider?: User | null;
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
    setIsGenerating(true);
    setError(null);

    try {
      const { form, pricing, logoUrl: inputUrl, clientName = 'Cliente', clientEmail = '', provider = null } = opts;

      // 1. Normalização da URL
      // Remove possíveis prefixos duplicados como "/apihttps://..." ou "/api/api/..."
      let logoUrl = inputUrl;
      
      // Se a URL contém "https://" ou "http://" em qualquer lugar, pegamos apenas a parte absoluta
      if (logoUrl.includes('http://') || logoUrl.includes('https://')) {
          const match = logoUrl.match(/https?:\/\/[^\s]+/);
          if (match) {
              logoUrl = match[0];
          }
      } else if (logoUrl.startsWith('/')) {
          // Se for um caminho relativo, garante que o prefixo da API está correto
          const apiBase = getApiUrl();
          if (!logoUrl.startsWith(apiBase)) {
              logoUrl = `${apiBase}${logoUrl}`;
          }
      }

      // 2. Compatibilidade Cloudinary -> PDF
      // O @react-pdf não aceita WEBP. Se for Cloudinary, forçamos a transformação para PNG.
      if (logoUrl.includes('cloudinary.com')) {
        // Força .png no final para garantir que o Cloudinary entregue um formato aceito pelo PDF
        // Remove extensões existentes e anexa .png
        logoUrl = logoUrl.replace(/\.(webp|jpg|jpeg|gif|png)$/i, '') + '.png';
        
        // Garante que não temos parâmetros conflitantes (como f_auto) que forçariam webp novamente
        if (!logoUrl.includes('/f_png')) {
            // Insere a transformação de formato logo após '/upload/' se existir
            logoUrl = logoUrl.replace('/upload/', '/upload/f_png/');
        }
      }

      console.log('[PDF] Gerando documento com logo final:', logoUrl);

      // Renderiza o documento React como blob PDF
      const doc = React.createElement(ProposalDocument, {
        form,
        pricing,
        logoUrl,
        clientName,
        clientEmail,
        provider,
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

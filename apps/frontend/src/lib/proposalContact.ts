/**
 * Who receives a proposal (e-mail / WhatsApp).
 *
 * The proposal points at its company by id (`company_id`), which may be a
 * client or a prospect. Matching by name picked the wrong record when two
 * companies shared a name and never found prospects (AUD-022). The name is
 * only a fallback for legacy proposals without a link, and only when exactly
 * one company has that name.
 */

interface CompanyContact {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  representante_nome?: string | null;
  representante_email?: string | null;
  representante_telefone?: string | null;
}

export interface ProposalContact {
  /** Who the message is addressed to (company name). */
  name: string;
  email: string | null;
  phone: string | null;
}

const normalize = (text: string): string => text.trim().toLowerCase();

/**
 * Resolves the recipient of a proposal.
 *
 * @param proposal The proposal (its link and the name typed on it).
 * @param clients The user's client companies.
 * @param prospects The user's prospects.
 * @returns The contact, or `null` when the linked company is not found.
 */
export function resolveProposalContact(
  proposal: { client_name: string; company_id?: string | null },
  clients: CompanyContact[],
  prospects: CompanyContact[],
): ProposalContact | null {
  const companies = [...clients, ...prospects];
  let company: CompanyContact | undefined;
  if (proposal.company_id) {
    company = companies.find(c => c.id === proposal.company_id);
  } else {
    const sameName = companies.filter(c => normalize(c.name) === normalize(proposal.client_name));
    company = sameName.length === 1 ? sameName[0] : undefined;
  }
  if (!company) return null;
  return {
    name: company.name,
    // A prospect often has only its representative's contact.
    email: company.email || company.representante_email || null,
    phone: company.phone || company.representante_telefone || null,
  };
}

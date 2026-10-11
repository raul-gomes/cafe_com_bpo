import React, { useEffect, useState } from 'react';

import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { MaskedInput } from '../ui/MaskedInput';
import { Skeleton } from '../ui/skeleton';
import { maskCEP, onlyNumbers } from '../../lib/formatters';
import {
    billingDataSchema,
    type BillingDataInput,
    type BillingProfile,
} from '../../schemas/subscription';

/**
 * Dados de cobrança do assinante (bloco do meio da seção Pagamentos).
 *
 * As máscaras produzem dígitos e o formulário valida a forma com
 * `billingDataSchema.safeParse` antes de chamar `onSave` — quem valida o dígito
 * verificador do CPF/CNPJ é o servidor (§17.3), não esta tela. Campos internos
 * não existem aqui: só o que o payload do checkout precisa.
 *
 * O estado local espelha o `profile` recebido para edição; `complement` vazio é
 * enviado como `null`, o default do servidor.
 */
interface BillingProfileFormProps {
    /** Perfil salvo, ou `null` quando o usuário nunca salvou (404 no GET). */
    profile: BillingProfile | null | undefined;
    /** `true` enquanto o perfil carrega — esqueleto no lugar do formulário. */
    isLoading: boolean;
    /** `true` enquanto o PUT está em voo — desabilita o botão. */
    isSaving: boolean;
    /** Mensagem de produto do backend (§17.8: o dígito verificador é validado
     *  no servidor e o erro de validação aparece no formulário). */
    apiError?: string | null;
    /** Grava o payload validado; o toast de sucesso é esperado do caller. */
    onSave: (data: BillingDataInput) => void;
}

export const BillingProfileForm: React.FC<BillingProfileFormProps> = ({
    profile,
    isLoading,
    isSaving,
    apiError,
    onSave,
}) => {
    const [cpfCnpj, setCpfCnpj] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [addressNumber, setAddressNumber] = useState('');
    const [complement, setComplement] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (profile) {
            setCpfCnpj(profile.cpf_cnpj);
            setPhone(profile.phone);
            setAddress(profile.address);
            setAddressNumber(profile.address_number);
            setComplement(profile.complement ?? '');
            setCity(profile.city);
            setState(profile.state);
            setPostalCode(profile.postal_code);
        }
    }, [profile]);

    const handleSubmit = () => {
        const parsed = billingDataSchema.safeParse({
            cpf_cnpj: cpfCnpj,
            phone,
            address: address.trim(),
            address_number: addressNumber.trim(),
            complement: complement.trim() || null,
            city: city.trim(),
            state: state.trim().toUpperCase(),
            postal_code: postalCode,
        });
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Revise os campos.');
            return;
        }
        setError(null);
        onSave(parsed.data);
    };

    if (isLoading) {
        return (
            <Card className="mb-4 p-6">
                <Skeleton className="mb-2 h-4 w-40" />
                <Skeleton className="h-3 w-72" />
            </Card>
        );
    }

    const cpfIsCnpj = cpfCnpj.length > 11;

    return (
        <Card className="mb-4 p-6">
            <h2 className="text-base font-semibold">Dados de cobrança</h2>
            <p className="mt-1 text-sm text-muted-foreground">
                Estas informações vão para a página de pagamento da Asaas quando você
                assina. O CPF/CNPJ é validado pelo documento na hora do checkout.
            </p>

            <div className="mt-4 grid gap-3 lg:grid-cols-4">
                <div className="flex flex-col gap-1 lg:col-span-2">
                    <Label htmlFor="billing-cpf-cnpj">CPF/CNPJ *</Label>
                    <MaskedInput
                        id="billing-cpf-cnpj"
                        value={cpfCnpj}
                        onChange={setCpfCnpj}
                        tipo={cpfIsCnpj ? 'cnpj' : 'cpf'}
                        placeholder={cpfIsCnpj ? '00.000.000/0000-00' : '000.000.000-00'}
                    />
                </div>
                <div className="flex flex-col gap-1 lg:col-span-2">
                    <Label htmlFor="billing-phone">Telefone *</Label>
                    <MaskedInput
                        id="billing-phone"
                        value={phone}
                        onChange={setPhone}
                        tipo="phone"
                    />
                </div>
                <div className="flex flex-col gap-1 lg:col-span-2">
                    <Label htmlFor="billing-address">Endereço *</Label>
                    <Input
                        id="billing-address"
                        value={address}
                        onChange={(event) => setAddress(event.target.value)}
                        placeholder="Rua, avenida, logradouro"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <Label htmlFor="billing-address-number">Número *</Label>
                    <Input
                        id="billing-address-number"
                        value={addressNumber}
                        onChange={(event) => setAddressNumber(event.target.value)}
                        inputMode="numeric"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <Label htmlFor="billing-complement">Complemento</Label>
                    <Input
                        id="billing-complement"
                        value={complement}
                        onChange={(event) => setComplement(event.target.value)}
                        placeholder="Apto, bloco"
                    />
                </div>
                <div className="flex flex-col gap-1 lg:col-span-2">
                    <Label htmlFor="billing-city">Cidade *</Label>
                    <Input
                        id="billing-city"
                        value={city}
                        onChange={(event) => setCity(event.target.value)}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <Label htmlFor="billing-state">UF *</Label>
                    <Input
                        id="billing-state"
                        value={state}
                        onChange={(event) =>
                            setState(event.target.value.replace(/[^A-Za-z]/, '').toUpperCase())
                        }
                        maxLength={2}
                        placeholder="SP"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <Label htmlFor="billing-postal-code">CEP *</Label>
                    <Input
                        id="billing-postal-code"
                        value={maskCEP(postalCode)}
                        onChange={(event) => setPostalCode(onlyNumbers(event.target.value))}
                        inputMode="numeric"
                        placeholder="00000-000"
                    />
                </div>
            </div>

            {error || apiError ? (
                <p className="mt-3 text-sm text-destructive">{apiError ?? error}</p>
            ) : null}

            <div className="mt-4 flex justify-end">
                <Button onClick={handleSubmit} disabled={isSaving} aria-label="Salvar dados">
                    Salvar
                </Button>
            </div>
        </Card>
    );
};
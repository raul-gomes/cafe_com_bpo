import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { ContractFieldDescriptor } from '../../api/contracts';
import { toast } from 'sonner';

export interface ContractFieldsModalProps {
  open: boolean;
  title: string;
  description?: string;
  descriptors: ContractFieldDescriptor[];
  initialValues?: Record<string, unknown>;
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
}

type FormState = Record<string, unknown>;

function groupDescriptors(descriptors: ContractFieldDescriptor[]) {
  const groups = new Map<string, ContractFieldDescriptor[]>();
  for (const descriptor of descriptors) {
    const group = descriptor.group || 'Outros dados';
    const list = groups.get(group) || [];
    list.push(descriptor);
    groups.set(group, list);
  }
  return [...groups.entries()];
}

function defaultRow(list: { key: string; kind?: string }[]): FormState {
  const row: FormState = {};
  for (const field of list) row[field.key] = '';
  return row;
}

function toInitialRows(
  descriptor: ContractFieldDescriptor,
  initialValues?: Record<string, unknown>,
): FormState[] {
  const saved = initialValues?.[descriptor.key];
  if (Array.isArray(saved) && saved.length) {
    return saved.map((item) => (typeof item === 'object' && item !== null ? { ...(item as FormState) } : {}));
  }
  const rows = Array.isArray(descriptor.rows) && descriptor.rows.length
    ? descriptor.rows.map((row) => ({ ...(row as FormState) }))
    : [];
  return rows;
}

const inputClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50';

const ScalarField: React.FC<{
  descriptor: ContractFieldDescriptor;
  value: unknown;
  onChange: (value: unknown) => void;
}> = ({ descriptor, value, onChange }) => {
  const kind = descriptor.kind || 'text';
  const current = value ?? descriptor.default ?? '';

  if (kind === 'select') {
    return (
      <select
        className={inputClass}
        value={String(current)}
        onChange={(e) => onChange(e.target.value)}
        id={`field-${descriptor.key}`}
        data-testid={`field-${descriptor.key}`}
      >
        {(descriptor.options || []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (kind === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(current)}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 accent-primary"
          id={`field-${descriptor.key}`}
        data-testid={`field-${descriptor.key}`}
        />
        Habilitado
      </label>
    );
  }

  if (kind === 'number') {
    return (
      <input
        type="number"
        className={inputClass}
        value={String(current ?? '')}
        onChange={(e) => onChange(e.target.value)}
        id={`field-${descriptor.key}`}
        data-testid={`field-${descriptor.key}`}
      />
    );
  }

  if (kind === 'date') {
    return (
      <input
        type="date"
        className={inputClass}
        value={String(current ?? '')}
        onChange={(e) => onChange(e.target.value)}
        id={`field-${descriptor.key}`}
        data-testid={`field-${descriptor.key}`}
      />
    );
  }

  if (kind === 'money') {
    const cents = typeof current === 'number' ? Math.round(current * 100) : 0;
    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-2.5 text-sm font-semibold text-muted-foreground">
          R$
        </span>
        <input
          type="text"
          inputMode="decimal"
          className={`${inputClass} pl-9`}
          value={cents > 0 ? (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
          placeholder="0,00"
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, '');
            const centavos = raw ? parseInt(raw.slice(0, 12), 10) : 0;
            onChange(centavos ? centavos / 100 : '');
          }}
          id={`field-${descriptor.key}`}
        data-testid={`field-${descriptor.key}`}
        />
      </div>
    );
  }

  return (
    <input
      type="text"
      className={inputClass}
      value={String(current ?? '')}
      onChange={(e) => onChange(e.target.value)}
      id={`field-${descriptor.key}`}
      data-testid={`field-${descriptor.key}`}
    />
  );
};

const ListField: React.FC<{
  descriptor: ContractFieldDescriptor;
  rows: FormState[];
  onChange: (rows: FormState[]) => void;
}> = ({ descriptor, rows, onChange }) => {
  const fields = descriptor.list_fields || [];
  const updateRow = (index: number, key: string, value: string) => {
    const next = rows.map((row, i) => (i === index ? { ...row, [key]: value } : row));
    onChange(next);
  };
  const addRow = () => onChange([...rows, defaultRow(fields)]);
  const removeRow = (index: number) => onChange(rows.filter((_, i) => i !== index));

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            {fields.map((field) => (
              <th
                key={field.key}
                className="border border-border bg-muted px-2 py-1.5 text-left text-xs font-semibold text-foreground"
              >
                {field.label}
              </th>
            ))}
            <th className="w-10 border border-border bg-muted px-1" aria-label="Ações" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={`row-${r}`}>
              {fields.map((field) => (
                <td key={field.key} className="border border-border px-1.5 py-1">
                  {field.kind === 'number' ? (
                    <input
                      type="number"
                      className={inputClass}
                      value={String(row[field.key] ?? '')}
                      onChange={(e) => updateRow(r, field.key, e.target.value)}
                      data-testid={`field-${descriptor.key}-${r}-${field.key}`}
                    />
                  ) : field.kind === 'date' ? (
                    <input
                      type="date"
                      className={inputClass}
                      value={String(row[field.key] ?? '')}
                      onChange={(e) => updateRow(r, field.key, e.target.value)}
                      data-testid={`field-${descriptor.key}-${r}-${field.key}`}
                    />
                  ) : (
                    <input
                      type="text"
                      className={inputClass}
                      value={String(row[field.key] ?? '')}
                      onChange={(e) => updateRow(r, field.key, e.target.value)}
                      data-testid={`field-${descriptor.key}-${r}-${field.key}`}
                    />
                  )}
                </td>
              ))}
              <td className="border border-border px-1.5 py-1 text-center">
                <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(r)}>
                  Remover
                </Button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={fields.length + 1} className="border border-border px-2 py-3 text-center text-xs text-muted-foreground">
                Nenhuma linha adicionada.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addRow}>
        + Adicionar linha
      </Button>
    </div>
  );
};

export const ContractFieldsModal: React.FC<ContractFieldsModalProps> = ({
  open,
  title,
  description,
  descriptors,
  initialValues,
  submitLabel = 'Salvar',
  onClose,
  onSubmit,
}) => {
  const [values, setValues] = useState<FormState>({});
  const [lists, setLists] = useState<Record<string, FormState[]>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next: FormState = {};
    const nextLists: Record<string, FormState[]> = {};
    for (const descriptor of descriptors) {
      if (descriptor.kind === 'list') {
        nextLists[descriptor.key] = toInitialRows(descriptor, initialValues);
      } else {
        next[descriptor.key] =
          initialValues?.[descriptor.key] ?? descriptor.default ?? '';
      }
    }
    setValues(next);
    setLists(nextLists);
    setSubmitting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setValue = (key: string, value: unknown) =>
    setValues((prev) => ({ ...prev, [key]: value }));
  const setList = (key: string, rows: FormState[]) =>
    setLists((prev) => ({ ...prev, [key]: rows }));

  const handleSubmit = async () => {
    const payload: FormState = {};
    for (const [key, value] of Object.entries(values)) {
      if (value === '' || value === null || value === undefined) continue;
      payload[key] = value;
    }
    for (const [key, rows] of Object.entries(lists)) {
      const filled = rows.filter((row) => Object.values(row).some((cell) => cell !== ''));
      if (filled.length > 0) payload[key] = filled;
    }
    try {
      setSubmitting(true);
      await onSubmit(payload);
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar os dados.');
    } finally {
      setSubmitting(false);
    }
  };

  const groups = groupDescriptors(descriptors);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="flex flex-col gap-6">
          {groups.map(([groupName, fields]) => (
            <div key={groupName} className="flex flex-col gap-3">
              <h3 className="border-b border-border pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {groupName}
              </h3>
              {fields.map((descriptor) =>
                descriptor.kind === 'list' ? (
                  <div key={descriptor.key} className="flex flex-col gap-1.5">
                    <Label>{descriptor.label}</Label>
                    {descriptor.hint && (
                      <span className="text-xs text-muted-foreground">{descriptor.hint}</span>
                    )}
                    <ListField
                      descriptor={descriptor}
                      rows={lists[descriptor.key] || []}
                      onChange={(rows) => setList(descriptor.key, rows)}
                    />
                  </div>
                ) : (
                  <div key={descriptor.key} className="flex flex-col gap-1.5">
                    <Label htmlFor={`field-${descriptor.key}`}>
                      {descriptor.label}
                      {descriptor.required && <span className="text-destructive"> *</span>}
                    </Label>
                    {descriptor.hint && (
                      <span className="text-xs text-muted-foreground">{descriptor.hint}</span>
                    )}
                    <ScalarField
                      descriptor={descriptor}
                      value={values[descriptor.key]}
                      onChange={(value) => setValue(descriptor.key, value)}
                    />
                  </div>
                ),
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} data-testid="save-contract-fields">
            {submitting ? 'Salvando...' : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
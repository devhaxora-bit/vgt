'use client';

import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { lorryHirePaymentSchema, type LorryHirePaymentInput } from '@/lib/schemas/lorryHire.schema';
import type { LorryHireChallan } from '@/lib/types/lorryHire.types';
import { roundMoney } from '@/lib/money';

const money = (v: number) => Number(v || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
export function LorryHirePaymentForm({ challan, paymentType, onSaved, onCancel }: {
    challan: LorryHireChallan;
    paymentType: LorryHirePaymentInput['payment_type'];
    onSaved: () => Promise<void>;
    onCancel?: () => void;
}) {
    const [error, setError] = useState('');
    const form = useForm<LorryHirePaymentInput>({ resolver: zodResolver(lorryHirePaymentSchema), defaultValues: {
        challan_id: challan.id, payment_type: paymentType,
        payment_date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
        amount: paymentType === 'BALANCE' ? challan.remaining : undefined,
        payment_mode: 'NEFT', paid_to: challan.broker_name || challan.owner_name || '', reference_no: '', bank_name: '', narration: '', deduction_items: [], addition_items: [],
    } });
    const deductions = useFieldArray({ control: form.control, name: 'deduction_items' });
    const additions = useFieldArray({ control: form.control, name: 'addition_items' });
    const values = useWatch({ control: form.control });
    const amount = Number(values.amount || 0);
    const deduction = roundMoney((values.deduction_items || []).reduce((sum, a) => sum + Number(a?.amount || 0), 0));
    const addition = roundMoney((values.addition_items || []).reduce((sum, a) => sum + Number(a?.amount || 0), 0));
    const net = roundMoney(amount + addition - deduction);
    const submit = form.handleSubmit(async input => {
        setError('');
        if (input.amount > challan.remaining) { setError('Amount exceeds remaining challan balance'); return; }
        if (net < 0) { setError('Deductions cannot exceed payment plus additions'); return; }
        try {
            const response = await fetch('/api/lorry-hire', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Could not record payment');
            form.reset(); await onSaved();
        } catch (e) { setError(e instanceof Error ? e.message : 'Could not record payment'); }
    });
    return <form onSubmit={submit} className="space-y-5">
        <p className="text-sm text-muted-foreground">
            {paymentType === 'ADVANCE'
                ? 'This updates the same Advance amount shown on the challan. For cash, bank and reference are optional.'
                : 'Record the remaining hire or extra charges. For cash, bank and reference are optional.'}
        </p>
        {paymentType === 'ADVANCE' && Number(challan.advance_amount) > 0 && (
            <p className="text-sm text-muted-foreground">Challan already has advance {money(Number(challan.advance_amount))}. Saving here will add to that same challan advance.</p>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2"><Label htmlFor="cbs-date">Payment date *</Label><Input id="cbs-date" type="date" {...form.register('payment_date')} /></div>
            <div className="space-y-2"><Label htmlFor="cbs-amount">{paymentType === 'ADVANCE' ? 'Advance paid' : 'Balance amount to settle'} *</Label><Input id="cbs-amount" type="number" min={paymentType === 'ADVANCE' ? '0.01' : '0'} max={challan.remaining} step="0.01" {...form.register('amount', { valueAsNumber: true })} /></div>
            <div className="space-y-2"><Label htmlFor="cbs-mode">Payment mode *</Label><Select value={values.payment_mode} onValueChange={v => form.setValue('payment_mode', v as LorryHirePaymentInput['payment_mode'])}><SelectTrigger id="cbs-mode"><SelectValue /></SelectTrigger><SelectContent>{['CASH','CHEQUE','NEFT','RTGS','UPI'].map(mode => <SelectItem key={mode} value={mode}>{mode}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="cbs-paid-to">Paid to *</Label><Input id="cbs-paid-to" {...form.register('paid_to')} /></div>
            <div className="space-y-2"><Label htmlFor="cbs-reference">Reference / UTR {values.payment_mode !== 'CASH' ? '*' : '(optional)'}</Label><Input id="cbs-reference" {...form.register('reference_no')} /></div>
            <div className="space-y-2"><Label htmlFor="cbs-bank">Bank {values.payment_mode !== 'CASH' ? '*' : '(optional)'}</Label><Input id="cbs-bank" {...form.register('bank_name')} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="cbs-description">Payment description *</Label><Input id="cbs-description" {...form.register('narration')} /></div>
        </div>
        {paymentType === 'BALANCE' && <div className="grid gap-5 md:grid-cols-2">{([{ name: 'addition_items', title: 'Additions', field: additions }, { name: 'deduction_items', title: 'Deductions', field: deductions }] as const).map(group => <div key={group.name} className="space-y-3">
            <div className="flex items-center justify-between gap-2"><h3 className="font-medium">{group.title} (optional)</h3><Button type="button" variant="outline" size="sm" disabled={group.field.fields.length >= 30} onClick={() => group.field.append({ label: '', amount: 0 })}>Add item</Button></div>
            {group.field.fields.map((field, index) => <div key={field.id} className="flex flex-wrap gap-2">
                <Input className="min-w-32 flex-1" aria-label={`${group.title} description ${index + 1}`} placeholder="Description *" {...form.register(`${group.name}.${index}.label`)} />
                <Input className="w-28" aria-label={`${group.title} amount ${index + 1}`} type="number" min="0.01" step="0.01" placeholder="Amount *" {...form.register(`${group.name}.${index}.amount`, { valueAsNumber: true })} />
                <Button type="button" variant="ghost" onClick={() => group.field.remove(index)} aria-label={`Remove ${group.title.toLowerCase()} item ${index + 1}`}>Remove</Button>
            </div>)}
        </div>)}</div>}
        <div aria-live="polite" className="flex flex-wrap gap-x-8 gap-y-3 rounded-md bg-muted p-4 text-sm">
            <div>Amount applied<div className="font-semibold">{money(amount)}</div></div>{paymentType === 'BALANCE' && <><div>Additions<div className="font-semibold">+ {money(addition)}</div></div><div>Deductions<div className="font-semibold">− {money(deduction)}</div></div></>}<div>Final payment<div className="text-lg font-bold">{money(net)}</div></div><div>Balance after payment<div className="font-semibold">{money(roundMoney(challan.remaining - amount))}</div></div>
        </div>
        {paymentType === 'BALANCE' && <p className="text-xs text-muted-foreground">Final payment = balance amount + additions − deductions. For extra payments after clearing the hire balance, leave the balance amount at zero and enter the additions and reasons.</p>}
        {Object.keys(form.formState.errors).length > 0 && <p role="alert" className="text-sm text-destructive">{Object.values(form.formState.errors).map(e => e.message).filter(Boolean).join('. ') || 'Each adjustment requires a description and a positive amount.'}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            {onCancel && <Button type="button" variant="outline" disabled={form.formState.isSubmitting} onClick={onCancel}>Cancel</Button>}
            <Button disabled={form.formState.isSubmitting || net < 0} type="submit">{form.formState.isSubmitting ? 'Saving…' : `Record ${paymentType === 'ADVANCE' ? 'advance' : 'balance'} payment`}</Button>
        </div>
    </form>;
}

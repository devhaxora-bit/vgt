const roundMoney = (value: number) => Number(value.toFixed(2));

export type PaymentDeductionItem = {
    label: string;
    amount: number;
};

export type PaymentBillAllocation = {
    billing_record_id: string;
    received_amount: number;
    settled_amount: number;
    deduction_items: PaymentDeductionItem[];
};

export type PaymentReceiptSettlementRow = {
    id?: string;
    amount?: number | null;
    status?: string | null;
    related_billing_record_ids?: string[] | null;
    bill_allocations?: Array<{ billing_record_id?: string; settled_amount?: number | null }> | null;
};

const normalizeDeductionItems = (value: unknown): PaymentDeductionItem[] => {
    if (!Array.isArray(value)) return [];

    return value
        .map((item) => {
            const label = String((item as { label?: unknown })?.label || '').trim();
            const amount = Number((item as { amount?: unknown })?.amount || 0);

            if (!label || Number.isNaN(amount) || amount <= 0) return null;

            return {
                label,
                amount: roundMoney(amount),
            };
        })
        .filter((item): item is PaymentDeductionItem => item !== null);
};

export const normalizeBillAllocations = (value: unknown): PaymentBillAllocation[] => {
    if (!Array.isArray(value)) return [];

    return value
        .map((item) => {
            const billingRecordId = String((item as { billing_record_id?: unknown })?.billing_record_id || '').trim();
            const settledAmountInput = Number((item as { settled_amount?: unknown })?.settled_amount);
            const receivedAmountInput = Number((item as { received_amount?: unknown })?.received_amount || 0);
            const deductionItems = normalizeDeductionItems((item as { deduction_items?: unknown })?.deduction_items);
            const deductionTotal = roundMoney(deductionItems.reduce((sum, deduction) => sum + deduction.amount, 0));
            const settledAmount = !Number.isNaN(settledAmountInput)
                ? roundMoney(settledAmountInput)
                : roundMoney(receivedAmountInput + deductionTotal);
            const receivedAmount = roundMoney(settledAmount - deductionTotal);

            if (!billingRecordId || settledAmount <= 0 || receivedAmount < 0) return null;

            return {
                billing_record_id: billingRecordId,
                received_amount: receivedAmount,
                settled_amount: settledAmount,
                deduction_items: deductionItems,
            };
        })
        .filter((item): item is PaymentBillAllocation => item !== null);
};

export const buildSettledBillAmountMap = (
    paymentReceipts: PaymentReceiptSettlementRow[],
    excludeReceiptId?: string,
) => {
    const billSettledMap = new Map<string, number>();

    paymentReceipts
        .filter((receipt) => receipt.status === 'ACTIVE' && receipt.id !== excludeReceiptId)
        .forEach((receipt) => {
            if ((receipt.bill_allocations || []).length > 0) {
                receipt.bill_allocations?.forEach((allocation) => {
                    const billId = String(allocation.billing_record_id || '').trim();
                    if (!billId) return;

                    billSettledMap.set(
                        billId,
                        roundMoney((billSettledMap.get(billId) || 0) + Number(allocation.settled_amount || 0))
                    );
                });
                return;
            }

            if ((receipt.related_billing_record_ids || []).length === 1) {
                const billId = String(receipt.related_billing_record_ids?.[0] || '').trim();
                if (!billId) return;

                billSettledMap.set(
                    billId,
                    roundMoney((billSettledMap.get(billId) || 0) + Number(receipt.amount || 0))
                );
            }
        });

    return billSettledMap;
};

export const resolvePaymentAmounts = ({
    amount,
    actualReceivedAmount,
    allocations,
}: {
    amount: unknown;
    actualReceivedAmount: unknown;
    allocations: PaymentBillAllocation[];
}): { ok: true; amount: number; actualReceivedAmount: number } | { ok: false; error: string } => {
    let amountNum = Number(amount);
    let actualReceivedAmountNum = Number(actualReceivedAmount);

    if (allocations.length > 0) {
        amountNum = roundMoney(allocations.reduce((sum, allocation) => sum + allocation.settled_amount, 0));
        actualReceivedAmountNum = roundMoney(allocations.reduce((sum, allocation) => sum + allocation.received_amount, 0));
    } else {
        if (amount === null || amount === undefined || amount === '') {
            return { ok: false, error: 'amount is required' };
        }

        if (Number.isNaN(amountNum) || amountNum <= 0) {
            return { ok: false, error: 'amount must be a positive number' };
        }

        if (actualReceivedAmount === null || actualReceivedAmount === undefined || actualReceivedAmount === '') {
            actualReceivedAmountNum = amountNum;
        }
    }

    if (Number.isNaN(actualReceivedAmountNum) || actualReceivedAmountNum < 0) {
        return { ok: false, error: 'actual_received_amount must be zero or a positive number' };
    }

    if (actualReceivedAmountNum > amountNum) {
        return { ok: false, error: 'actual_received_amount cannot exceed the settled receipt amount' };
    }

    return { ok: true, amount: amountNum, actualReceivedAmount: actualReceivedAmountNum };
};

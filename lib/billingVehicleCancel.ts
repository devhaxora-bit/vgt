export interface BillingVehicleCancelItem {
    vehicle_no: string;
    from_station: string;
    to_station: string;
    cancellation_date: string;
    charges: number;
}

export interface BillingVehicleCancelDraftItem {
    id: string;
    vehicle_no: string;
    from_station: string;
    to_station: string;
    cancellation_date: string;
    charges: string;
}

const parseMoney = (value: unknown) => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const createEmptyVehicleCancelDraft = (): BillingVehicleCancelDraftItem => ({
    id: Math.random().toString(36).slice(2, 10),
    vehicle_no: '',
    from_station: '',
    to_station: '',
    cancellation_date: '',
    charges: '',
});

export const normalizeVehicleCancelItems = (value: unknown): BillingVehicleCancelItem[] => {
    if (!Array.isArray(value)) return [];

    return value.reduce<BillingVehicleCancelItem[]>((items, entry) => {
        const row = entry as Record<string, unknown>;
        const vehicleNo = String(row.vehicle_no || '').trim();
        const fromStation = String(row.from_station || '').trim();
        const toStation = String(row.to_station || '').trim();
        const cancellationDate = String(row.cancellation_date || '').slice(0, 10);
        const charges = roundMoney(parseMoney(row.charges));

        if (!vehicleNo && !fromStation && !toStation && !cancellationDate && charges <= 0) {
            return items;
        }

        items.push({
            vehicle_no: vehicleNo,
            from_station: fromStation,
            to_station: toStation,
            cancellation_date: cancellationDate,
            charges,
        });

        return items;
    }, []);
};

export const sumVehicleCancelCharges = (items: BillingVehicleCancelItem[]) =>
    roundMoney(items.reduce((sum, item) => sum + parseMoney(item.charges), 0));

export const vehicleCancelDraftToItems = (drafts: BillingVehicleCancelDraftItem[]): BillingVehicleCancelItem[] =>
    normalizeVehicleCancelItems(
        drafts.map((draft) => ({
            vehicle_no: draft.vehicle_no,
            from_station: draft.from_station,
            to_station: draft.to_station,
            cancellation_date: draft.cancellation_date,
            charges: draft.charges,
        }))
    );

export const vehicleCancelItemsToDrafts = (items: BillingVehicleCancelItem[]): BillingVehicleCancelDraftItem[] =>
    normalizeVehicleCancelItems(items).map((item) => ({
        id: Math.random().toString(36).slice(2, 10),
        vehicle_no: item.vehicle_no,
        from_station: item.from_station,
        to_station: item.to_station,
        cancellation_date: item.cancellation_date,
        charges: item.charges > 0 ? item.charges.toFixed(2) : '',
    }));

export const validateVehicleCancelDrafts = (drafts: BillingVehicleCancelDraftItem[]): string | null => {
    for (let index = 0; index < drafts.length; index += 1) {
        const draft = drafts[index];
        const hasAnyValue = Boolean(
            draft.vehicle_no.trim()
            || draft.from_station.trim()
            || draft.to_station.trim()
            || draft.cancellation_date
            || parseMoney(draft.charges) > 0
        );

        if (!hasAnyValue) continue;

        if (!draft.vehicle_no.trim()) {
            return `Vehicle number is required for vehicle cancellation line ${index + 1}`;
        }

        if (!draft.cancellation_date) {
            return `Cancellation date is required for vehicle cancellation line ${index + 1}`;
        }

        if (parseMoney(draft.charges) <= 0) {
            return `Cancellation charges must be greater than zero for line ${index + 1}`;
        }
    }

    return null;
};

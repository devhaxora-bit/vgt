type DbErrorLike = {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
};

/**
 * Maps Postgres / PostgREST party errors to short user-facing copy.
 * Never returns raw constraint or SQL text.
 */
export const friendlyPartyDbError = (
    error: DbErrorLike | null | undefined,
    context: 'create' | 'update' | 'delete' = 'create',
    extras?: { code?: string },
): { message: string; status: number } => {
    const raw = [error?.message, error?.details, error?.hint]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    const code = String(error?.code || '');

    const isRls =
        code === '42501'
        || /row-level security|unauthorized|permission denied|rls/i.test(raw);
    if (isRls) {
        return {
            message:
                context === 'delete'
                    ? 'You do not have permission to remove this party'
                    : context === 'update'
                        ? 'You do not have permission to update this party'
                        : 'You do not have permission to create a party for this branch',
            status: 403,
        };
    }

    const isDuplicate =
        code === '23505'
        || /duplicate key|unique constraint|already exists/i.test(raw);
    if (isDuplicate) {
        if (/gstin/i.test(raw)) {
            return {
                message: 'This GSTIN is already used by another party',
                status: 409,
            };
        }
        if (/code|parties_code/i.test(raw)) {
            const partyCode = extras?.code ? ` ${extras.code}` : '';
            return {
                message: `Party code${partyCode} is already in use`,
                status: 409,
            };
        }
        return {
            message: 'A party with these details already exists',
            status: 409,
        };
    }

    if (/check constraint|violates check/i.test(raw)) {
        return {
            message: 'Some party details are invalid. Check the fields and try again',
            status: 400,
        };
    }

    if (/foreign key|violates foreign/i.test(raw)) {
        return {
            message: 'Related branch or reference is missing. Pick a valid branch and try again',
            status: 400,
        };
    }

    if (/not null|null value/i.test(raw)) {
        return {
            message: 'Required party fields are missing',
            status: 400,
        };
    }

    if (/value too long|too long for type/i.test(raw)) {
        return {
            message: 'One of the fields is too long. Shorten it and try again',
            status: 400,
        };
    }

    return {
        message:
            context === 'delete'
                ? 'Could not remove party. Please try again'
                : 'Could not save party. Please try again',
        status: 400,
    };
};

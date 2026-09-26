export type AuthLoginAttempt = {
    id: string;
    occurred_at: string;
    employee_code: string | null;
    role: string | null;
    success: boolean;
    failure_reason: string | null;
    user_id: string | null;
    user_name: string | null;
    user_code: string | null;
    ip_address: string | null;
    user_agent: string | null;
};

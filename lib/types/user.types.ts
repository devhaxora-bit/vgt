// User role types
export const USER_ROLES = ['admin', 'employee', 'agent'] as const;
export type UserRole = typeof USER_ROLES[number];

// User entity
export interface User {
    id: string;
    employee_code: string;
    full_name: string;
    role: UserRole;
    department: string | null;
    phone: string | null;
    is_active: boolean;
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

// User with auth email
export interface UserWithAuth extends User {
    email: string;
}

// User session
export interface UserSession {
    id: string;
    user_id: string;
    login_at: string;
    logout_at: string | null;
    ip_address: string | null;
    user_agent: string | null;
}

// API Response types
export type Result<T> =
    | { success: true; data: T }
    | { success: false; error: string };

// Create user input
export interface CreateUserInput {
    employee_code: string;
    full_name: string;
    email: string;
    password: string;
    role: UserRole;
    department?: string;
    phone?: string;
}

// Update user input
export interface UpdateUserInput {
    full_name?: string;
    department?: string;
    phone?: string;
    is_active?: boolean;
}

// Login input
export interface LoginInput {
    employee_code: string;
    password: string;
    role: UserRole;
    remember_me?: boolean;
}

// Login response
export interface LoginResponse {
    user: UserWithAuth;
    session: {
        access_token: string;
        refresh_token: string;
    };
}

import { z } from 'zod';
import { USER_ROLES, BRANCH_ACCESS_LEVELS } from '../types/user.types';

// User role schema
export const userRoleSchema = z.enum(USER_ROLES);
export const branchAccessSchema = z.enum(BRANCH_ACCESS_LEVELS);

// Create user schema
export const createUserSchema = z.object({
    employee_code: z.string()
        .min(3, 'Employee code must be at least 3 characters')
        .max(20, 'Employee code must be at most 20 characters')
        .regex(/^[A-Z0-9]+$/, 'Employee code must contain only uppercase letters and numbers'),
    full_name: z.string()
        .min(2, 'Full name must be at least 2 characters')
        .max(100, 'Full name must be at most 100 characters'),
    email: z.string()
        .email('Invalid email address')
        .toLowerCase(),
    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[@$!%*?&]/, 'Password must contain at least one special character'),
    role: userRoleSchema,
    department: z.string().max(50).optional(),
    phone: z.string()
        .regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number')
        .optional(),
    branch_access: branchAccessSchema.optional().default('global'),
    branch_code: z.string().max(10).nullable().optional(),
}).superRefine((value, ctx) => {
    if (value.branch_access === 'branch' && !String(value.branch_code || '').trim()) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['branch_code'],
            message: 'Branch code is required for branch-only access',
        });
    }
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

// Update user schema
export const updateUserSchema = z.object({
    full_name: z.string()
        .min(2, 'Full name must be at least 2 characters')
        .max(100, 'Full name must be at most 100 characters')
        .optional(),
    department: z.string().max(50).optional(),
    phone: z.string()
        .regex(/^\+?[0-9]{10,15}$/, 'Invalid phone number')
        .optional(),
    is_active: z.boolean().optional(),
    branch_access: branchAccessSchema.optional(),
    branch_code: z.string().max(10).nullable().optional(),
}).superRefine((value, ctx) => {
    if (value.branch_access === 'branch' && value.branch_code !== undefined && !String(value.branch_code || '').trim()) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['branch_code'],
            message: 'Branch code is required for branch-only access',
        });
    }
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// Login schema
export const loginSchema = z.object({
    employee_code: z.string()
        .min(1, 'Employee code is required'),
    password: z.string()
        .min(1, 'Password is required'),
    role: userRoleSchema,
    remember_me: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

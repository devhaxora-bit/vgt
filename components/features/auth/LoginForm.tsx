'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Loader2, Mail, Lock, Shield } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { loginSchema, type LoginInput } from '@/lib/schemas/user.schema';

export function LoginForm() {
    const router = useRouter();
    const [isLoading, setIsLoading] = React.useState(false);

    const form = useForm<LoginInput>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            employee_code: '',
            password: '',
            role: 'employee',
            remember_me: false,
        },
    });

    async function onSubmit(values: LoginInput) {
        setIsLoading(true);
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(values),
            });

            const result = await response.json();

            if (!result.success) {
                toast.error(result.error || 'Invalid credentials');
                return;
            }

            toast.success('Welcome back!');

            // Redirect based on role
            if (values.role === 'admin') {
                router.push('/dashboard');
            } else {
                router.push('/entry');
            }
        } catch (error) {
            toast.error('Something went wrong. Please try again.');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="space-y-2 text-center lg:text-left">
                <h2 className="text-2xl font-bold tracking-tight text-[#101828]">
                    Welcome Back
                </h2>
                <p className="text-sm text-[#475467]">
                    Sign in to access your VGT dashboard
                </p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                    {/* Employee Code */}
                    <FormField
                        control={form.control}
                        name="employee_code"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[#101828] text-sm font-medium">
                                    Employee ID
                                </FormLabel>
                                <FormControl>
                                    <div className="relative group">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#475467] group-focus-within:text-[#FF6154] transition-colors" />
                                        <Input
                                            placeholder="Enter your employee ID"
                                            className="pl-10 h-12 bg-[#F2F4F7] border-[#EAECF0] text-[#101828] placeholder:text-[#475467] focus:bg-white focus:border-[#FF6154] transition-all input-glow rounded-full"
                                            {...field}
                                        />
                                    </div>
                                </FormControl>
                                <FormMessage className="text-[#FF6154]" />
                            </FormItem>
                        )}
                    />

                    {/* Password */}
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[#101828] text-sm font-medium">
                                    Password
                                </FormLabel>
                                <FormControl>
                                    <div className="relative group">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#475467] group-focus-within:text-[#FF6154] transition-colors" />
                                        <Input
                                            type="password"
                                            placeholder="Enter your password"
                                            className="pl-10 h-12 bg-[#F2F4F7] border-[#EAECF0] text-[#101828] placeholder:text-[#475467] focus:bg-white focus:border-[#FF6154] transition-all input-glow rounded-full"
                                            {...field}
                                        />
                                    </div>
                                </FormControl>
                                <FormMessage className="text-[#FF6154]" />
                            </FormItem>
                        )}
                    />

                    {/* Role Selection */}
                    <FormField
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[#101828] text-sm font-medium">
                                    Role
                                </FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <div className="relative group">
                                            <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#475467] z-10 pointer-events-none" />
                                            <SelectTrigger className="pl-10 h-12 bg-[#F2F4F7] border-[#EAECF0] text-[#101828] focus:bg-white focus:border-[#FF6154] transition-all rounded-full">
                                                <SelectValue placeholder="Select your role" />
                                            </SelectTrigger>
                                        </div>
                                    </FormControl>
                                    <SelectContent className="bg-white border-[#EAECF0] rounded-xl">
                                        <SelectItem value="employee" className="text-[#101828] focus:bg-[#F2F4F7] focus:text-[#101828] rounded-lg">
                                            Employee
                                        </SelectItem>
                                        <SelectItem value="agent" className="text-[#101828] focus:bg-[#F2F4F7] focus:text-[#101828] rounded-lg">
                                            Agent
                                        </SelectItem>
                                        <SelectItem value="admin" className="text-[#101828] focus:bg-[#F2F4F7] focus:text-[#101828] rounded-lg">
                                            Admin
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage className="text-[#FF6154]" />
                            </FormItem>
                        )}
                    />

                    {/* Remember Me & Forgot Password */}
                    <div className="flex items-center justify-between">
                        <FormField
                            control={form.control}
                            name="remember_me"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            className="border-[#EAECF0] data-[state=checked]:bg-[#FF6154] data-[state=checked]:border-[#FF6154]"
                                        />
                                    </FormControl>
                                    <FormLabel className="text-sm font-normal text-[#475467] cursor-pointer">
                                        Remember me
                                    </FormLabel>
                                </FormItem>
                            )}
                        />

                        <button
                            type="button"
                            className="text-sm text-[#FF6154] hover:text-[#FF7B6D] transition-colors font-medium"
                        >
                            Forgot password?
                        </button>
                    </div>

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        className="w-full h-12 text-base font-semibold bg-white text-[#FF6154] hover:bg-[#FFF0EF] transition-all shadow-lg hover:shadow-xl border border-[#FF6154] rounded-full"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Signing in...
                            </>
                        ) : (
                            'Sign In'
                        )}
                    </Button>

                    {/* Sign Up Link */}
                    <p className="text-center text-sm text-[#475467]">
                        Don't have an account?{' '}
                        <button
                            type="button"
                            className="text-[#FF6154] hover:text-[#FF7B6D] font-medium transition-colors"
                        >
                            Request Access
                        </button>
                    </p>
                </form>
            </Form>
        </div>
    );
}

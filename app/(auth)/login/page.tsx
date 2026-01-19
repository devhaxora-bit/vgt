import AuthLayout from '@/components/layouts/AuthLayout';
import { LoginForm } from '@/components/features/auth/LoginForm';

export const metadata = {
    title: 'Login - VGT Transport Management',
    description: 'Sign in to VGT Transport Management System',
};

export default function LoginPage() {
    return (
        <AuthLayout>
            <LoginForm />
        </AuthLayout>
    );
}

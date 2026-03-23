'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function EditConsignmentPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();

    React.useEffect(() => {
        router.replace(`/dashboard/consignments/new?edit=${params.id}`);
    }, [params.id, router]);

    return (
        <div className="p-6">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Opening CNS entry form...
            </div>
        </div>
    );
}

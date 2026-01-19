import { createClient } from '@/utils/supabase/server';

export default async function Notes() {
    const supabase = await createClient();
    const { data: notes } = await supabase.from("notes").select();

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Notes from Supabase</h1>
            <pre className="bg-gray-100 p-4 rounded-lg overflow-auto">
                {JSON.stringify(notes, null, 2)}
            </pre>
        </div>
    );
}

export default function DocumentationLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
            {children}
        </div>
    );
}

'use client';

import * as React from 'react';
import { Search, Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { QuerySuggestion } from '@/lib/types/query.types';

interface QueryWorkbenchProps<TDetail> {
    placeholder: string;
    helperText?: string;
    searchSuggestions: (term: string) => Promise<QuerySuggestion[]>;
    loadDetail: (suggestion: QuerySuggestion) => Promise<TDetail>;
    renderResult: (detail: TDetail, helpers: { reset: () => void }) => React.ReactNode;
    /** Allow pressing Enter to submit raw typed text even without a suggestion. */
    allowFreeSubmit?: boolean;
    buildFreeSuggestion?: (term: string) => QuerySuggestion;
    emptyHint?: React.ReactNode;
    /** Keep emptyHint / previous layout visible while a record is loading. */
    keepLayout?: boolean;
    /**
     * Put a short search box inside the result layout (e.g. CN No cell).
     * When set, the large top search bar is hidden.
     */
    renderEmbedded?: (args: {
        search: React.ReactNode;
        detail: TDetail | null;
        reset: () => void;
        loading: boolean;
        error: string | null;
    }) => React.ReactNode;
}

export function QueryWorkbench<TDetail>({
    placeholder,
    helperText,
    searchSuggestions,
    loadDetail,
    renderResult,
    allowFreeSubmit = false,
    buildFreeSuggestion,
    emptyHint,
    keepLayout = false,
    renderEmbedded,
}: QueryWorkbenchProps<TDetail>) {
    const [term, setTerm] = React.useState('');
    const debouncedTerm = useDebounce(term, 250);
    const [suggestions, setSuggestions] = React.useState<QuerySuggestion[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = React.useState(false);
    const [open, setOpen] = React.useState(false);
    const [activeIndex, setActiveIndex] = React.useState(-1);

    const [detail, setDetail] = React.useState<TDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const inputRef = React.useRef<HTMLInputElement>(null);
    const requestId = React.useRef(0);
    const embedded = Boolean(renderEmbedded);

    React.useEffect(() => {
        let cancelled = false;
        const query = debouncedTerm.trim();
        if (query.length < 1) {
            setSuggestions([]);
            setLoadingSuggestions(false);
            return;
        }
        setLoadingSuggestions(true);
        searchSuggestions(query)
            .then((rows) => {
                if (cancelled) return;
                setSuggestions(rows);
                setActiveIndex(rows.length > 0 ? 0 : -1);
            })
            .catch(() => {
                if (!cancelled) setSuggestions([]);
            })
            .finally(() => {
                if (!cancelled) setLoadingSuggestions(false);
            });
        return () => {
            cancelled = true;
        };
    }, [debouncedTerm, searchSuggestions]);

    const handleSelect = React.useCallback(
        async (suggestion: QuerySuggestion) => {
            setOpen(false);
            setTerm(suggestion.primary);
            setError(null);
            setLoadingDetail(true);
            if (!keepLayout && !embedded) setDetail(null);
            const currentRequest = ++requestId.current;
            try {
                const result = await loadDetail(suggestion);
                if (requestId.current === currentRequest) setDetail(result);
            } catch (err) {
                if (requestId.current === currentRequest) {
                    setError(err instanceof Error ? err.message : 'Could not load this record.');
                    if (embedded || keepLayout) setDetail(null);
                }
            } finally {
                if (requestId.current === currentRequest) setLoadingDetail(false);
            }
        },
        [loadDetail, keepLayout, embedded],
    );

    const reset = React.useCallback(() => {
        setDetail(null);
        setError(null);
        setTerm('');
        setSuggestions([]);
        setActiveIndex(-1);
        requestAnimationFrame(() => inputRef.current?.focus());
    }, []);

    const submitCurrent = () => {
        if (activeIndex >= 0 && suggestions[activeIndex]) {
            void handleSelect(suggestions[activeIndex]);
        } else if (allowFreeSubmit && buildFreeSuggestion && term.trim()) {
            void handleSelect(buildFreeSuggestion(term.trim()));
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex((prev) => Math.max(prev - 1, 0));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            submitCurrent();
        } else if (event.key === 'Escape') {
            setOpen(false);
        }
    };

    const showDropdown = open && term.trim().length > 0;

    const searchControl = (
        <div className={cn('relative', embedded ? 'w-[168px] min-w-[140px]' : 'w-full max-w-md')}>
            <div className="relative flex items-center">
                <Search className={cn('pointer-events-none absolute left-2 text-muted-foreground', embedded ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
                <Input
                    ref={inputRef}
                    value={term}
                    onChange={(e) => {
                        setTerm(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => window.setTimeout(() => setOpen(false), 150)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className={cn(
                        'border font-medium shadow-none focus-visible:ring-1',
                        embedded
                            ? 'h-7 rounded pl-6 pr-8 text-[11px]'
                            : 'h-8 rounded-md pl-8 pr-20 text-sm',
                    )}
                    autoComplete="off"
                    spellCheck={false}
                />
                <div className="absolute right-1 flex items-center gap-0.5">
                    {loadingSuggestions ? (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    ) : null}
                    {embedded ? (
                        <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 rounded p-0"
                            disabled={!term.trim()}
                            onClick={submitCurrent}
                            aria-label="Search"
                        >
                            <ArrowRight className="h-3 w-3" />
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            size="sm"
                            className="h-6 gap-1 rounded px-2 text-[11px]"
                            disabled={!term.trim()}
                            onClick={submitCurrent}
                        >
                            Go <ArrowRight className="h-3 w-3" />
                        </Button>
                    )}
                </div>
            </div>

            {showDropdown ? (
                <div className="absolute z-30 mt-1 w-[min(280px,70vw)] overflow-hidden rounded-md border bg-popover shadow-lg">
                    {loadingSuggestions && suggestions.length === 0 ? (
                        <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
                        </div>
                    ) : suggestions.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                            {allowFreeSubmit ? `No match — press Enter for “${term.trim()}”.` : 'No matching records.'}
                        </div>
                    ) : (
                        <ul className="max-h-64 overflow-y-auto py-0.5">
                            {suggestions.map((suggestion, index) => (
                                <li key={`${suggestion.value}-${index}`}>
                                    <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => void handleSelect(suggestion)}
                                        onMouseEnter={() => setActiveIndex(index)}
                                        className={cn(
                                            'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left transition-colors',
                                            index === activeIndex ? 'bg-accent' : 'hover:bg-accent/60',
                                        )}
                                    >
                                        <span className="flex min-w-0 flex-col">
                                            <span className="truncate text-xs font-semibold text-foreground">
                                                {suggestion.primary}
                                            </span>
                                            {suggestion.secondary ? (
                                                <span className="truncate text-[10px] text-muted-foreground">
                                                    {suggestion.secondary}
                                                </span>
                                            ) : null}
                                        </span>
                                        {suggestion.trailing ? (
                                            <span className="flex-shrink-0 font-mono text-[10px] font-semibold text-muted-foreground">
                                                {suggestion.trailing}
                                            </span>
                                        ) : null}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            ) : null}
        </div>
    );

    const errorBlock = error ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{error}</span>
        </div>
    ) : null;

    const loadingBlock = loadingDetail ? (
        <div className="flex items-center gap-2 rounded-md border border-dashed px-2 py-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Filling values…
        </div>
    ) : null;

    if (renderEmbedded) {
        return (
            <div className="space-y-2">
                {errorBlock}
                {loadingBlock}
                {renderEmbedded({
                    search: searchControl,
                    detail,
                    reset,
                    loading: loadingDetail,
                    error,
                })}
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
                {searchControl}
                {helperText && !detail && !loadingDetail && !error ? (
                    <p className="text-[11px] text-muted-foreground">{helperText}</p>
                ) : null}
            </div>

            {errorBlock}

            {loadingDetail && !keepLayout ? (
                <div className="flex items-center justify-center gap-2 rounded-md border border-dashed py-10 text-xs text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading details…
                </div>
            ) : null}

            {loadingDetail && keepLayout ? loadingBlock : null}

            {detail ? (
                renderResult(detail, { reset })
            ) : !loadingDetail || keepLayout ? (
                emptyHint ?? null
            ) : null}
        </div>
    );
}

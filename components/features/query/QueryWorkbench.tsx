'use client';

import * as React from 'react';
import { Search, Loader2, ArrowRight, AlertCircle, CornerDownLeft } from 'lucide-react';
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
            setDetail(null);
            const currentRequest = ++requestId.current;
            try {
                const result = await loadDetail(suggestion);
                if (requestId.current === currentRequest) setDetail(result);
            } catch (err) {
                if (requestId.current === currentRequest) {
                    setError(err instanceof Error ? err.message : 'Could not load this record.');
                }
            } finally {
                if (requestId.current === currentRequest) setLoadingDetail(false);
            }
        },
        [loadDetail],
    );

    const reset = React.useCallback(() => {
        setDetail(null);
        setError(null);
        setTerm('');
        setSuggestions([]);
        setActiveIndex(-1);
        requestAnimationFrame(() => inputRef.current?.focus());
    }, []);

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
            if (activeIndex >= 0 && suggestions[activeIndex]) {
                void handleSelect(suggestions[activeIndex]);
            } else if (allowFreeSubmit && buildFreeSuggestion && term.trim()) {
                void handleSelect(buildFreeSuggestion(term.trim()));
            }
        } else if (event.key === 'Escape') {
            setOpen(false);
        }
    };

    const showDropdown = open && term.trim().length > 0;

    return (
        <div className="space-y-6">
            <div className="relative">
                <div className="relative flex items-center">
                    <Search className="pointer-events-none absolute left-4 h-5 w-5 text-muted-foreground" />
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
                        className="h-14 rounded-xl border-2 pl-12 pr-32 text-base font-medium shadow-sm focus-visible:ring-2"
                        autoComplete="off"
                        spellCheck={false}
                    />
                    <div className="absolute right-2 flex items-center gap-2">
                        {loadingSuggestions ? (
                            <Loader2 className="mr-1 h-4 w-4 animate-spin text-muted-foreground" />
                        ) : null}
                        <Button
                            type="button"
                            className="h-10 gap-1.5 rounded-lg"
                            disabled={!term.trim()}
                            onClick={() => {
                                if (activeIndex >= 0 && suggestions[activeIndex]) {
                                    void handleSelect(suggestions[activeIndex]);
                                } else if (allowFreeSubmit && buildFreeSuggestion && term.trim()) {
                                    void handleSelect(buildFreeSuggestion(term.trim()));
                                }
                            }}
                        >
                            Search <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {showDropdown ? (
                    <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border bg-popover shadow-xl">
                        {loadingSuggestions && suggestions.length === 0 ? (
                            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                            </div>
                        ) : suggestions.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-muted-foreground">
                                {allowFreeSubmit ? (
                                    <span className="flex items-center gap-2">
                                        No saved match. Press
                                        <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-bold">Enter</kbd>
                                        to search “{term.trim()}”.
                                    </span>
                                ) : (
                                    'No matching records found.'
                                )}
                            </div>
                        ) : (
                            <ul className="max-h-80 overflow-y-auto py-1">
                                {suggestions.map((suggestion, index) => (
                                    <li key={`${suggestion.value}-${index}`}>
                                        <button
                                            type="button"
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={() => void handleSelect(suggestion)}
                                            onMouseEnter={() => setActiveIndex(index)}
                                            className={cn(
                                                'flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors',
                                                index === activeIndex ? 'bg-accent' : 'hover:bg-accent/60',
                                            )}
                                        >
                                            <span className="flex min-w-0 flex-col">
                                                <span className="truncate text-sm font-semibold text-foreground">
                                                    {suggestion.primary}
                                                </span>
                                                {suggestion.secondary ? (
                                                    <span className="truncate text-xs text-muted-foreground">
                                                        {suggestion.secondary}
                                                    </span>
                                                ) : null}
                                            </span>
                                            {suggestion.trailing ? (
                                                <span className="flex-shrink-0 font-mono text-xs font-semibold text-muted-foreground">
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

            {helperText && !detail && !loadingDetail && !error ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CornerDownLeft className="h-3.5 w-3.5" /> {helperText}
                </p>
            ) : null}

            {loadingDetail ? (
                <div className="flex items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-sm text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" /> Loading details…
                </div>
            ) : error ? (
                <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                    <div>
                        <p className="font-semibold">Nothing to show</p>
                        <p className="text-destructive/80">{error}</p>
                    </div>
                </div>
            ) : detail ? (
                renderResult(detail, { reset })
            ) : (
                emptyHint ?? null
            )}
        </div>
    );
}

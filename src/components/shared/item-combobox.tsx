'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDebounce } from '@/hooks/use-debounce';
import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ItemWithLookups } from '@/types/db';

interface ItemComboboxProps {
  value: string; // ItemUID
  onSelect: (item: { ItemUID: string; ItemName: string }) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function ItemCombobox({
  value,
  onSelect,
  disabled = false,
  placeholder = 'Select an item...',
  className,
}: ItemComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<ItemWithLookups[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');

  const debouncedSearch = useDebounce(search, 300);

  const fetchItems = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/items?search=${encodeURIComponent(query)}&pageSize=20`);
      if (res.ok) {
        const json = await res.json();
        setItems(json.data);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchItems(debouncedSearch);
    }
  }, [open, debouncedSearch, fetchItems]);

  // If value is set initially or externally, resolve its label if possible
  useEffect(() => {
    if (!value) {
      setSelectedLabel('');
      return;
    }
    const found = items.find((i) => i.ItemUID === value);
    if (found) {
      setSelectedLabel(`${found.ItemName} (${found.ItemUID})`);
    } else if (!selectedLabel) {
      // Fetch item detail to display label if not in list
      fetch(`/api/items/${encodeURIComponent(value)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((item: ItemWithLookups | null) => {
          if (item) {
            setSelectedLabel(`${item.ItemName} (${item.ItemUID})`);
          }
        })
        .catch(() => {});
    }
  }, [value, items, selectedLabel]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal text-left truncate',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate">
            {selectedLabel || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[380px] max-w-[380px] p-2" align="start">
        <div className="flex items-center border-b px-2 pb-2 mb-2">
          <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            placeholder="Search items by name or UID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-1"
            autoFocus
          />
        </div>
        <div className="max-h-60 overflow-y-auto space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching items...
            </div>
          ) : items.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No items found.
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.ItemUID}
                type="button"
                className={cn(
                  'flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm text-left hover:bg-accent hover:text-accent-foreground cursor-pointer',
                  value === item.ItemUID && 'bg-accent/50 font-medium'
                )}
                onClick={() => {
                  setSelectedLabel(`${item.ItemName} (${item.ItemUID})`);
                  onSelect({ ItemUID: item.ItemUID, ItemName: item.ItemName });
                  setOpen(false);
                }}
              >
                <div className="flex flex-col truncate pr-2">
                  <span className="truncate">{item.ItemName}</span>
                  <span className="text-xs text-muted-foreground">{item.ItemUID} • {item.CategoryName || 'No Category'}</span>
                </div>
                {value === item.ItemUID && (
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                )}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

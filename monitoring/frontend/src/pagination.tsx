import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useState, useMemo } from 'react';

/**
 * Klient-side stránkování pro tabulky. Backend posílá celé pole (max 1000)
 * a my ho v paměti rozřežeme. Pro většinu pilotů (≤ 100 zaměstnanců) je to
 * dostačující – při velkých datech (1000+) přejdeme na server-side LIMIT/OFFSET.
 *
 * Použití:
 *   const { paged, controls } = usePagination(rows, 50);
 *   {paged.map(...)}
 *   {controls}
 */
export function usePagination<T>(rows: T[], pageSize = 50) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  // Pokud se rows zkrátí (filter), nezůstaň na neexistující stránce.
  const safePage = Math.min(page, totalPages - 1);
  const paged = useMemo(() => rows.slice(safePage * pageSize, (safePage + 1) * pageSize), [rows, safePage, pageSize]);

  const controls = totalPages > 1 ? (
    <PaginationControls
      page={safePage}
      totalPages={totalPages}
      total={rows.length}
      pageSize={pageSize}
      onChange={setPage}
    />
  ) : null;

  return { paged, controls, page: safePage, totalPages };
}

function PaginationControls({ page, totalPages, total, pageSize, onChange }: {
  page: number; totalPages: number; total: number; pageSize: number;
  onChange: (p: number) => void;
}) {
  const from = page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);
  return (
    <div className="mt-2 flex items-center justify-between gap-2 px-2 text-xs">
      <span className="muted-2">{from}–{to} z {total}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(0)} disabled={page === 0}
          className="rounded p-1 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-slate-800">
          <ChevronsLeft size={14} />
        </button>
        <button onClick={() => onChange(page - 1)} disabled={page === 0}
          className="rounded p-1 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-slate-800">
          <ChevronLeft size={14} />
        </button>
        <span className="px-2 tabular-nums">{page + 1} / {totalPages}</span>
        <button onClick={() => onChange(page + 1)} disabled={page >= totalPages - 1}
          className="rounded p-1 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-slate-800">
          <ChevronRight size={14} />
        </button>
        <button onClick={() => onChange(totalPages - 1)} disabled={page >= totalPages - 1}
          className="rounded p-1 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-slate-800">
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
}

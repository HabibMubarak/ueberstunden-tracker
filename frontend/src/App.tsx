import React, { useEffect, useMemo, useState } from 'react';
import { createTransaction, getBalance, listTransactions, deleteTransaction, updateTransaction, Transaction, login, logout, checkAuthStatus } from './api';
import LoginScreen from './LoginScreen';

function formatHMM(totalMinutes: number) {
  const sign = totalMinutes < 0 ? '-' : '';
  const abs = Math.abs(totalMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}:${String(m).padStart(2, '0')}`;
}

function BalanceBadge({ balanceMinutes, darkMode }: { balanceMinutes: number; darkMode: boolean }) {
  const color = balanceMinutes >= 0 ? 'text-green-500' : 'text-red-500';
  return (
    <div className={`rounded-xl shadow-lg p-5 ${darkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'}`}>
      <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Aktueller Saldo</div>
      <div className={`mt-1 text-4xl font-extrabold ${color}`}>{formatHMM(balanceMinutes)} Std</div>
    </div>
  );
}

function ActionButtons({ onAdd, onSpend }: { onAdd: () => void; onSpend: () => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button className="px-4 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium shadow" onClick={onAdd}>
        ➕ Stunden Hinzufügen
      </button>
      <button className="px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium shadow" onClick={onSpend}>
        ➖ Stunden Abziehen
      </button>
    </div>
  );
}

function TransactionModal({
  type,
  onClose,
  onSubmit,
  initialDate,
  initialMinutes,
  initialDescription,
}: {
  type: 'EARNED' | 'SPENT';
  onClose: () => void;
  onSubmit: (tx: Omit<Transaction, '_id'>) => void;
  initialDate?: string;
  initialMinutes?: number;
  initialDescription?: string;
}) {
  const [date, setDate] = useState<string>(initialDate ?? new Date().toISOString().slice(0, 10));
  const [hoursInput, setHoursInput] = useState<number>(initialMinutes != null ? Math.floor(initialMinutes / 60) : 0);
  const [minutesInput, setMinutesInput] = useState<number>(initialMinutes != null ? (initialMinutes % 60) : 0);
  const [description, setDescription] = useState<string>(initialDescription ?? '');
  const [errors, setErrors] = useState<{ date?: string; hours?: string; minutes?: string; description?: string }>({});

  function computeErrors(current: { date: string; hours: number; minutes: number; description: string }) {
    const e: { date?: string; hours?: string; minutes?: string; description?: string } = {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(current.date)) {
      e.date = 'Datum muss im Format YYYY-MM-DD sein';
    }
    if (!Number.isInteger(current.hours) || current.hours < 0) {
      e.hours = 'Stunden müssen eine ganze Zahl ≥ 0 sein';
    }
    if (!Number.isInteger(current.minutes) || current.minutes < 0 || current.minutes > 59) {
      e.minutes = 'Minuten müssen zwischen 0 und 59 liegen';
    }
    if ((current.hours + current.minutes) <= 0) {
      e.minutes = 'Gesamtzeit muss > 0 sein';
    }
    if (!current.description || current.description.trim().length === 0) {
      e.description = 'Beschreibung darf nicht leer sein';
    }
    return e;
  }

  useEffect(() => {
    setErrors(computeErrors({ date, hours: hoursInput, minutes: minutesInput, description }));
  }, [date, hoursInput, minutesInput, description]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-50 rounded-xl shadow-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold mb-4 text-gray-900">
          {type === 'EARNED' ? 'Stunden Hinzufügen' : 'Stunden Abziehen'}
        </h2>
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-900">Datum</span>
            <input
              type="date"
              className="w-full mt-1 p-2 border border-gray-300 rounded bg-white text-gray-900"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            {errors.date && <div className="mt-1 text-sm text-red-600">{errors.date}</div>}
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-900">Stunden</span>
              <input
                type="number"
                step="1"
                min={0}
                className="w-full mt-1 p-2 border border-gray-300 rounded bg-white text-gray-900"
                value={hoursInput}
                onChange={(e) => {
                  const v = e.target.value;
                  const num = v === '' ? 0 : Math.max(0, Math.floor(Number(v)) || 0);
                  setHoursInput(num);
                }}
              />
              {errors.hours && <div className="mt-1 text-sm text-red-600">{errors.hours}</div>}
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-900">Minuten</span>
              <input
                type="number"
                step="1"
                min={0}
                max={59}
                className="w-full mt-1 p-2 border border-gray-300 rounded bg-white text-gray-900"
                value={minutesInput}
                onChange={(e) => {
                  const v = e.target.value;
                  let num = v === '' ? 0 : Math.floor(Number(v)) || 0;
                  if (num < 0) num = 0;
                  if (num > 59) num = 59;
                  setMinutesInput(num);
                }}
              />
              {errors.minutes && <div className="mt-1 text-sm text-red-600">{errors.minutes}</div>}
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-gray-900">Beschreibung</span>
            <input
              type="text"
              className="w-full mt-1 p-2 border border-gray-300 rounded bg-white text-gray-900"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {errors.description && <div className="mt-1 text-sm text-red-600">{errors.description}</div>}
          </label>
          <div className="flex gap-3 justify-end pt-2">
            <button 
              className="px-4 py-2 rounded border border-gray-300 bg-white hover:bg-gray-100 text-gray-700" 
              onClick={onClose}
            >
              Abbrechen
            </button>
            <button
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium"
              disabled={Object.keys(computeErrors({ date, hours: hoursInput, minutes: minutesInput, description })).length > 0}
              onClick={() => {
                const e = computeErrors({ date, hours: hoursInput, minutes: minutesInput, description });
                if (Object.keys(e).length > 0) return;
                const totalMinutes = hoursInput * 60 + minutesInput;
                onSubmit({ date, type, minutes: totalMinutes, description } as any);
              }}
            >
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type SortKey = 'date' | 'description' | 'minutes';

function History({
  transactions,
  sortKey,
  sortDir,
  onChangeSortKey,
  onToggleSortDir,
  onDelete,
  onEdit,
}: {
  transactions: Transaction[];
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onChangeSortKey: (k: SortKey) => void;
  onToggleSortDir: () => void;
  onDelete: (id: string) => void;
  onEdit: (tx: Transaction) => void;
}) {
  const sorted = useMemo(() => {
    const list = [...transactions];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') {
        cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortKey === 'description') {
        cmp = a.description.localeCompare(b.description);
      } else {
        cmp = a.minutes - b.minutes;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [transactions, sortKey, sortDir]);

  const rows = useMemo(() => {
    // Berechne laufenden Saldo chronologisch (immer nach Datum sortiert)
    const chronological = [...transactions].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    const runningMap = new Map<string, number>();
    let running = 0;
    chronological.forEach((t) => {
      running += t.type === 'EARNED' ? t.minutes : -t.minutes;
      runningMap.set(t._id || `${t.date}-${t.description}`, running);
    });

    // Verwende die sortierte Liste, aber mit chronologisch berechnetem Saldo
    return sorted.map((t) => ({
      ...t,
      running: runningMap.get(t._id || `${t.date}-${t.description}`) || 0,
    }));
  }, [sorted, transactions]);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">Historie</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Sortiert nach: {sortKey === 'date' ? 'Datum' : sortKey === 'description' ? 'Beschreibung' : 'Stunden'}</span>
          <button
            className="px-3 py-1 border rounded bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={onToggleSortDir}
            title="Sortierreihenfolge umschalten"
          >
            {sortDir === 'asc' ? '▲ Aufsteigend' : '▼ Absteigend'}
          </button>
        </div>
      </div>
      <div className="overflow-auto rounded-xl bg-white dark:bg-gray-800 shadow">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-white dark:bg-gray-800">
            <tr className="border-b">
              <th className="p-2">
                <button 
                  className="hover:underline flex items-center gap-1" 
                  onClick={() => {
                    if (sortKey === 'date') {
                      onToggleSortDir();
                    } else {
                      onChangeSortKey('date');
                    }
                  }}
                >
                  Datum {sortKey === 'date' && (sortDir === 'asc' ? '▲' : '▼')}
                </button>
              </th>
              <th className="p-2">
                <button 
                  className="hover:underline flex items-center gap-1" 
                  onClick={() => {
                    if (sortKey === 'description') {
                      onToggleSortDir();
                    } else {
                      onChangeSortKey('description');
                    }
                  }}
                >
                  Beschreibung {sortKey === 'description' && (sortDir === 'asc' ? '▲' : '▼')}
                </button>
              </th>
              <th className="p-2 text-right">
                <button 
                  className="hover:underline flex items-center gap-1 ml-auto" 
                  onClick={() => {
                    if (sortKey === 'hours') {
                      onToggleSortDir();
                    } else {
                      onChangeSortKey('hours');
                    }
                  }}
                >
                  Stunden {sortKey === 'hours' && (sortDir === 'asc' ? '▲' : '▼')}
                </button>
              </th>
              <th className="p-2 text-right">Laufender Saldo</th>
              <th className="p-2 text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t._id || `${t.date}-${t.description}-${t.minutes}`} className="border-b odd:bg-gray-50 dark:odd:bg-gray-900">
                <td className="p-2">{t.date}</td>
                <td className="p-2">{t.description}</td>
                <td className="p-2 text-right font-mono">{t.type === 'EARNED' ? '+' : '-'}{formatHMM(t.minutes)}</td>
                <td className="p-2 text-right font-mono">{formatHMM((rows.find(r => r._id === t._id)?.running) || 0)}</td>
                <td className="p-2 text-right space-x-2">
                  {t._id ? (
                    <>
                      <button
                        className="px-2 py-1 text-xs rounded bg-gray-600 hover:bg-gray-700 text-white"
                        onClick={() => onEdit(t)}
                      >
                        Bearbeiten
                      </button>
                      <button
                        className="px-2 py-1 text-xs rounded bg-red-600 hover:bg-red-700 text-white"
                        onClick={() => {
                          if (confirm('Diesen Eintrag wirklich löschen?')) onDelete(t._id!);
                        }}
                      >
                        Löschen
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CalendarView({ transactions, onQuickAdd, darkMode }: { transactions: Transaction[]; onQuickAdd: (isoDate: string) => void; darkMode: boolean }) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  function localISO(y: number, mZeroBased: number, d: number) {
    const yyyy = String(y);
    const mm = String(mZeroBased + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  const { days, monthLabel, totalsByDay } = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);

    const totals = new Map<number, number>();
    transactions.forEach((t) => {
      const d = new Date(t.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const delta = t.type === 'EARNED' ? t.minutes : -t.minutes;
        totals.set(d.getDate(), (totals.get(d.getDate()) || 0) + delta);
      }
    });

    // Build calendar with Monday as first day
    const startWeekday = (first.getDay() + 6) % 7; // 0=Mon .. 6=Sun
    const leading = Array.from({ length: startWeekday }, () => null);
    const daysInMonth = Array.from({ length: last.getDate() }, (_, i) => i + 1);
    const gridDays: (number | null)[] = [...leading, ...daysInMonth];
    const monthLabelStr = first.toLocaleString('de-DE', { month: 'long', year: 'numeric' });
    return { days: gridDays, monthLabel: monthLabelStr, totalsByDay: totals };
  }, [transactions, currentMonth]);

  function prevMonth() {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-semibold ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>📅 Kalenderansicht</h3>
        <div className="flex items-center gap-2">
          <button 
            className={`px-3 py-1 rounded transition ${darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-700'}`}
            onClick={prevMonth}
          >
            ◀
          </button>
          <div className={`font-medium min-w-[160px] text-center ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>{monthLabel}</div>
          <button 
            className={`px-3 py-1 rounded transition ${darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-700'}`}
            onClick={nextMonth}
          >
            ▶
          </button>
        </div>
      </div>
      <div className={`rounded-xl shadow-lg p-4 ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((w) => (
            <div key={w} className={`text-center text-xs font-semibold py-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d, idx) => {
            const isToday = (() => {
              if (!d) return false;
              const base = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
              return base.toDateString() === today.toDateString();
            })();
            const hasData = d && typeof totalsByDay.get(d) === 'number' && totalsByDay.get(d)! !== 0;
            const total = d ? totalsByDay.get(d) || 0 : 0;
            
            return (
              <div
                key={idx}
                className={`min-h-[70px] rounded-lg p-2 flex flex-col transition-all ${
                  d 
                    ? darkMode
                      ? `${isToday ? 'bg-blue-900/50 border-2 border-blue-500' : 'bg-gray-700 hover:bg-gray-600 border border-gray-600'}`
                      : `${isToday ? 'bg-blue-50 border-2 border-blue-500' : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'}`
                    : 'bg-transparent'
                }`}
              >
                {d ? (
                  <>
                    <div className="flex items-start justify-between mb-1">
                      <div className={`text-xs font-semibold ${
                        isToday 
                          ? darkMode ? 'text-blue-400' : 'text-blue-600'
                          : darkMode ? 'text-gray-200' : 'text-gray-700'
                      }`}>
                        {d}
                      </div>
                      <button
                        className="text-[10px] px-1.5 py-0.5 rounded bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
                        onClick={() => {
                          const isoLocal = localISO(currentMonth.getFullYear(), currentMonth.getMonth(), d);
                          onQuickAdd(isoLocal);
                        }}
                      >
                        +
                      </button>
                    </div>
                    {hasData ? (
                      <div className={`mt-auto text-center py-0.5 px-1 rounded text-[11px] font-semibold ${
                        total >= 0 
                          ? darkMode ? 'bg-green-900/60 text-green-400' : 'bg-green-100 text-green-700'
                          : darkMode ? 'bg-red-900/60 text-red-400' : 'bg-red-100 text-red-700'
                      }`}>
                        {total > 0 ? '+' : ''}{formatHMM(total)}h
                      </div>
                    ) : (
                      <div className={`mt-auto text-center text-[10px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>—</div>
                    )}
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function App() {
    const [authenticated, setAuthenticated] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);
    const [loginError, setLoginError] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    const [darkMode, setDarkMode] = useState(() => {
      const saved = localStorage.getItem('theme');
      return saved ? saved === 'dark' : true; // default dark
    });

  const [balanceMinutes, setBalanceMinutes] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [modalType, setModalType] = useState<null | 'EARNED' | 'SPENT'>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  function toggleTheme() {
    setDarkMode(!darkMode);
  }

  async function refresh() {
    const [b, list] = await Promise.all([getBalance(), listTransactions()]);
    setBalanceMinutes(b);
    setTransactions(list);
  }

  useEffect(() => {
    checkAuthStatus().then((auth) => {
      setAuthenticated(auth);
      setAuthLoading(false);
      if (auth) {
        refresh();
      }
    });
  }, []);

  // Auto-refresh every 5 seconds when authenticated
  useEffect(() => {
    if (!authenticated) return;
    
    const interval = setInterval(() => {
      refresh();
    }, 5000); // 5 seconds

    return () => clearInterval(interval);
  }, [authenticated]);

  async function handleLogin(password: string) {
    setLoginLoading(true);
    setLoginError('');
    try {
      await login(password);
      setAuthenticated(true);
      await refresh();
    } catch (err: any) {
      setLoginError(err.response?.data?.error || 'Falsches Passwort');
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout() {
    await logout();
    setAuthenticated(false);
    setTransactions([]);
    setBalanceMinutes(0);
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Laden...</div>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginScreen onLogin={handleLogin} error={loginError} loading={loginLoading} />;
  }  async function handleSubmit(tx: Omit<Transaction, '_id'>) {
    if (editingTx && editingTx._id) {
      await updateTransaction(editingTx._id, tx);
      setEditingTx(null);
    } else {
      await createTransaction(tx);
    }
    setModalType(null);
    setSelectedDate(null);
    await refresh();
  }

  async function handleDelete(id: string) {
    await deleteTransaction(id);
    await refresh();
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <div className="flex justify-between items-center mb-2">
          <button
            onClick={toggleTheme}
            className={`px-4 py-2 rounded-lg transition ${
              darkMode 
                ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' 
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
            title="Theme wechseln"
          >
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
          <button
            onClick={handleLogout}
            className={`px-4 py-2 text-sm rounded-lg transition ${
              darkMode
                ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            🚪 Abmelden
          </button>
        </div>
      <BalanceBadge balanceMinutes={balanceMinutes} darkMode={darkMode} />
      <ActionButtons onAdd={() => setModalType('EARNED')} onSpend={() => setModalType('SPENT')} />
      {modalType && (
        <TransactionModal
          type={modalType}
          initialDate={selectedDate ?? (editingTx?.date ?? undefined)}
          initialMinutes={editingTx?.minutes}
          initialDescription={editingTx?.description}
          onClose={() => {
            setModalType(null);
            setSelectedDate(null);
            setEditingTx(null);
          }}
          onSubmit={handleSubmit}
        />
      )}
      <History
        transactions={transactions}
        sortKey={sortKey}
        sortDir={sortDir}
        onChangeSortKey={setSortKey}
        onToggleSortDir={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
        onDelete={handleDelete}
        onEdit={(tx) => {
          setEditingTx(tx);
          setSelectedDate(tx.date);
          setModalType(tx.type);
        }}
      />

      <CalendarView
        transactions={transactions}
        onQuickAdd={(iso) => {
          setSelectedDate(iso);
          setModalType('EARNED');
        }}
        darkMode={darkMode}
      />
      </div>
    </div>
  );
}

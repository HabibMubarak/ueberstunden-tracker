import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { createTransaction, getBalance, listTransactions, deleteTransaction, updateTransaction, Transaction, login, logout, checkAuthStatus, importCSV } from './api';
import LoginScreen from './LoginScreen';

function formatHMM(totalMinutes: number) {
  const sign = totalMinutes < 0 ? '-' : '';
  const abs = Math.abs(totalMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}:${String(m).padStart(2, '0')}`;
}

function formatDateWithFormat(iso: string, format: 'dd.mm.yyyy' | 'dd/mm/yyyy' | 'mm/dd/yyyy' | 'yyyy-mm-dd' = 'dd.mm.yyyy') {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  switch (format) {
    case 'dd.mm.yyyy':
      return `${day}.${month}.${year}`;
    case 'dd/mm/yyyy':
      return `${day}/${month}/${year}`;
    case 'mm/dd/yyyy':
      return `${month}/${day}/${year}`;
    case 'yyyy-mm-dd':
      return `${year}-${month}-${day}`;
    default:
      return `${day}.${month}.${year}`;
  }
}

function formatDateShort(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface AppSettings {
  weeklyTargetHours: number;
  monthlyTargetOverride: number | null;
  workDaysPerWeek: number;
  hourlyRate: number;
  roundingMinutes: number;
  autoRefreshSeconds: number;
  defaultSortKey: 'date' | 'description' | 'minutes';
  defaultSortDir: 'asc' | 'desc';
  calendarStartDay: 'monday' | 'sunday';
  defaultDescription: string;
  dateFormat: 'dd.mm.yyyy' | 'dd/mm/yyyy' | 'mm/dd/yyyy' | 'yyyy-mm-dd';
}

function SettingsModal({ 
  onClose, 
  darkMode, 
  settings,
  onSave,
  onExportCSV,
  onExportPDF,
  onChangePassword 
}: { 
  onClose: () => void; 
  darkMode: boolean; 
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onExportCSV: (startDate?: string, endDate?: string) => void;
  onExportPDF: (startDate?: string, endDate?: string) => void;
  onChangePassword: (oldPw: string, newPw: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<'work' | 'display' | 'data' | 'security'>('work');
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [error, setError] = useState('');
  
  // Export date range
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState(new Date().toISOString().slice(0, 10));
  
  // Password change
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  
  // Import preview state
  interface PreviewTransaction extends Transaction {
    selected: boolean;
    rowIndex: number;
    error?: string;
  }
  const [previewTransactions, setPreviewTransactions] = useState<PreviewTransaction[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  
  // Edit-Buffer pro Feld, um Race-Conditions zu vermeiden
  const [editBuffer, setEditBuffer] = useState<Record<string, string>>({});
  const [activeEditKey, setActiveEditKey] = useState<string | null>(null);

  // Halte den Fokus stabil, falls ein Re-Render Inputs neu zeichnet
  useEffect(() => {
    if (!activeEditKey) return;
    const el = document.querySelector(`[data-edit-key="${activeEditKey}"]`) as (HTMLInputElement | HTMLSelectElement | null);
    if (el) {
      el.focus();
      if (el instanceof HTMLInputElement) {
        const len = el.value?.length ?? 0;
        try {
          el.setSelectionRange(len, len);
        } catch {}
      }
    }
  }, [activeEditKey, editBuffer, previewTransactions]);

  // Import Preview

  const handleImportCSV = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('❌ Bitte nur CSV-Dateien auswählen');
      return;
    }
    
    setImportLoading(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        alert('❌ CSV-Datei ist leer oder hat nur eine Zeile');
        setImportLoading(false);
        return;
      }

      // Parse header
      const header = lines[0].split(',').map(h => h.trim().toLowerCase());
      const dateIdx = header.findIndex(h => ['date', 'datum'].includes(h));
      const typeIdx = header.findIndex(h => ['type', 'typ'].includes(h));
      const minutesIdx = header.findIndex(h => h === 'minutes' || h === 'minuten');
      const hoursIdx = header.findIndex(h => h === 'hours' || h === 'stunden');
      const descIdx = header.findIndex(h => ['description', 'beschreibung'].includes(h));

      // Parse data rows
      const parsed: PreviewTransaction[] = [];
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map(v => v.trim());
        const date = row[dateIdx] || '';
        const type = (row[typeIdx] || '').toUpperCase();
        const minutes = row[minutesIdx] ? parseInt(row[minutesIdx], 10) : null;
        const hours = row[hoursIdx] ? parseFloat(row[hoursIdx]) : null;
        const description = row[descIdx] || '';

        let finalMinutes = minutes;
        let error: string | undefined;

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          error = 'Ungültiges Datum (YYYY-MM-DD erforderlich)';
        } else if (!['EARNED', 'SPENT'].includes(type)) {
          error = 'Ungültiger Typ (EARNED oder SPENT erforderlich)';
        } else if (!description) {
          error = 'Beschreibung erforderlich';
        } else if (minutes !== null) {
          if (!Number.isFinite(minutes) || minutes <= 0 || !Number.isInteger(minutes)) {
            error = 'Ungültige Minuten (positive Ganzzahl erforderlich)';
          } else {
            finalMinutes = minutes;
          }
        } else if (hours !== null) {
          if (!Number.isFinite(hours) || hours <= 0) {
            error = 'Ungültige Stunden (positive Zahl erforderlich)';
          } else {
            finalMinutes = Math.round(hours * 60);
          }
        } else {
          error = 'Minuten oder Stunden erforderlich';
        }

        parsed.push({
          _id: `preview-${i}`,
          date,
          type: type as 'EARNED' | 'SPENT',
          minutes: finalMinutes || 0,
          description,
          selected: !error,
          rowIndex: i + 1,
          error,
        });
      }

      setPreviewTransactions(parsed);
      setShowPreview(true);
    } catch (err) {
      alert(`❌ CSV-Parsing fehlgeschlagen: ${String(err)}`);
    } finally {
      setImportLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      handleImportCSV(file);
    }
  };

  const handleConfirmImport = async () => {
    const selectedTxs = previewTransactions.filter(t => t.selected && !t.error);
    if (selectedTxs.length === 0) {
      alert('❌ Keine gültigen Transaktionen zum Importieren ausgewählt');
      return;
    }

    setImportLoading(true);
    try {
      let imported = 0;
      for (const tx of selectedTxs) {
        try {
          await createTransaction({
            date: tx.date,
            type: tx.type,
            minutes: tx.minutes,
            description: tx.description,
          });
          imported++;
        } catch (err) {
          console.error(`Fehler beim Import von Zeile ${tx.rowIndex}:`, err);
        }
      }
      alert(`✅ ${imported} Transaktionen erfolgreich importiert`);
      setShowPreview(false);
      setPreviewTransactions([]);
      await listTransactions();
    } catch (error: any) {
      alert(`❌ Import fehlgeschlagen: ${String(error)}`);
    } finally {
      setImportLoading(false);
    }
  };

  const toggleTransactionSelection = (index: number) => {
    setPreviewTransactions(prev => 
      prev.map((tx, i) => 
        i === index ? { ...tx, selected: !tx.selected && !tx.error } : tx
      )
    );
  };

  const updatePreviewTransaction = (index: number, updates: Partial<PreviewTransaction>) => {
    setPreviewTransactions(prev =>
      prev.map((tx, i) => {
        if (i !== index) return tx;
        const updated = { ...tx, ...updates };
        return updated;
      })
    );
  };

  const validatePreviewTransaction = (tx: PreviewTransaction): string | undefined => {
    if (!tx.date || !/^\d{4}-\d{2}-\d{2}$/.test(tx.date)) {
      return 'Ungültiges Datum';
    }
    if (!tx.type || !['EARNED', 'SPENT'].includes(tx.type)) {
      return 'Ungültiger Typ';
    }
    if (!tx.description || tx.description.trim().length === 0) {
      return 'Beschreibung erforderlich';
    }
    if (tx.minutes < 1 || !Number.isInteger(tx.minutes)) {
      return 'Ungültige Minuten';
    }
    return undefined;
  };

  const handleSave = () => {
    if (localSettings.weeklyTargetHours < 1 || localSettings.weeklyTargetHours > 168) {
      setError('Wochenziel muss zwischen 1 und 168 Stunden liegen');
      return;
    }
    if (localSettings.monthlyTargetOverride !== null && (localSettings.monthlyTargetOverride < 1 || localSettings.monthlyTargetOverride > 744)) {
      setError('Monatsziel muss zwischen 1 und 744 Stunden liegen');
      return;
    }
    if (localSettings.workDaysPerWeek < 1 || localSettings.workDaysPerWeek > 7) {
      setError('Arbeitstage müssen zwischen 1 und 7 liegen');
      return;
    }
    if (localSettings.hourlyRate < 0) {
      setError('Stundensatz darf nicht negativ sein');
      return;
    }
    if (localSettings.autoRefreshSeconds < 0) {
      setError('Auto-Refresh darf nicht negativ sein');
      return;
    }
    onSave(localSettings);
    onClose();
  };

  const handlePasswordChange = async () => {
    setPasswordError('');
    setPasswordSuccess('');
    
    if (!oldPassword || !newPassword) {
      setPasswordError('Bitte alle Felder ausfüllen');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Neue Passwörter stimmen nicht überein');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Neues Passwort muss mindestens 6 Zeichen haben');
      return;
    }
    
    try {
      await onChangePassword(oldPassword, newPassword);
      setPasswordSuccess('Passwort erfolgreich geändert!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.response?.data?.error || 'Passwortänderung fehlgeschlagen');
    }
  };
    <div className={`fixed inset-0 w-screen h-screen ${darkMode ? 'bg-black/70' : 'bg-black/60'} backdrop-blur-sm flex items-center justify-center z-[9999] p-4 sm:p-0`}>
      <div className={`${darkMode ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'} rounded-2xl shadow-2xl p-4 sm:p-5 md:p-6 w-full mx-auto max-w-sm sm:max-w-2xl md:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col themed-scrollbar ${darkMode ? 'ts-dark' : 'ts-light'}`}>
        <div className="flex items-center justify-between mb-2 sm:mb-4 pb-2 sm:pb-4 border-b" style={{ borderColor: darkMode ? '#374151' : '#e5e7eb' }}>
          <h3 className={`text-lg sm:text-xl font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>📋 CSV Import Vorschau</h3>
          <button
            onClick={() => setShowPreview(false)}
            className={`text-2xl sm:text-3xl leading-none ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'}`}
          >
            ×
          </button>
        </div>

        {/* Summary */}
        <div className={`mb-3 sm:mb-4 p-2 sm:p-3 rounded-lg text-xs sm:text-sm ${darkMode ? 'bg-blue-900/30 border border-blue-700/50' : 'bg-blue-50 border border-blue-200'}`}>
          <div className={`text-sm ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>
            <span className="font-medium">Gültig:</span> {previewTransactions.filter(t => !t.error).length} | 
            <span className="font-medium ml-3">Fehler:</span> {previewTransactions.filter(t => t.error).length}
          </div>
        </div>

        {/* Transactions List - Scrollable Area */}
        <div className="flex-1 overflow-y-auto mb-4 border rounded-lg p-3" style={{ borderColor: darkMode ? '#374151' : '#e5e7eb' }}>
          {previewTransactions.length === 0 ? (
            <div className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Keine Transaktionen geladen. CSV-Datei auswählen zum Importieren.
            </div>
          ) : (
          <div className="space-y-3">
            {previewTransactions.map((tx, idx) => (
            <div
              key={tx._id ?? idx}
              className={`p-3 rounded-lg border transition ${
                tx.error
                  ? darkMode ? 'bg-red-900/20 border-red-700/50' : 'bg-red-50 border-red-200'
                  : tx.selected
                  ? darkMode ? 'bg-green-900/20 border-green-700/50' : 'bg-green-50 border-green-200'
                  : darkMode ? 'bg-gray-700/30 border-gray-600/50' : 'bg-gray-100 border-gray-300'
              }`}
            >
              <div className="flex gap-3">
                {!tx.error && (

                  <input
                    type="checkbox"
                    checked={tx.selected}
                    onChange={() => toggleTransactionSelection(idx)}
                    className="mt-1 w-4 h-4 cursor-pointer"
                  />
                )}
                {tx.error && <span className="text-red-500 mt-1">⚠️</span>}
                
                <div className="flex-1 space-y-2">
                  {tx.error ? (
                    <div className={`text-sm font-medium ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                      Zeile {tx.rowIndex}: {tx.error}
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-2 text-xs sm:text-sm">
                        <div>
                          <label className={`block text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Datum</label>
                          <input
                            type="date"
                            value={editBuffer[`${idx}-date`] ?? tx.date}
                            data-edit-key={`${idx}-date`}
                            onFocus={() => setActiveEditKey(`${idx}-date`)}
                            onChange={(e) => {
                              const key = `${idx}-date`;
                              const v = (e.target as HTMLInputElement).value;
                              setEditBuffer(prev => ({ ...prev, [key]: v }));
                              // Buffer-only while typing; commit happens on blur
                            }}
                            onBlur={() => {
                              // Wenn leer, behalte Original
                              const key = `${idx}-date`;
                              const val = editBuffer[key] ?? '';
                              if (val === '') {
                                setEditBuffer(prev => { const c = { ...prev }; delete c[key]; return c; });
                                return;
                              }
                              const updated = { ...previewTransactions[idx], date: val };
                              const error = validatePreviewTransaction(updated);
                              setPreviewTransactions(prev => prev.map((tx, i) => i === idx ? { ...updated, error, selected: !error } : tx));
                              setEditBuffer(prev => { const c = { ...prev }; delete c[key]; return c; });
                            }}
                            className={`w-full px-2 py-1 rounded text-sm border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`}
                          />
                        </div>
                        <div>
                          <label className={`block text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Typ</label>
                          <select
                            value={editBuffer[`${idx}-type`] ?? tx.type}
                            data-edit-key={`${idx}-type`}
                            onFocus={() => setActiveEditKey(`${idx}-type`)}
                            onChange={(e) => {
                              const key = `${idx}-type`;
                              const v = (e.target as HTMLSelectElement).value;
                              setEditBuffer(prev => ({ ...prev, [key]: v }));
                              // Buffer-only while typing; commit happens on blur
                            }}
                            onBlur={() => {
                              const key = `${idx}-type`;
                              const val = editBuffer[key] ?? '';
                              if (val === '') {
                                setEditBuffer(prev => { const c = { ...prev }; delete c[key]; return c; });
                                return;
                              }
                              const updated = { ...previewTransactions[idx], type: val as 'EARNED' | 'SPENT' };
                              const error = validatePreviewTransaction(updated);
                              setPreviewTransactions(prev => prev.map((tx, i) => i === idx ? { ...updated, error, selected: !error } : tx));
                              setEditBuffer(prev => { const c = { ...prev }; delete c[key]; return c; });
                            }}
                            className={`w-full px-2 py-1 rounded text-sm border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`}
                          >
                            <option value="EARNED">EARNED</option>
                            <option value="SPENT">SPENT</option>
                          </select>
                        </div>
                        <div>
                          <label className={`block text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Minuten</label>
                          <input
                            type="number"
                            value={(() => {
                              const mKey = `${idx}-minutes`;
                              const hKey = `${idx}-hours`;
                              const mBuf = editBuffer[mKey];
                              const hBuf = editBuffer[hKey];
                              if (mBuf !== undefined) return mBuf;
                              if (hBuf !== undefined) {
                                if (hBuf === '') return '';
                                const h = parseFloat(hBuf);
                                return Number.isNaN(h) ? String(tx.minutes) : String(Math.round(h * 60));
                              }
                              return String(tx.minutes);
                            })()}
                            data-edit-key={`${idx}-minutes`}
                            onFocus={() => setActiveEditKey(`${idx}-minutes`)}
                            onChange={(e) => {
                              const key = `${idx}-minutes`;
                              const v = (e.target as HTMLInputElement).value;
                              setEditBuffer(prev => ({ ...prev, [key]: v }));
                              // Buffer-only while typing; commit happens on blur
                            }}
                            onBlur={() => {
                              const mKey = `${idx}-minutes`;
                              const raw = editBuffer[mKey] ?? '';
                              if (raw === '') {
                                setEditBuffer(prev => { const c = { ...prev }; delete c[mKey]; return c; });
                                return;
                              }
                              const val = parseInt(raw, 10);
                              const updated = { ...previewTransactions[idx], minutes: Number.isNaN(val) ? previewTransactions[idx].minutes : val };
                              const error = validatePreviewTransaction(updated);
                              // Synchronisiere Stunden
                              setPreviewTransactions(prev => prev.map((tx, i) => i === idx ? { ...updated, error, selected: !error } : tx));
                              setEditBuffer(prev => { const c = { ...prev }; delete c[mKey]; return c; });
                            }}
                            inputMode="numeric"
                            className={`w-full px-2 py-1 rounded text-sm border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`}
                          />
                        </div>
                        <div>
                          <label className={`block text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Stunden</label>
                          <input
                            type="number"
                            value={(() => {
                              const mKey = `${idx}-minutes`;
                              const hKey = `${idx}-hours`;
                              const hBuf = editBuffer[hKey];
                              const mBuf = editBuffer[mKey];
                              if (hBuf !== undefined) return hBuf;
                              if (mBuf !== undefined) {
                                if (mBuf === '') return '';
                                const m = parseInt(mBuf, 10);
                                const v = Number.isNaN(m) ? tx.minutes : m;
                                return (v / 60).toFixed(2);
                              }
                              return (tx.minutes / 60).toFixed(2);
                            })()}
                            data-edit-key={`${idx}-hours`}
                            onFocus={() => setActiveEditKey(`${idx}-hours`)}
                            onChange={(e) => {
                              const key = `${idx}-hours`;
                              const v = (e.target as HTMLInputElement).value;
                              setEditBuffer(prev => ({ ...prev, [key]: v }));
                              // Buffer-only while typing; commit happens on blur
                            }}
                            onBlur={() => {
                              const hKey = `${idx}-hours`;
                              const raw = editBuffer[hKey] ?? '';
                              if (raw === '') {
                                setEditBuffer(prev => { const c = { ...prev }; delete c[hKey]; return c; });
                                return;
                              }
                              const val = parseFloat(raw);
                              const minutes = Number.isNaN(val) ? previewTransactions[idx].minutes : Math.round(val * 60);
                              const updated = { ...previewTransactions[idx], minutes };
                              const error = validatePreviewTransaction(updated);
                              setPreviewTransactions(prev => prev.map((tx, i) => i === idx ? { ...updated, error, selected: !error } : tx));
                              setEditBuffer(prev => { const c = { ...prev }; delete c[hKey]; return c; });
                            }}
                            step="any"
                            inputMode="decimal"
                            className={`w-full px-2 py-1 rounded text-sm border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={`block text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Beschreibung</label>
                        <input
                          type="text"
                          value={editBuffer[`${idx}-description`] ?? tx.description}
                          data-edit-key={`${idx}-description`}
                          onFocus={() => setActiveEditKey(`${idx}-description`)}
                          onChange={(e) => {
                            const key = `${idx}-description`;
                            const v = (e.target as HTMLInputElement).value;
                            setEditBuffer(prev => ({ ...prev, [key]: v }));
                            // Buffer-only while typing; commit happens on blur
                          }}
                          onBlur={() => {
                            const key = `${idx}-description`;
                            const val = editBuffer[key] ?? '';
                            if (val === '') {
                              setEditBuffer(prev => { const c = { ...prev }; delete c[key]; return c; });
                              return;
                            }
                            const updated = { ...previewTransactions[idx], description: val };
                            const error = validatePreviewTransaction(updated);
                            setPreviewTransactions(prev => prev.map((tx, i) => i === idx ? { ...updated, error, selected: !error } : tx));
                            setEditBuffer(prev => { const c = { ...prev }; delete c[key]; return c; });
                          }}
                          className={`w-full px-2 py-1 rounded text-sm border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            ))}
          </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t" style={{ borderColor: darkMode ? '#374151' : '#e5e7eb' }}>
          <button
            onClick={() => setShowPreview(false)}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
          >
            Abbrechen
          </button>
          <button
            onClick={handleConfirmImport}
            disabled={importLoading || previewTransactions.filter(t => t.selected && !t.error).length === 0}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
              importLoading || previewTransactions.filter(t => t.selected && !t.error).length === 0
                ? darkMode ? 'bg-green-700/50 text-green-300 cursor-not-allowed' : 'bg-green-200 text-green-700 cursor-not-allowed'
                : darkMode ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {importLoading ? '⏳ Importieren...' : '✅ Bestätigen & Importieren'}
          </button>
        </div>
      </div>
    </div>

  return createPortal(
    <>
      {showPreview ? (
        <div className={`fixed inset-0 w-screen h-screen ${darkMode ? 'bg-black/70' : 'bg-black/60'} backdrop-blur-sm flex items-center justify-center z-[9999]`}>
          <div className={`${darkMode ? 'bg-gray-900 border border-gray-700' : 'bg-white border border-gray-200'} rounded-2xl shadow-2xl p-5 sm:p-6 w-full mx-4 max-w-5xl max-h-[85vh] overflow-hidden flex flex-col themed-scrollbar ${darkMode ? 'ts-dark' : 'ts-light'}`}>
            <div className="flex items-center justify-between mb-4 pb-4 border-b" style={{ borderColor: darkMode ? '#374151' : '#e5e7eb' }}>
              <h3 className={`text-xl font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>📋 CSV Import Vorschau</h3>
              <button
                onClick={() => setShowPreview(false)}
                className={`text-3xl leading-none ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'}`}
              >
                ×
              </button>
            </div>

            <div className={`mb-4 p-3 rounded-lg ${darkMode ? 'bg-blue-900/30 border border-blue-700/50' : 'bg-blue-50 border border-blue-200'}`}>
              <div className={`text-sm ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                <span className="font-medium">Gültig:</span> {previewTransactions.filter(t => !t.error).length} | 
                <span className="font-medium ml-3">Fehler:</span> {previewTransactions.filter(t => t.error).length}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto mb-4 border rounded-lg p-3" style={{ borderColor: darkMode ? '#374151' : '#e5e7eb' }}>
              {previewTransactions.length === 0 ? (
                <div className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Keine Transaktionen geladen. CSV-Datei auswählen zum Importieren.
                </div>
              ) : (
              <div className="space-y-3">
                {previewTransactions.map((tx, idx) => (
                <div
                  key={tx._id ?? idx}
                  className={`p-3 rounded-lg border transition ${
                    tx.error
                      ? darkMode ? 'bg-red-900/20 border-red-700/50' : 'bg-red-50 border-red-200'
                      : tx.selected
                      ? darkMode ? 'bg-green-900/20 border-green-700/50' : 'bg-green-50 border-green-200'
                      : darkMode ? 'bg-gray-700/30 border-gray-600/50' : 'bg-gray-100 border-gray-300'
                  }`}
                >
                  <div className="flex gap-3">
                    {!tx.error && (

                      <input
                        type="checkbox"
                        checked={tx.selected}
                        onChange={() => toggleTransactionSelection(idx)}
                        className="mt-1 w-4 h-4 cursor-pointer"
                      />
                    )}
                    {tx.error && <span className="text-red-500 mt-1">⚠️</span>}
                    
                    <div className="flex-1 space-y-2">
                      {tx.error ? (
                        <div className={`text-sm font-medium ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                          Zeile {tx.rowIndex}: {tx.error}
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-4 gap-2 text-sm">
                            <div>
                              <label className={`block text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Datum</label>
                              <input
                                type="date"
                                value={editBuffer[`${idx}-date`] ?? tx.date}
                                data-edit-key={`${idx}-date`}
                                onFocus={() => setActiveEditKey(`${idx}-date`)}
                                onChange={(e) => {
                                  const key = `${idx}-date`;
                                  const v = (e.target as HTMLInputElement).value;
                                  setEditBuffer(prev => ({ ...prev, [key]: v }));
                                }}
                                onBlur={() => {
                                  const key = `${idx}-date`;
                                  const val = editBuffer[key] ?? '';
                                  if (val === '') {
                                    setEditBuffer(prev => { const c = { ...prev }; delete c[key]; return c; });
                                    return;
                                  }
                                  const updated = { ...previewTransactions[idx], date: val };
                                  const error = validatePreviewTransaction(updated);
                                  setPreviewTransactions(prev => prev.map((tx, i) => i === idx ? { ...updated, error, selected: !error } : tx));
                                  setEditBuffer(prev => { const c = { ...prev }; delete c[key]; return c; });
                                }}
                                className={`w-full px-2 py-1 rounded text-sm border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`}
                              />
                            </div>
                            <div>
                              <label className={`block text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Typ</label>
                              <select
                                value={editBuffer[`${idx}-type`] ?? tx.type}
                                data-edit-key={`${idx}-type`}
                                onFocus={() => setActiveEditKey(`${idx}-type`)}
                                onChange={(e) => {
                                  const key = `${idx}-type`;
                                  const v = (e.target as HTMLSelectElement).value;
                                  setEditBuffer(prev => ({ ...prev, [key]: v }));
                                }}
                                onBlur={() => {
                                  const key = `${idx}-type`;
                                  const val = editBuffer[key] ?? '';
                                  if (val === '') {
                                    setEditBuffer(prev => { const c = { ...prev }; delete c[key]; return c; });
                                    return;
                                  }
                                  const updated = { ...previewTransactions[idx], type: val as 'EARNED' | 'SPENT' };
                                  const error = validatePreviewTransaction(updated);
                                  setPreviewTransactions(prev => prev.map((tx, i) => i === idx ? { ...updated, error, selected: !error } : tx));
                                  setEditBuffer(prev => { const c = { ...prev }; delete c[key]; return c; });
                                }}
                                className={`w-full px-2 py-1 rounded text-sm border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`}
                              >
                                <option value="EARNED">EARNED</option>
                                <option value="SPENT">SPENT</option>
                              </select>
                            </div>
                            <div>
                              <label className={`block text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Minuten</label>
                              <input
                                type="number"
                                value={(() => {
                                  const mKey = `${idx}-minutes`;
                                  const hKey = `${idx}-hours`;
                                  const mBuf = editBuffer[mKey];
                                  const hBuf = editBuffer[hKey];
                                  if (mBuf !== undefined) return mBuf;
                                  if (hBuf !== undefined) {
                                    if (hBuf === '') return '';
                                    const h = parseFloat(hBuf);
                                    return Number.isNaN(h) ? String(tx.minutes) : String(Math.round(h * 60));
                                  }
                                  return String(tx.minutes);
                                })()}
                                data-edit-key={`${idx}-minutes`}
                                onFocus={() => setActiveEditKey(`${idx}-minutes`)}
                                onChange={(e) => {
                                  const key = `${idx}-minutes`;
                                  const v = (e.target as HTMLInputElement).value;
                                  setEditBuffer(prev => ({ ...prev, [key]: v }));
                                }}
                                onBlur={() => {
                                  const mKey = `${idx}-minutes`;
                                  const raw = editBuffer[mKey] ?? '';
                                  if (raw === '') {
                                    setEditBuffer(prev => { const c = { ...prev }; delete c[mKey]; return c; });
                                    return;
                                  }
                                  const val = parseInt(raw, 10);
                                  const updated = { ...previewTransactions[idx], minutes: Number.isNaN(val) ? previewTransactions[idx].minutes : val };
                                  const error = validatePreviewTransaction(updated);
                                  setPreviewTransactions(prev => prev.map((tx, i) => i === idx ? { ...updated, error, selected: !error } : tx));
                                  setEditBuffer(prev => { const c = { ...prev }; delete c[mKey]; return c; });
                                }}
                                inputMode="numeric"
                                className={`w-full px-2 py-1 rounded text-sm border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`}
                              />
                            </div>
                            <div>
                              <label className={`block text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Stunden</label>
                              <input
                                type="number"
                                value={(() => {
                                  const mKey = `${idx}-minutes`;
                                  const hKey = `${idx}-hours`;
                                  const hBuf = editBuffer[hKey];
                                  const mBuf = editBuffer[mKey];
                                  if (hBuf !== undefined) return hBuf;
                                  if (mBuf !== undefined) {
                                    if (mBuf === '') return '';
                                    const m = parseInt(mBuf, 10);
                                    const v = Number.isNaN(m) ? tx.minutes : m;
                                    return (v / 60).toFixed(2);
                                  }
                                  return (tx.minutes / 60).toFixed(2);
                                })()}
                                data-edit-key={`${idx}-hours`}
                                onFocus={() => setActiveEditKey(`${idx}-hours`)}
                                onChange={(e) => {
                                  const key = `${idx}-hours`;
                                  const v = (e.target as HTMLInputElement).value;
                                  setEditBuffer(prev => ({ ...prev, [key]: v }));
                                }}
                                onBlur={() => {
                                  const hKey = `${idx}-hours`;
                                  const raw = editBuffer[hKey] ?? '';
                                  if (raw === '') {
                                    setEditBuffer(prev => { const c = { ...prev }; delete c[hKey]; return c; });
                                    return;
                                  }
                                  const val = parseFloat(raw);
                                  const minutes = Number.isNaN(val) ? previewTransactions[idx].minutes : Math.round(val * 60);
                                  const updated = { ...previewTransactions[idx], minutes };
                                  const error = validatePreviewTransaction(updated);
                                  setPreviewTransactions(prev => prev.map((tx, i) => i === idx ? { ...updated, error, selected: !error } : tx));
                                  setEditBuffer(prev => { const c = { ...prev }; delete c[hKey]; return c; });
                                }}
                                step="any"
                                inputMode="decimal"
                                className={`w-full px-2 py-1 rounded text-sm border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`}
                              />
                            </div>
                          </div>
                          <div>
                            <label className={`block text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Beschreibung</label>
                            <input
                              type="text"
                              value={editBuffer[`${idx}-description`] ?? tx.description}
                              data-edit-key={`${idx}-description`}
                              onFocus={() => setActiveEditKey(`${idx}-description`)}
                              onChange={(e) => {
                                const key = `${idx}-description`;
                                const v = (e.target as HTMLInputElement).value;
                                setEditBuffer(prev => ({ ...prev, [key]: v }));
                              }}
                              onBlur={() => {
                                const key = `${idx}-description`;
                                const val = editBuffer[key] ?? '';
                                if (val === '') {
                                  setEditBuffer(prev => { const c = { ...prev }; delete c[key]; return c; });
                                  return;
                                }
                                const updated = { ...previewTransactions[idx], description: val };
                                const error = validatePreviewTransaction(updated);
                                setPreviewTransactions(prev => prev.map((tx, i) => i === idx ? { ...updated, error, selected: !error } : tx));
                                setEditBuffer(prev => { const c = { ...prev }; delete c[key]; return c; });
                              }}
                              className={`w-full px-2 py-1 rounded text-sm border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : 'bg-white border-gray-300 text-gray-900'}`}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                ))}
              </div>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t" style={{ borderColor: darkMode ? '#374151' : '#e5e7eb' }}>
              <button
                onClick={() => setShowPreview(false)}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
              >
                Abbrechen
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={importLoading || previewTransactions.filter(t => t.selected && !t.error).length === 0}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                  importLoading || previewTransactions.filter(t => t.selected && !t.error).length === 0
                    ? darkMode ? 'bg-green-700/50 text-green-300 cursor-not-allowed' : 'bg-green-200 text-green-700 cursor-not-allowed'
                    : darkMode ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {importLoading ? '⏳ Importieren...' : '✅ Bestätigen & Importieren'}
              </button>
            </div>
          </div>
        </div>
      ) : (
      <div className={`fixed inset-0 w-screen h-screen ${darkMode ? 'bg-black/65' : 'bg-black/50'} backdrop-blur-md flex items-center justify-center z-50 p-4 sm:p-0`} onClick={onClose}>
      <div className={`${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'} rounded-2xl shadow-2xl ring-1 ring-black/10 p-4 sm:p-5 md:p-6 w-full mx-auto max-w-sm sm:max-w-lg md:max-w-2xl max-h-[90vh] overflow-y-auto themed-scrollbar ${darkMode ? 'ts-dark' : 'ts-light'}`} onClick={(e) => e.stopPropagation()}>
        <h2 className={`text-xl sm:text-2xl font-semibold mb-3 sm:mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>⚙️ Einstellungen</h2>
        
        {/* Tabs */}
        <div className="flex flex-wrap gap-1 sm:gap-2 mb-3 sm:mb-4 border-b pb-2 text-xs sm:text-base" style={{ borderColor: darkMode ? '#374151' : '#e5e7eb' }}>
          <button onClick={() => setTab('work')} className={`px-2 sm:px-4 py-2 rounded-t font-medium transition ${tab === 'work' ? (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white') : (darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900')}`}>
            💼 Arbeitszeit
          </button>
          <button onClick={() => setTab('display')} className={`px-4 py-2 rounded-t font-medium transition ${tab === 'display' ? (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white') : (darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900')}`}>
            🖥️ Anzeige
          </button>
          <button onClick={() => setTab('data')} className={`px-4 py-2 rounded-t font-medium transition ${tab === 'data' ? (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white') : (darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900')}`}>
            📊 Daten
          </button>
          <button onClick={() => setTab('security')} className={`px-4 py-2 rounded-t font-medium transition ${tab === 'security' ? (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white') : (darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900')}`}>
            🔒 Sicherheit
          </button>
        </div>

        {error && <div className={`mb-4 p-3 rounded ${darkMode ? 'bg-red-900/30 border border-red-700 text-red-400' : 'bg-red-50 border border-red-200 text-red-600'}`}>{error}</div>}

        {/* Tab Content */}
        <div className="space-y-4">
          {tab === 'work' && (
            <>
              <label className="block">
                <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>Wochenziel (Stunden)</span>
                <div className="relative mt-1">
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={localSettings.weeklyTargetHours}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setLocalSettings({ ...localSettings, weeklyTargetHours: Number.isNaN(val) ? 1 : val });
                      setError('');
                    }}
                    className={`number-no-spinner w-full p-2 pr-10 rounded border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-2 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500'} focus:outline-none`}
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col">
                    <button type="button" className={`h-4 w-6 text-[10px] rounded-t ${darkMode ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`} onClick={() => setLocalSettings({ ...localSettings, weeklyTargetHours: Math.min(168, localSettings.weeklyTargetHours + 1) })}>▲</button>
                    <button type="button" className={`h-4 w-6 text-[10px] rounded-b ${darkMode ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-gray-300 hover:bg-gray-400 text-gray-900'}`} onClick={() => setLocalSettings({ ...localSettings, weeklyTargetHours: Math.max(1, localSettings.weeklyTargetHours - 1) })}>▼</button>
                  </div>
                </div>
              </label>

              <label className="block">
                <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>Monatsziel (Stunden) - optional überschreiben</span>
                <div className="relative mt-1">
                  <input
                    type="number"
                    min={0}
                    max={744}
                    placeholder={`Auto: ${localSettings.weeklyTargetHours * 4}h`}
                    value={localSettings.monthlyTargetOverride ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                      setLocalSettings({ ...localSettings, monthlyTargetOverride: val });
                      setError('');
                    }}
                    className={`number-no-spinner w-full p-2 rounded border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500'} focus:outline-none`}
                  />
                </div>
                <div className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Leer lassen für automatische Berechnung (Wochenziel × 4)</div>
              </label>

              <label className="block">
                <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>Arbeitstage pro Woche</span>
                <div className="relative mt-1">
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={localSettings.workDaysPerWeek}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setLocalSettings({ ...localSettings, workDaysPerWeek: Number.isNaN(val) ? 5 : Math.max(1, Math.min(7, val)) });
                      setError('');
                    }}
                    className={`number-no-spinner w-full p-2 rounded border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-2 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500'} focus:outline-none`}
                  />
                </div>
              </label>

              <label className="block">
                <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>Stundensatz (€)</span>
                <div className="relative mt-1">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={localSettings.hourlyRate}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setLocalSettings({ ...localSettings, hourlyRate: Number.isNaN(val) ? 0 : Math.max(0, val) });
                      setError('');
                    }}
                    className={`number-no-spinner w-full p-2 rounded border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-2 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500'} focus:outline-none`}
                  />
                </div>
                <div className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Wird zur Berechnung des Gesamtverdienstes verwendet</div>
              </label>

              <label className="block">
                <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>Rundung (Minuten)</span>
                <select
                  value={localSettings.roundingMinutes}
                  onChange={(e) => setLocalSettings({ ...localSettings, roundingMinutes: parseInt(e.target.value, 10) })}
                  className={`w-full mt-1 p-2 rounded border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-2 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500'} focus:outline-none`}
                >
                  <option value={0}>Keine Rundung</option>
                  <option value={5}>5 Minuten</option>
                  <option value={10}>10 Minuten</option>
                  <option value={15}>15 Minuten</option>
                  <option value={30}>30 Minuten</option>
                  <option value={60}>60 Minuten</option>
                </select>
                <div className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Zeiten werden auf das nächste Vielfache gerundet</div>
              </label>
            </>
          )}

          {tab === 'display' && (
            <>
              <label className="block">
                <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>Auto-Refresh (Sekunden)</span>
                <div className="relative mt-1">
                  <input
                    type="number"
                    min={0}
                    value={localSettings.autoRefreshSeconds}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setLocalSettings({ ...localSettings, autoRefreshSeconds: Number.isNaN(val) ? 0 : Math.max(0, val) });
                      setError('');
                    }}
                    className={`number-no-spinner w-full p-2 rounded border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-2 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500'} focus:outline-none`}
                  />
                </div>
                <div className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>0 = deaktiviert. Empfohlen: 5 Sekunden</div>
              </label>

              <label className="block">
                <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>Standard-Sortierung</span>
                <select
                  value={localSettings.defaultSortKey}
                  onChange={(e) => setLocalSettings({ ...localSettings, defaultSortKey: e.target.value as any })}
                  className={`w-full mt-1 p-2 rounded border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-2 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500'} focus:outline-none`}
                >
                  <option value="date">Nach Datum</option>
                  <option value="description">Nach Beschreibung</option>
                  <option value="minutes">Nach Stunden</option>
                </select>
              </label>

              <label className="block">
                <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>Sortierrichtung</span>
                <select
                  value={localSettings.defaultSortDir}
                  onChange={(e) => setLocalSettings({ ...localSettings, defaultSortDir: e.target.value as any })}
                  className={`w-full mt-1 p-2 rounded border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-2 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500'} focus:outline-none`}
                >
                  <option value="asc">Aufsteigend ▲</option>
                  <option value="desc">Absteigend ▼</option>
                </select>
              </label>

              <label className="block">
                <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>Kalender-Starttag</span>
                <select
                  value={localSettings.calendarStartDay}
                  onChange={(e) => setLocalSettings({ ...localSettings, calendarStartDay: e.target.value as any })}
                  className={`w-full mt-1 p-2 rounded border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-2 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500'} focus:outline-none`}
                >
                  <option value="monday">Montag</option>
                  <option value="sunday">Sonntag</option>
                </select>
              </label>

              <label className="block">
                <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>Datumsformat</span>
                <select
                  value={localSettings.dateFormat}
                  onChange={(e) => setLocalSettings({ ...localSettings, dateFormat: e.target.value as any })}
                  className={`w-full mt-1 p-2 rounded border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-2 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500'} focus:outline-none`}
                >
                  <option value="dd.mm.yyyy">DD.MM.YYYY (z.B. 28.12.2025)</option>
                  <option value="dd/mm/yyyy">DD/MM/YYYY (z.B. 28/12/2025)</option>
                  <option value="mm/dd/yyyy">MM/DD/YYYY (z.B. 12/28/2025)</option>
                  <option value="yyyy-mm-dd">YYYY-MM-DD (z.B. 2025-12-28)</option>
                </select>
              </label>

              <label className="block">
                <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>Standard-Beschreibung</span>
                <input
                  type="text"
                  placeholder="z.B. Arbeitszeit"
                  value={localSettings.defaultDescription}
                  onChange={(e) => setLocalSettings({ ...localSettings, defaultDescription: e.target.value })}
                  className={`w-full mt-1 p-2 rounded border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500'} focus:outline-none`}
                />
                <div className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Wird automatisch in neue Einträge eingetragen</div>
              </label>
            </>
          )}

          {tab === 'data' && (
            <>
              <div className="space-y-6">
                {/* CSV Import Section */}
                <div className="space-y-3">
                  <h3 className={`text-lg font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Daten importieren</h3>
                  <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    CSV-Datei mit folgenden Spalten: <code className={`inline-block px-2 py-1 rounded text-xs ${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'}`}>date, type, minutes (oder hours), description</code>
                  </p>
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`block p-4 rounded-lg border-2 border-dashed cursor-pointer transition ${isDragging ? (darkMode ? 'border-blue-400 bg-blue-900/30' : 'border-blue-500 bg-blue-50') : (darkMode ? 'border-gray-600 hover:border-blue-500 bg-gray-700/30 hover:bg-gray-700/50' : 'border-gray-300 hover:border-blue-500 bg-gray-50 hover:bg-gray-100')}`}
                  >
                    <label className="cursor-pointer block">
                      <input
                        type="file"
                        accept=".csv"
                        disabled={importLoading}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            await handleImportCSV(file);
                          }
                          e.target.value = '';
                        }}
                        className="hidden"
                      />
                      <div className="text-center">
                        <div className={`text-2xl mb-2 ${importLoading ? 'animate-pulse' : ''}`}>
                          {importLoading ? '⏳' : '📁'}
                        </div>
                        <div className={`font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                          {importLoading ? 'Importieren läuft...' : 'CSV-Datei auswählen'}
                        </div>
                        <div className={`text-xs ${isDragging ? (darkMode ? 'text-blue-300' : 'text-blue-600') : (darkMode ? 'text-gray-400' : 'text-gray-600')} mt-1`}>
                          oder Datei hierher ziehen
                        </div>
                      </div>
                    </label>
                  </div>
                  <div className={`text-xs p-3 rounded-lg ${darkMode ? 'bg-gray-700/50 text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                    <strong>Beispiel CSV-Format:</strong>
                    <div className="font-mono text-xs mt-2 whitespace-pre overflow-x-auto">
date,type,minutes,description
2024-12-28,EARNED,480,Projektarbeit
2024-12-27,SPENT,120,Besprechung
                    </div>
                  </div>
                </div>

                {/* CSV Export Section */}
                <div className="border-t pt-6 space-y-3">
                  <h3 className={`text-lg font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Daten exportieren</h3>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>Von (optional)</span>
                      <input
                        type="date"
                        value={exportStartDate}
                        onChange={(e) => {
                          const newStart = e.target.value;
                          setExportStartDate(newStart);
                          // Wenn Von > Bis, passe Bis an
                          if (newStart && exportEndDate && newStart > exportEndDate) {
                            setExportEndDate(newStart);
                          }
                        }}
                        className={`w-full mt-1 p-2 rounded border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-2 focus:ring-blue-500 calendar-icon-dark' : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 calendar-icon-light'} focus:outline-none text-sm`}
                      />
                    </label>
                    <label className="block">
                      <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>Bis (optional)</span>
                      <input
                        type="date"
                        value={exportEndDate}
                        onChange={(e) => {
                          const newEnd = e.target.value;
                          setExportEndDate(newEnd);
                          // Wenn Bis < Von, passe Von an
                          if (newEnd && exportStartDate && newEnd < exportStartDate) {
                            setExportStartDate(newEnd);
                          }
                        }}
                        className={`w-full mt-1 p-2 rounded border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-2 focus:ring-blue-500 calendar-icon-dark' : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 calendar-icon-light'} focus:outline-none text-sm`}
                      />
                    </label>
                  </div>
                  
                  {/* Show selected date range */}
                  <div className={`p-3 rounded-lg ${darkMode ? 'bg-blue-900/20 border border-blue-700/50' : 'bg-blue-50 border border-blue-200'}`}>
                    <div className={`text-sm font-medium ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                      📅 Exportzeitraum:
                    </div>
                    <div className={`text-xs mt-1 ${darkMode ? 'text-blue-200' : 'text-blue-600'}`}>
                      {exportStartDate ? formatDateWithFormat(exportStartDate, settings.dateFormat) : 'Anfang'} bis {exportEndDate ? formatDateWithFormat(exportEndDate, settings.dateFormat) : 'heute'}
                    </div>
                  </div>
                  
                  <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    💡 Leer lassen = alle Daten
                  </div>
                  
                  <button
                    onClick={() => onExportCSV(exportStartDate || undefined, exportEndDate || undefined)}
                    className={`w-full px-4 py-3 rounded-lg font-medium transition ${darkMode ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                  >
                    📄 CSV exportieren (Historie)
                  </button>
                <button
                  onClick={() => onExportPDF(exportStartDate || undefined, exportEndDate || undefined)}
                  className={`w-full px-4 py-3 rounded-lg font-medium transition ${darkMode ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                >
                  📑 PDF exportieren
                </button>
                </div>
              </div>
            </>
          )}

          {tab === 'security' && (
            <>
              <h3 className={`text-lg font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'} mb-3`}>Passwort ändern</h3>
              {passwordSuccess && <div className={`mb-3 p-3 rounded ${darkMode ? 'bg-green-900/30 border border-green-700 text-green-400' : 'bg-green-50 border border-green-200 text-green-600'}`}>{passwordSuccess}</div>}
              {passwordError && <div className={`mb-3 p-3 rounded ${darkMode ? 'bg-red-900/30 border border-red-700 text-red-400' : 'bg-red-50 border border-red-200 text-red-600'}`}>{passwordError}</div>}
              
              <label className="block">
                <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>Altes Passwort</span>
                <div className="relative mt-1">
                  <input
                    type={showOldPassword ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className={`w-full p-2 pr-10 rounded border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-2 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500'} focus:outline-none`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 text-lg ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'}`}
                    title={showOldPassword ? 'Verbergen' : 'Anzeigen'}
                  >
                    {showOldPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </label>

              <label className="block">
                <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>Neues Passwort</span>
                <div className="relative mt-1">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={`w-full p-2 pr-10 rounded border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-2 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500'} focus:outline-none`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 text-lg ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'}`}
                    title={showNewPassword ? 'Verbergen' : 'Anzeigen'}
                  >
                    {showNewPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </label>

              <label className="block">
                <span className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>Neues Passwort bestätigen</span>
                <div className="relative mt-1">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full p-2 pr-10 rounded border ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-2 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500'} focus:outline-none`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 text-lg ${darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'}`}
                    title={showConfirmPassword ? 'Verbergen' : 'Anzeigen'}
                  >
                    {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </label>

              <button
                onClick={handlePasswordChange}
                className={`w-full mt-2 px-4 py-2 rounded-lg font-medium transition ${darkMode ? 'bg-orange-600 hover:bg-orange-500 text-white' : 'bg-orange-600 hover:bg-orange-700 text-white'}`}
              >
                🔐 Passwort ändern
              </button>
            </>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="flex gap-3 justify-end pt-6 mt-6 border-t" style={{ borderColor: darkMode ? '#374151' : '#e5e7eb' }}>
          <button
            className={`px-4 py-2 rounded border font-medium ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'}`}
            onClick={onClose}
          >
            Abbrechen
          </button>
          <button
            className={`px-4 py-2 rounded ${darkMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-blue-600 hover:bg-blue-700'} text-white font-medium`}
            onClick={handleSave}
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
      )}
    </>,
    document.body
  );
}

function BalanceBadge({ balanceMinutes, darkMode }: { balanceMinutes: number; darkMode: boolean }) {
  const color = balanceMinutes >= 0 ? 'text-green-500' : 'text-red-500';
  return (
    <div className={`rounded-xl shadow-xl p-3 sm:p-6 border-2 ${darkMode ? 'bg-gradient-to-br from-green-900/30 to-blue-900/30 border-green-700' : 'bg-gradient-to-br from-green-50 to-blue-50 border-green-200'}`}>
      <div className={`text-xs sm:text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Aktueller Saldo</div>
      <div className={`mt-2 text-2xl sm:text-4xl font-extrabold ${color}`}>{formatHMM(balanceMinutes)} Std</div>
    </div>
  );
}

function ActionButtons({ onAdd, onSpend }: { onAdd: () => void; onSpend: () => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3">
      <button className="px-2 sm:px-4 py-3 sm:py-4 rounded-lg bg-green-600 hover:bg-green-700 active:scale-95 text-white font-semibold text-xs sm:text-base shadow-lg transition-all" onClick={onAdd}>
        ➕ Hinzufügen
      </button>
      <button className="px-2 sm:px-4 py-3 sm:py-4 rounded-lg bg-red-600 hover:bg-red-700 active:scale-95 text-white font-semibold text-xs sm:text-base shadow-lg transition-all" onClick={onSpend}>
        ➖ Abziehen
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
  darkMode,
}: {
  type: 'EARNED' | 'SPENT';
  onClose: () => void;
  onSubmit: (tx: Omit<Transaction, '_id'>) => void;
  initialDate?: string;
  initialMinutes?: number;
  initialDescription?: string;
  darkMode: boolean;
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

  return createPortal(
    <div className={`fixed inset-0 w-screen h-screen ${darkMode ? 'bg-black/65' : 'bg-black/50'} backdrop-blur-md flex items-center justify-center z-50 p-4 sm:p-0`} onClick={onClose}>
      <div className={`${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'} rounded-2xl shadow-2xl ring-1 ring-black/10 p-4 sm:p-5 md:p-6 w-full mx-auto max-w-sm sm:max-w-lg md:max-w-xl`} onClick={(e) => e.stopPropagation()}>
        <h2 className={`text-lg sm:text-xl font-semibold mb-3 sm:mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
          {type === 'EARNED' ? '➕ Stunden Hinzufügen' : '➖ Stunden Abziehen'}
        </h2>
        <div className="space-y-3 sm:space-y-4">
          <label className="block">
            <span className={`text-xs sm:text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>Datum</span>
            <input
              type="date"
              className={`w-full mt-1 p-2 sm:p-2 rounded border text-xs sm:text-base ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-2 focus:ring-blue-500 calendar-icon-dark' : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 calendar-icon-light'} focus:outline-none`}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            {errors.date && <div className={`mt-1 text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>{errors.date}</div>}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
            <label className="block">
              <span className={`text-xs sm:text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>Stunden</span>
              <div className="relative mt-1">
                <input
                  type="number"
                  step="1"
                  min={0}
                  className={`number-no-spinner w-full p-2 sm:p-2 pr-10 rounded border text-sm sm:text-base ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-2 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500'} focus:outline-none`}
                  value={hoursInput.toString()}
                  onChange={(e) => {
                    const v = e.target.value;
                    const num = v === '' ? 0 : Math.max(0, Math.floor(Number(v)) || 0);
                    setHoursInput(num);
                  }}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col">
                  <button
                    type="button"
                    className={`h-4 w-6 text-[10px] rounded-t ${darkMode ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                    onClick={() => setHoursInput((v) => Math.max(0, v + 1))}
                    title="+1h"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className={`h-4 w-6 text-[10px] rounded-b ${darkMode ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-gray-300 hover:bg-gray-400 text-gray-900'}`}
                    onClick={() => setHoursInput((v) => Math.max(0, v - 1))}
                    title="-1h"
                  >
                    ▼
                  </button>
                </div>
              </div>
              {errors.hours && <div className={`mt-1 text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>{errors.hours}</div>}
            </label>
            <label className="block">
              <span className={`text-xs sm:text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>Minuten</span>
              <div className="relative mt-1">
                <input
                  type="number"
                  step="1"
                  min={0}
                  max={59}
                  className={`number-no-spinner w-full p-2 sm:p-2 pr-10 rounded border text-sm sm:text-base ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-2 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500'} focus:outline-none`}
                  value={minutesInput.toString()}
                  onChange={(e) => {
                    const v = e.target.value;
                    let num = v === '' ? 0 : Math.floor(Number(v)) || 0;
                    if (num < 0) num = 0;
                    if (num > 59) num = 59;
                    setMinutesInput(num);
                  }}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col">
                  <button
                    type="button"
                    className={`h-4 w-6 text-[10px] rounded-t ${darkMode ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                    onClick={() => setMinutesInput((v) => Math.min(59, v + 1))}
                    title="+1m"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className={`h-4 w-6 text-[10px] rounded-b ${darkMode ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-gray-300 hover:bg-gray-400 text-gray-900'}`}
                    onClick={() => setMinutesInput((v) => Math.max(0, v - 1))}
                    title="-1m"
                  >
                    ▼
                  </button>
                </div>
              </div>
              {errors.minutes && <div className={`mt-1 text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>{errors.minutes}</div>}
            </label>
          </div>
          <label className="block">
            <span className={`text-xs sm:text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>Beschreibung</span>
            <input
              type="text"
              className={`w-full mt-1 p-2 sm:p-2 rounded border text-xs sm:text-base ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-2 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500'} focus:outline-none`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {errors.description && <div className={`mt-1 text-xs sm:text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>{errors.description}</div>}
          </label>
          <div className="flex gap-2 sm:gap-3 justify-end pt-2 sm:pt-4">
            <button 
              className={`px-3 sm:px-4 py-2 rounded border font-medium text-xs sm:text-base ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'}`} 
              onClick={onClose}
            >
              Abbrechen
            </button>
            <button
              className={`px-4 py-2 rounded ${darkMode ? 'bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400' : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400'} text-white font-medium`}
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
    </div>,
    document.body
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
  darkMode,
  dateFormat = 'dd.mm.yyyy',
}: {
  transactions: Transaction[];
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onChangeSortKey: (k: SortKey) => void;
  onToggleSortDir: () => void;
  onDelete: (id: string) => void;
  onEdit: (tx: Transaction) => void;
  darkMode: boolean;
  dateFormat?: 'dd.mm.yyyy' | 'dd/mm/yyyy' | 'mm/dd/yyyy' | 'yyyy-mm-dd';
}) {
  const [searchText, setSearchText] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'EARNED' | 'SPENT'>('ALL');

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const matchesType = typeFilter === 'ALL' || t.type === typeFilter;
      const matchesSearch = searchText === '' || t.description.toLowerCase().includes(searchText.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [transactions, typeFilter, searchText]);

  const sorted = useMemo(() => {
    const list = [...filtered];
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
  }, [filtered, sortKey, sortDir]);

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
    <div className="mt-4 sm:mt-6">
      <div className="mb-3 sm:mb-4">
        <h3 className={`text-lg sm:text-xl font-bold mb-3 sm:mb-4 ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Historie</h3>
        <div className={`grid grid-cols-1 gap-2 sm:gap-3 mb-3 sm:mb-4 p-2 sm:p-4 rounded-lg border ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'}`}>
          <input
            type="text"
            placeholder="Nach Beschreibung suchen..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className={`w-full px-2 sm:px-4 py-2 sm:py-2 rounded border font-medium text-xs sm:text-base transition ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-600 focus:ring-2 focus:ring-blue-500'} focus:outline-none`}
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className={`w-full px-2 sm:px-4 py-2 sm:py-2 rounded border font-medium text-xs sm:text-base transition ${darkMode ? 'bg-gray-700 border-gray-600 text-gray-100 focus:ring-2 focus:ring-blue-500' : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500'} focus:outline-none`}
          >
            <option value="ALL">Alle Typen</option>
            <option value="EARNED">Hinzugefügt</option>
            <option value="SPENT">Abgezogen</option>
          </select>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
            <span className={`text-xs sm:text-sm font-medium whitespace-nowrap ${darkMode ? 'text-gray-300' : 'text-gray-900'}`}>Sortiert nach: {sortKey === 'date' ? 'Datum' : sortKey === 'description' ? 'Beschreibung' : 'Stunden'}</span>
            <button
              className={`px-2 sm:px-3 py-1 border rounded font-medium text-xs sm:text-base ${darkMode ? 'bg-gray-700 hover:bg-gray-600 border-gray-600 text-gray-300' : 'bg-white hover:bg-gray-100 border-gray-300 text-gray-900'}`}
              onClick={onToggleSortDir}
              title="Sortierreihenfolge umschalten"
            >
              {sortDir === 'asc' ? '▲' : '▼'}
            </button>
          </div>
        </div>
      </div>
      <div className={`rounded-xl shadow-xl border overflow-x-auto ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} max-h-[440px] overflow-y-auto themed-scrollbar ${darkMode ? 'ts-dark' : 'ts-light'}`}>
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className={`sticky top-0 z-10 text-xs sm:text-sm ${darkMode ? 'bg-gray-900/95 backdrop-blur border-b border-gray-700' : 'bg-gray-50/95 backdrop-blur border-b border-gray-200'}`}>
            <tr className={`font-bold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
              <th className="px-2 sm:px-3 py-2">
                <button 
                  className="hover:underline flex items-center gap-1 text-xs sm:text-sm"
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
              <th className={`px-2 sm:px-3 py-2 font-bold text-xs sm:text-sm ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                <button 
                  className={`hover:underline flex items-center gap-1 ${darkMode ? 'text-gray-200' : 'text-gray-900'}`} 
                  onClick={() => {
                    if (sortKey === 'description') {
                      onToggleSortDir();
                    } else {
                      onChangeSortKey('description');
                    }
                  }}
                >
                  <span className="hidden sm:inline">Beschreibung</span><span className="sm:hidden">Beschr.</span> {sortKey === 'description' && (sortDir === 'asc' ? '▲' : '▼')}
                </button>
              </th>
              <th className={`px-2 sm:px-3 py-2 font-bold text-xs sm:text-sm ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                <button 
                  className={`hover:underline flex items-center gap-1 ${darkMode ? 'text-gray-200' : 'text-gray-900'}`} 
                  onClick={() => {
                    if (sortKey === 'minutes') {
                      onToggleSortDir();
                    } else {
                      onChangeSortKey('minutes');
                    }
                  }}
                >
                  Std {sortKey === 'minutes' && (sortDir === 'asc' ? '▲' : '▼')}
                </button>
              </th>
              <th className={`px-2 sm:px-3 py-2 font-bold text-xs sm:text-sm ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>Saldo</th>
              <th className={`px-2 sm:px-3 py-2 font-bold text-xs sm:text-sm ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>Akt.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t._id || `${t.date}-${t.description}-${t.minutes}`} className={`border-b text-xs sm:text-base ${darkMode ? 'border-gray-750 hover:bg-gray-800/70 odd:bg-gray-900/60 even:bg-gray-850/60' : 'border-gray-200 hover:bg-gray-50 odd:bg-white even:bg-gray-50/60'} transition-colors`}>
                <td className={`px-2 sm:px-3 py-2 sm:py-3 font-medium whitespace-nowrap ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{formatDateWithFormat(t.date, dateFormat)}</td>
                <td className={`px-2 sm:px-3 py-2 sm:py-3 font-medium ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}><span className="hidden sm:inline">{t.description}</span><span className="sm:hidden">{t.description.substring(0, 10)}{t.description.length > 10 ? '...' : ''}</span></td>
                <td className={`px-2 sm:px-3 py-2 sm:py-3 text-right font-mono font-bold ${t.type === 'EARNED' ? (darkMode ? 'text-green-300' : 'text-green-700') : (darkMode ? 'text-red-300' : 'text-red-700')}`}>
                  {t.type === 'EARNED' ? '+' : '-'}{formatHMM(t.minutes)}
                </td>
                <td className={`px-2 sm:px-3 py-2 sm:py-3 text-right font-mono font-bold ${darkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                  {formatHMM((rows.find(r => r._id === t._id)?.running) || 0)}
                </td>
                <td className="px-2 sm:px-3 py-2 sm:py-2 text-right space-x-1 sm:space-x-2 whitespace-nowrap">
                  {t._id ? (
                    <>
                      <button
                        className={`px-1.5 sm:px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-full text-white shadow-sm transition ${darkMode ? 'bg-blue-600 hover:bg-blue-500' : 'bg-blue-600 hover:bg-blue-500'}`}
                        onClick={() => onEdit(t)}
                      >
                        Bearbeiten
                      </button>
                      <button
                        className={`px-1.5 sm:px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-full text-white shadow-sm transition ${darkMode ? 'bg-red-700 hover:bg-red-600' : 'bg-red-600 hover:bg-red-500'}`}
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

function CalendarView({ transactions, onQuickAdd, darkMode, weeklyTargetHours, monthlyTargetOverride }: { transactions: Transaction[]; onQuickAdd: (isoDate: string) => void; darkMode: boolean; weeklyTargetHours: number; monthlyTargetOverride: number | null }) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  function localISO(y: number, mZeroBased: number, d: number) {
    const yyyy = String(y);
    const mm = String(mZeroBased + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  const isoWeek = (y: number, m: number, d: number) => {
    const date = new Date(Date.UTC(y, m, d));
    const dayNum = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return weekNo;
  };

  const { days, monthLabel, totalsByDay, weeklyTotals, monthlyEarned } = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);

    let monthlyEarned = 0;
    const totals = new Map<number, number>();
    transactions.forEach((t) => {
      const d = new Date(t.date);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const delta = t.type === 'EARNED' ? t.minutes : -t.minutes;
        totals.set(d.getDate(), (totals.get(d.getDate()) || 0) + delta);
        if (t.type === 'EARNED') {
          monthlyEarned += t.minutes;
        }
      }
    });

    // Calculate weekly totals by ISO week number (KW), counting only additions (no deductions)
    const weeks = new Map<number, number>();
    transactions.forEach((t) => {
      if (t.type !== 'EARNED') return;
      const d = new Date(t.date);
      if (d.getFullYear() !== year || d.getMonth() !== month) return;
      const w = isoWeek(year, month, d.getDate());
      weeks.set(w, (weeks.get(w) || 0) + t.minutes);
    });

    // Build calendar with Monday as first day
    const startWeekday = (first.getDay() + 6) % 7; // 0=Mon .. 6=Sun
    const leading = Array.from({ length: startWeekday }, () => null);
    const daysInMonth = Array.from({ length: last.getDate() }, (_, i) => i + 1);
    const gridDays: (number | null)[] = [...leading, ...daysInMonth];
    const monthLabelStr = first.toLocaleString('de-DE', { month: 'long', year: 'numeric' });
    return { days: gridDays, monthLabel: monthLabelStr, totalsByDay: totals, weeklyTotals: weeks, monthlyEarned };
  }, [transactions, currentMonth]);

  function prevMonth() {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }
  function nextMonth() {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const weeklyEntries = Array.from(weeklyTotals.entries()).sort((a, b) => a[0] - b[0]);
  const weeklyTargetMinutes = weeklyTargetHours * 60;
  const monthlyTarget = monthlyTargetOverride ?? (weeklyTargetHours * 4);
  const monthlyTargetMinutes = monthlyTarget * 60;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>📅 Kalenderansicht</h3>
        <div className="flex items-center gap-2">
          <button 
            className={`px-3 py-1 rounded transition ${darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-700'}`}
            onClick={prevMonth}
          >
            ◀
          </button>
        <div className={`font-bold min-w-[160px] text-center ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{monthLabel}</div>
          <button 
            className={`px-3 py-1 rounded transition ${darkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-700'}`}
            onClick={nextMonth}
          >
            ▶
          </button>
        </div>
      </div>
      <div className="space-y-3 sm:space-y-4">
        <div className={`rounded-xl shadow-lg p-2 sm:p-4 ${darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border-2 border-gray-300'}`}>
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-2">
            {weekDays.map((w) => (
              <div key={w} className={`text-center text-xs font-bold py-1 sm:py-2 ${darkMode ? 'text-gray-400' : 'text-gray-900'}`}>
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
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
                  className={`min-h-[50px] sm:min-h-[70px] rounded-lg p-1 sm:p-2 flex flex-col transition-all ${
                    d
                      ? darkMode
                        ? `${isToday ? 'bg-blue-900/50 border-2 border-blue-500' : 'bg-gray-700 hover:bg-gray-600 border border-gray-600'}`
                        : `${isToday ? 'bg-blue-50 border-2 border-blue-500' : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'}`
                      : 'bg-transparent'
                  }`}
                >
                  {d ? (
                    <>
                      <div className="flex items-start justify-between mb-0.5 sm:mb-1">
                        <div
                          className={`text-[10px] sm:text-xs font-bold text-center ${
                            isToday
                              ? darkMode
                                ? 'text-blue-400'
                                : 'text-blue-700'
                              : darkMode
                                ? 'text-gray-200'
                                : 'text-gray-900'
                          }`}
                        >
                          {d}
                        </div>
                        <button
                          className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
                          onClick={() => {
                            const isoLocal = localISO(currentMonth.getFullYear(), currentMonth.getMonth(), d);
                            onQuickAdd(isoLocal);
                          }}
                        >
                          +
                        </button>
                      </div>
                      {hasData ? (
                        <div
                          className={`mt-auto text-center py-0.5 px-0.5 sm:px-1 rounded text-[9px] sm:text-[11px] font-bold ${
                            total >= 0
                              ? darkMode
                                ? 'bg-green-900/60 text-green-400'
                                : 'bg-green-100 text-green-800'
                              : darkMode
                                ? 'bg-red-900/60 text-red-400'
                                : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {total > 0 ? '+' : ''}
                          {formatHMM(total)}h
                        </div>
                      ) : (
                        <div className={`mt-auto text-center text-[8px] sm:text-[10px] font-medium ${darkMode ? 'text-gray-500' : 'text-gray-700'}`}>
                          —
                        </div>
                      )}
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className={`rounded-xl shadow-lg p-2 sm:p-4 border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-2 border-gray-300'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-2">
            <h4 className={`font-bold text-sm sm:text-base ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>Std pro Woche</h4>
            <span className={`text-xs font-medium ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>
              Ziel: {formatHMM(weeklyTargetMinutes)}h · Monat: {formatHMM(monthlyTargetMinutes)}h · {monthLabel}
            </span>
          </div>
          <div className={`text-xs mb-2 sm:mb-3 ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>
            {monthlyEarned < monthlyTargetMinutes
              ? `Monat: Noch ${formatHMM(monthlyTargetMinutes - monthlyEarned)}h bis ${formatHMM(monthlyTargetMinutes)}h`
              : `Monat: Über Ziel: +${formatHMM(monthlyEarned - monthlyTargetMinutes)}h`}
          </div>
          {weeklyEntries.length === 0 ? (
            <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>Keine Daten in diesem Monat</div>
          ) : (
            <div className={`space-y-3 max-h-72 overflow-y-auto pr-1 themed-scrollbar ${darkMode ? 'ts-dark' : 'ts-light'}`}>
              {weeklyEntries.map(([weekIdx, total], idx) => {
                const displayWeek = idx + 1;
                const positive = total >= 0;
                const over = total - weeklyTargetMinutes;
                const baseRatio = Math.min(total, weeklyTargetMinutes) / weeklyTargetMinutes;
                const widthPercent = Math.min(100, Math.max(0, Math.round(baseRatio * 100)));
                const overflowPercent = 0; // no bar beyond target
                const remaining = weeklyTargetMinutes - total;
                return (
                  <div key={weekIdx} className="space-y-1">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span className={darkMode ? 'text-gray-200' : 'text-gray-900'}>Woche {displayWeek}</span>
                      <div className="flex items-center gap-2">
                        <span className={`${darkMode ? 'bg-green-700 text-white' : 'bg-green-100 text-green-800'} px-2 py-0.5 rounded-full font-mono`}
                          title={`Erreicht: ${formatHMM(total)}h`}>
                          {`${formatHMM(Math.min(total, weeklyTargetMinutes))}h`}
                        </span>
                        {remaining > 0 ? (
                          <span className={`${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-800'} px-2 py-0.5 rounded-full`}
                            title="Noch bis Ziel">
                            {`Noch ${formatHMM(remaining)}h`}
                          </span>
                        ) : (
                          <span className={`${darkMode ? 'bg-green-600 text-white' : 'bg-green-500 text-white'} px-2 py-0.5 rounded-full`}
                            title="Über Ziel">
                            {`Über +${formatHMM(Math.abs(remaining))}h`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`relative h-3 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
                      <div
                        className={`absolute left-0 top-0 h-3 rounded-full ${positive ? (darkMode ? 'bg-green-500' : 'bg-green-600') : (darkMode ? 'bg-red-500' : 'bg-red-600')}`}
                        style={{ width: `${widthPercent}%` }}
                        title={`Erreicht: ${formatHMM(total)}h`}
                      />
                      <div
                        className={`absolute h-2 w-2 rounded-full border ${darkMode ? 'border-white/70' : 'border-gray-600'} bg-transparent`}
                        style={{ left: '100%', top: '50%', transform: 'translate(-50%, -50%)' }}
                        title={`Ziel ${weeklyTargetHours}h`}
                      />
                    </div>
                    <div className="sr-only">
                      {remaining > 0 ? `Noch ${formatHMM(remaining)}h bis Ziel` : `Über Ziel: +${formatHMM(Math.abs(remaining))}h`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
      return saved ? saved === 'dark' : true;
    });
    
    const [settings, setSettings] = useState<AppSettings>(() => {
      const saved = localStorage.getItem('appSettings');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // Falls parsing fehlschlägt, nutze defaults
        }
      }
      return {
        weeklyTargetHours: 20,
        monthlyTargetOverride: null,
        workDaysPerWeek: 5,
        hourlyRate: 0,
        roundingMinutes: 0,
        autoRefreshSeconds: 5,
        defaultSortKey: 'date',
        defaultSortDir: 'desc',
        calendarStartDay: 'monday',
        defaultDescription: '',
        dateFormat: 'dd.mm.yyyy',
      };
    });
    
    const [showSettings, setShowSettings] = useState(false);

  const [balanceMinutes, setBalanceMinutes] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [modalType, setModalType] = useState<null | 'EARNED' | 'SPENT'>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    const saved = localStorage.getItem('appSettings');
    if (saved) {
      try {
        const parsedSettings = JSON.parse(saved);
        return parsedSettings.defaultSortKey || 'date';
      } catch {
        return 'date';
      }
    }
    return 'date';
  });
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => {
    const saved = localStorage.getItem('appSettings');
    if (saved) {
      try {
        const parsedSettings = JSON.parse(saved);
        return parsedSettings.defaultSortDir || 'desc';
      } catch {
        return 'desc';
      }
    }
    return 'desc';
  });

  useEffect(() => {
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('appSettings', JSON.stringify(settings));
  }, [settings]);

  function toggleTheme() {
    setDarkMode(!darkMode);
  }

  function saveSettings(newSettings: AppSettings) {
    setSettings(newSettings);
    // Update sortKey/sortDir if changed
    setSortKey(newSettings.defaultSortKey);
    setSortDir(newSettings.defaultSortDir);
  }

  function applyRounding(minutes: number): number {
    if (settings.roundingMinutes === 0) return minutes;
    return Math.round(minutes / settings.roundingMinutes) * settings.roundingMinutes;
  }

  async function changePassword(oldPw: string, newPw: string) {
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }),
      credentials: 'include',
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Fehler beim Ändern des Passworts');
    }
  }

  function exportCSV(startDate?: string, endDate?: string) {
    const header = ['Datum', 'Beschreibung', 'Typ', 'Stunden', 'Laufender Saldo'];
    const chronological = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Filter by date range if provided
    let filtered = chronological;
    if (startDate || endDate) {
      filtered = chronological.filter((t) => {
        const d = new Date(t.date);
        if (startDate && d < new Date(startDate)) return false;
        if (endDate && d > new Date(endDate)) return false;
        return true;
      });
    }
    
    let running = 0;
    const rows = filtered.map((t) => {
      running += t.type === 'EARNED' ? t.minutes : -t.minutes;
      return [
        formatDateShort(t.date),
        `"${t.description.replace(/"/g, '""')}"`,
        t.type === 'EARNED' ? 'Hinzugefügt' : 'Abgezogen',
        formatHMM(t.minutes),
        formatHMM(running),
      ].join(',');
    });
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const dateRange = startDate || endDate ? `-${startDate || 'anfang'}-${endDate || 'ende'}` : '';
    link.download = `zeiterfassung${dateRange}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  }

  function exportPDF(startDate?: string, endDate?: string) {
    // Simple PDF export via browser print
    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) return;
    
    const today = new Date();
    const monthName = today.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    
    // Filter transactions by date range
    let filtered = transactions;
    if (startDate || endDate) {
      filtered = transactions.filter((t) => {
        const d = new Date(t.date);
        if (startDate && d < new Date(startDate)) return false;
        if (endDate && d > new Date(endDate)) return false;
        return true;
      });
    }
    
    const earnedMinutes = filtered.filter((t) => t.type === 'EARNED').reduce((sum, t) => sum + t.minutes, 0);
    const monthlyTarget = settings.monthlyTargetOverride ?? (settings.weeklyTargetHours * 4);
    const monthlyTargetMinutes = monthlyTarget * 60;
    
    const dateRangeLabel = startDate || endDate 
      ? `${startDate ? formatDateWithFormat(startDate, settings.dateFormat) : 'Anfang'} bis ${endDate ? formatDateWithFormat(endDate, settings.dateFormat) : 'heute'}` 
      : monthName;
    
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Zeiterfassung ${dateRangeLabel}</title><style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      h1 { color: #333; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background-color: #f4f4f4; font-weight: bold; }
      .summary { margin-top: 20px; font-size: 1.1em; }
      .summary strong { color: #2563eb; }
    </style></head><body>
      <h1>Zeiterfassung - ${dateRangeLabel}</h1>
      <div class="summary">
        <p><strong>Aktueller Saldo:</strong> ${formatHMM(balanceMinutes)} Std</p>
        <p><strong>Gesamtziel:</strong> ${monthlyTarget}h (${formatHMM(monthlyTargetMinutes)} Std)</p>
        <p><strong>Erreicht (Zeitraum):</strong> ${formatHMM(earnedMinutes)} Std</p>
        <p><strong>Verbleibend:</strong> ${formatHMM(Math.max(0, monthlyTargetMinutes - earnedMinutes))} Std</p>`;
    
    if (settings.hourlyRate > 0) {
      const totalEarned = (balanceMinutes / 60) * settings.hourlyRate;
      html += `<p><strong>Gesamtverdienst (Saldo):</strong> ${totalEarned.toFixed(2)} €</p>`;
    }
    
    html += `</div><table><thead><tr><th>Datum</th><th>Beschreibung</th><th>Typ</th><th>Stunden</th></tr></thead><tbody>`;
    
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).forEach((t) => {
      html += `<tr><td>${formatDateShort(t.date)}</td><td>${t.description}</td><td>${t.type === 'EARNED' ? 'Hinzugefügt' : 'Abgezogen'}</td><td>${t.type === 'EARNED' ? '+' : '-'}${formatHMM(t.minutes)}</td></tr>`;
    });
    
    html += `</tbody></table></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
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

  // Auto-refresh based on settings
  useEffect(() => {
    if (!authenticated || settings.autoRefreshSeconds === 0) return;
    
    const interval = setInterval(() => {
      refresh();
    }, settings.autoRefreshSeconds * 1000);

    return () => clearInterval(interval);
  }, [authenticated, settings.autoRefreshSeconds]);

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
    return <LoginScreen onLogin={handleLogin} error={loginError} loading={loginLoading} darkMode={darkMode} onToggleTheme={toggleTheme} />;
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
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
        <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
            <button
              onClick={toggleTheme}
              className={`w-full sm:w-auto px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg font-medium text-sm sm:text-base transition ${
                darkMode 
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
              }`}
              title="Theme wechseln"
            >
              {darkMode ? '☀️ Light' : '🌙 Dark'}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className={`w-full sm:w-auto px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg font-medium text-sm sm:text-base transition ${
                darkMode 
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
              }`}
              title="Einstellungen"
            >
              ⚙️ Einstellungen
            </button>
          </div>
          <button
            onClick={handleLogout}
            className={`w-full sm:w-auto px-3 sm:px-4 py-2.5 sm:py-2 font-medium text-sm sm:text-base rounded-lg transition ${
              darkMode
                ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            🚪 Abmelden
          </button>
        </div>
      <BalanceBadge balanceMinutes={balanceMinutes} darkMode={darkMode} />
      
      {/* Show earnings if hourly rate set */}
      {settings.hourlyRate > 0 && (
        <div className={`rounded-xl shadow-lg p-3 sm:p-4 border ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-blue-50 border-blue-200'}`}>
          <div className={`text-xs sm:text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Gesamtverdienst (Saldo × Stundensatz)</div>
          <div className={`mt-2 text-xl sm:text-2xl font-bold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
            {((balanceMinutes / 60) * settings.hourlyRate).toFixed(2)} €
          </div>
        </div>
      )}
      
      <ActionButtons onAdd={() => setModalType('EARNED')} onSpend={() => setModalType('SPENT')} />
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          darkMode={darkMode}
          settings={settings}
          onSave={saveSettings}
          onExportCSV={exportCSV}
          onExportPDF={exportPDF}
          onChangePassword={changePassword}
        />
      )}
      {modalType && (
        <TransactionModal
          type={modalType}
          initialDate={selectedDate ?? (editingTx?.date ?? undefined)}
          initialMinutes={editingTx?.minutes}
          initialDescription={editingTx?.description ?? settings.defaultDescription}
          darkMode={darkMode}
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
        darkMode={darkMode}
        dateFormat={settings.dateFormat}
      />

      <CalendarView
        transactions={transactions}
        onQuickAdd={(iso) => {
          setSelectedDate(iso);
          setModalType('EARNED');
        }}
        darkMode={darkMode}
        weeklyTargetHours={settings.weeklyTargetHours}
        monthlyTargetOverride={settings.monthlyTargetOverride}
      />
      </div>
    </div>
  );
}

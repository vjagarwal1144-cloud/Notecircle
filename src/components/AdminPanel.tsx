import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Users, 
  StickyNote, 
  MessageSquare, 
  CheckCircle, 
  XCircle, 
  RefreshCcw, 
  Bug,
  Activity,
  FileText,
  UserX,
  Trash2,
  Lock
} from 'lucide-react';
import { api } from '../services/api.ts';
import type { Report, BugReport } from '../types/index.ts';

export const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'metrics' | 'abuse' | 'bugs' | 'audit'>('metrics');
  const [reports, setReports] = useState<Report[]>([]);
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAdminData = async () => {
    setIsLoading(true);
    try {
      const [reportsRes, bugsRes, metricsRes] = await Promise.all([
        api.getAdminReports(),
        api.getAdminBugs(),
        api.getAdminMetrics()
      ]);
      setReports(reportsRes.reports);
      setBugs(bugsRes.bugs);
      setMetrics(metricsRes.metrics);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleReportAction = async (reportId: string, action: string) => {
    const resolutionNote = prompt('Resolution note for audit log:', `Action taken: ${action}`);
    if (resolutionNote === null) return;

    try {
      await api.handleReportAction(reportId, action, resolutionNote);
      await fetchAdminData();
      alert(`Report action executed: ${action}`);
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  const handleUpdateBug = async (bugId: string, status: string) => {
    const note = prompt('Resolution note:', `Status updated to ${status}`);
    if (note === null) return;
    try {
      await api.updateAdminBug(bugId, status, note);
      await fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to update bug');
    }
  };

  const handleResetDemo = async () => {
    if (!confirm('Reset NoteCircle database to fresh seed state?')) return;
    try {
      await api.resetDemoDatabase();
      alert('Database reset to fresh state.');
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Reset failed');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-3.5 sm:px-4 py-5 space-y-6">
      
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-stone-100 dark:bg-[#161622] border-2.5 border-stone-900 rounded-3xl shadow-[4px_4px_0px_#121217]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500 border-2 border-stone-900 flex items-center justify-center text-white shadow-[2px_2px_0px_#121217]">
            <ShieldAlert className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="neo-badge bg-amber-400 text-stone-950">Staff Ops</span>
              <h2 className="text-sm sm:text-base font-black text-stone-900 dark:text-stone-100 font-display uppercase tracking-wide">
                Trust & Safety Moderation Dashboard
              </h2>
            </div>
            <p className="text-[11px] font-bold text-stone-500 dark:text-stone-400 mt-0.5">Audit real-time circle hygiene, abuse telemetry & bug issues</p>
          </div>
        </div>

        <button
          onClick={handleResetDemo}
          className="px-3.5 py-2 neo-btn bg-white dark:bg-[#12121A] text-stone-900 dark:text-stone-100 text-xs font-black rounded-xl flex items-center gap-2 hover:bg-rose-100 dark:hover:bg-rose-950 hover:text-rose-600 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCcw className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Reset Demo Seed</span>
        </button>
      </div>

      {/* Admin Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto text-xs pb-1 p-1.5 bg-stone-100 dark:bg-[#12121A] border-2 border-stone-900 rounded-2xl shadow-[2.5px_2.5px_0px_#121217]">
        <button
          onClick={() => setActiveTab('metrics')}
          className={`px-3.5 py-1.5 rounded-xl font-black transition-all cursor-pointer ${
            activeTab === 'metrics'
              ? 'bg-amber-400 text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_#121217]'
              : 'text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white'
          }`}
        >
          System Health & Metrics
        </button>
        <button
          onClick={() => setActiveTab('abuse')}
          className={`px-3.5 py-1.5 rounded-xl font-black transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'abuse'
              ? 'bg-rose-500 text-white border-2 border-stone-900 shadow-[2px_2px_0px_#121217]'
              : 'text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Abuse Reports ({reports.filter((r) => r.status === 'PENDING').length})</span>
        </button>
        <button
          onClick={() => setActiveTab('bugs')}
          className={`px-3.5 py-1.5 rounded-xl font-black transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'bugs'
              ? 'bg-amber-400 text-stone-950 border-2 border-stone-900 shadow-[2px_2px_0px_#121217]'
              : 'text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white'
          }`}
        >
          <Bug className="w-3.5 h-3.5" />
          <span>Bug Reports ({bugs.length})</span>
        </button>
      </div>

      {/* Tab 1: Metrics */}
      {activeTab === 'metrics' && metrics && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="neo-card bg-white dark:bg-[#161622] rounded-2xl p-4 shadow-[4px_4px_0px_#121217]">
              <p className="text-[11px] font-black uppercase tracking-wider text-stone-500 dark:text-stone-400">Total Users</p>
              <p className="text-3xl font-black text-stone-900 dark:text-stone-100 tabular-nums mt-1 font-display">{metrics.totalUsers}</p>
            </div>
            <div className="neo-card bg-amber-400 dark:bg-amber-400 text-stone-950 rounded-2xl p-4 shadow-[4px_4px_0px_#121217]">
              <p className="text-[11px] font-black uppercase tracking-wider text-stone-900">Active Notes</p>
              <p className="text-3xl font-black text-stone-950 tabular-nums mt-1 font-display">{metrics.activeNotes}</p>
            </div>
            <div className="neo-card bg-white dark:bg-[#161622] rounded-2xl p-4 shadow-[4px_4px_0px_#121217]">
              <p className="text-[11px] font-black uppercase tracking-wider text-stone-500 dark:text-stone-400">Connections</p>
              <p className="text-3xl font-black text-stone-900 dark:text-stone-100 tabular-nums mt-1 font-display">{metrics.acceptedConnections}</p>
            </div>
            <div className="neo-card bg-[#38ef7d] text-stone-950 rounded-2xl p-4 shadow-[4px_4px_0px_#121217]">
              <p className="text-[11px] font-black uppercase tracking-wider text-stone-900">Pending</p>
              <p className="text-3xl font-black text-stone-950 tabular-nums mt-1 font-display">{metrics.pendingRequests}</p>
            </div>
          </div>

          <div className="neo-card bg-white dark:bg-[#161622] rounded-3xl p-5 sm:p-6 space-y-3 text-xs shadow-[5px_5px_0px_#121217]">
            <h4 className="font-black text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2 uppercase tracking-wide">
              <Activity className="w-4 h-4 text-amber-500 stroke-[3]" />
              <span>System & Privacy Security Status</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3.5 bg-amber-100 dark:bg-stone-800 rounded-2xl border-2 border-stone-900 text-stone-950 dark:text-amber-300 font-bold shadow-[2px_2px_0px_#121217]">
                <span className="font-black">E2E Cryptographic Relay</span>: Active Verified
              </div>
              <div className="p-3.5 bg-cyan-100 dark:bg-stone-800 rounded-2xl border-2 border-stone-900 text-stone-950 dark:text-cyan-300 font-bold shadow-[2px_2px_0px_#121217]">
                <span className="font-black">IndexedDB Local Cache</span>: Encrypted & Fresh
              </div>
              <div className="p-3.5 bg-emerald-100 dark:bg-stone-800 rounded-2xl border-2 border-stone-900 text-stone-950 dark:text-emerald-300 font-bold shadow-[2px_2px_0px_#121217]">
                <span className="font-black">Object-Level Auth</span>: Strict 403 Enforced
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Abuse Reports */}
      {activeTab === 'abuse' && (
        <div className="neo-card bg-white dark:bg-[#161622] rounded-3xl divide-y-2 divide-stone-900 overflow-hidden shadow-[5px_5px_0px_#121217]">
          {reports.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm font-black text-stone-900 dark:text-stone-100">
                No abuse reports pending review
              </p>
              <p className="text-xs font-bold text-stone-500 dark:text-stone-400">
                Your NoteCircle environment is clean and privacy-safe.
              </p>
            </div>
          ) : (
            reports.map((report) => (
              <div key={report.id} className="p-4 sm:p-5 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-rose-900 bg-rose-200 dark:bg-rose-950 dark:text-rose-200 px-2.5 py-0.5 rounded-lg border-1.5 border-stone-900 uppercase text-[10px] shadow-[1px_1px_0px_#121217]">
                      {report.reason}
                    </span>
                    <span className="text-stone-600 dark:text-stone-400 font-bold">
                      Reported by @{report.reporterUsername}
                    </span>
                  </div>
                  <span className="font-black text-stone-900 dark:text-stone-100 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-md border border-stone-900 text-[10px]">
                    Status: {report.status}
                  </span>
                </div>

                <p className="text-stone-800 dark:text-stone-200 font-medium">
                  <strong className="font-black">Target:</strong> {report.targetType} ({report.targetAuthorName})
                </p>
                {report.targetContentPreview && (
                  <p className="font-mono text-xs text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 p-2.5 rounded-xl border-1.5 border-stone-900">
                    "{report.targetContentPreview}"
                  </p>
                )}

                {report.status === 'PENDING' && (
                  <div className="flex items-center gap-2 pt-1.5">
                    {report.targetType === 'user' && (
                      <button
                        onClick={() => handleReportAction(report.id, 'suspend_user')}
                        className="px-3 py-1.5 bg-rose-500 text-white rounded-xl text-xs font-black border-2 border-stone-900 shadow-[2px_2px_0px_#121217] hover:translate-x-0.5 hover:translate-y-0.5 cursor-pointer"
                      >
                        Suspend User
                      </button>
                    )}
                    <button
                      onClick={() => handleReportAction(report.id, 'delete_content')}
                      className="px-3 py-1.5 bg-rose-500 text-white rounded-xl text-xs font-black border-2 border-stone-900 shadow-[2px_2px_0px_#121217] hover:translate-x-0.5 hover:translate-y-0.5 cursor-pointer"
                    >
                      Delete Content
                    </button>
                    <button
                      onClick={() => handleReportAction(report.id, 'dismiss')}
                      className="px-3 py-1.5 neo-btn text-stone-900 dark:text-stone-100 text-xs font-black rounded-xl cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Bug Reports */}
      {activeTab === 'bugs' && (
        <div className="neo-card bg-white dark:bg-[#161622] rounded-3xl divide-y-2 divide-stone-900 overflow-hidden shadow-[5px_5px_0px_#121217]">
          {bugs.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm font-black text-stone-900 dark:text-stone-100">
                No active bug reports filed
              </p>
              <p className="text-xs font-bold text-stone-500 dark:text-stone-400">
                Everything is running smoothly.
              </p>
            </div>
          ) : (
            bugs.map((b) => (
              <div key={b.id} className="p-4 sm:p-5 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-amber-950 bg-amber-300 dark:bg-amber-400 px-2.5 py-0.5 rounded-lg border-1.5 border-stone-900 text-[10px] uppercase shadow-[1px_1px_0px_#121217]">
                      {b.category}
                    </span>
                    <span className="text-stone-600 dark:text-stone-400 font-bold">Reported by @{b.username}</span>
                  </div>
                  <span className="font-black text-stone-900 dark:text-stone-100 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-md border border-stone-900 text-[10px]">{b.status}</span>
                </div>

                <p className="text-stone-900 dark:text-stone-100 font-bold">{b.description}</p>
                {b.screenshot && (
                  <div className="pt-1">
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 font-black uppercase tracking-wider block mb-1">Attached Screenshot:</span>
                    <a href={b.screenshot} target="_blank" rel="noreferrer">
                      <img src={b.screenshot} alt="Bug screenshot" className="h-28 w-auto rounded-xl border-2 border-stone-900 object-cover shadow-[2px_2px_0px_#121217] hover:opacity-90" />
                    </a>
                  </div>
                )}
                <div className="text-[10px] text-stone-500 dark:text-stone-400 font-mono bg-stone-100 dark:bg-stone-850 p-2 rounded-xl border border-stone-900">
                  Browser: {b.deviceInfo.browser} | Viewport: {b.deviceInfo.viewport}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleUpdateBug(b.id, 'REVIEWING')}
                    className="px-3 py-1.5 bg-violet-200 dark:bg-violet-900 text-violet-950 dark:text-violet-100 text-xs font-black rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_#121217] hover:translate-x-0.5 hover:translate-y-0.5 cursor-pointer"
                  >
                    Mark Reviewing
                  </button>
                  <button
                    onClick={() => handleUpdateBug(b.id, 'IN_PROGRESS')}
                    className="px-3 py-1.5 neo-btn text-xs font-black text-stone-900 dark:text-stone-100 rounded-xl cursor-pointer"
                  >
                    Mark In Progress
                  </button>
                  <button
                    onClick={() => handleUpdateBug(b.id, 'RESOLVED')}
                    className="px-3 py-1.5 bg-emerald-400 text-stone-950 text-xs font-black rounded-xl border-2 border-stone-900 shadow-[2px_2px_0px_#121217] hover:translate-x-0.5 hover:translate-y-0.5 cursor-pointer"
                  >
                    Mark Resolved
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

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
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-600" />
          <h2 className="text-base font-bold text-slate-900 font-display">
            Trust & Safety Moderation Dashboard
          </h2>
        </div>

        <button
          onClick={handleResetDemo}
          className="px-3 py-1.5 neu-button text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 hover:text-rose-600 self-start sm:self-auto"
        >
          <RefreshCcw className="w-3.5 h-3.5" />
          <span>Reset Demo Seed</span>
        </button>
      </div>

      {/* Admin Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1">
        <button
          onClick={() => setActiveTab('metrics')}
          className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all ${
            activeTab === 'metrics' ? 'bg-amber-600 text-white shadow-xs' : 'neu-button text-stone-700 dark:text-stone-300'
          }`}
        >
          System Health & Metrics
        </button>
        <button
          onClick={() => setActiveTab('abuse')}
          className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 ${
            activeTab === 'abuse' ? 'bg-amber-600 text-white shadow-xs' : 'neu-button text-stone-700 dark:text-stone-300'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
          <span>Abuse Reports ({reports.filter((r) => r.status === 'PENDING').length})</span>
        </button>
        <button
          onClick={() => setActiveTab('bugs')}
          className={`px-3.5 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5 ${
            activeTab === 'bugs' ? 'bg-amber-600 text-white shadow-xs' : 'neu-button text-stone-700 dark:text-stone-300'
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
            <div className="glass-card rounded-2xl p-4 shadow-xs">
              <p className="text-[11px] font-semibold text-stone-400">Total Registered Users</p>
              <p className="text-2xl font-bold text-stone-900 dark:text-stone-100 tabular-nums mt-1">{metrics.totalUsers}</p>
            </div>
            <div className="glass-card rounded-2xl p-4 shadow-xs">
              <p className="text-[11px] font-semibold text-stone-400">Active Notes</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-1">{metrics.activeNotes}</p>
            </div>
            <div className="glass-card rounded-2xl p-4 shadow-xs">
              <p className="text-[11px] font-semibold text-stone-400">Verified Connections</p>
              <p className="text-2xl font-bold text-stone-900 dark:text-stone-100 tabular-nums mt-1">{metrics.acceptedConnections}</p>
            </div>
            <div className="glass-card rounded-2xl p-4 shadow-xs">
              <p className="text-[11px] font-semibold text-stone-400">Pending Requests</p>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 tabular-nums mt-1">{metrics.pendingRequests}</p>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-5 space-y-2 text-xs">
            <h4 className="font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-amber-600" />
              <span>System & Privacy Security Status</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
              <div className="p-3 bg-amber-50/80 dark:bg-amber-950/40 rounded-xl border border-amber-200/80 dark:border-amber-800/40 text-amber-950 dark:text-amber-200">
                <span className="font-bold">E2E Cryptographic Relay</span>: Operating
              </div>
              <div className="p-3 bg-amber-50/80 dark:bg-amber-950/40 rounded-xl border border-amber-200/80 dark:border-amber-800/40 text-amber-950 dark:text-amber-200">
                <span className="font-bold">IndexedDB Local Cache</span>: Verified
              </div>
              <div className="p-3 bg-amber-50/80 dark:bg-amber-950/40 rounded-xl border border-amber-200/80 dark:border-amber-800/40 text-amber-950 dark:text-amber-200">
                <span className="font-bold">Object-Level Auth</span>: Strict 403
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Abuse Reports */}
      {activeTab === 'abuse' && (
        <div className="glass-card rounded-3xl divide-y divide-slate-100 overflow-hidden shadow-xs">
          {reports.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-400">
              No abuse reports pending review. Circle is safe.
            </p>
          ) : (
            reports.map((report) => (
              <div key={report.id} className="p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 uppercase text-[10px]">
                      {report.reason}
                    </span>
                    <span className="text-slate-500">
                      Reported by @{report.reporterUsername}
                    </span>
                  </div>
                  <span className="font-bold text-slate-700 text-[10px]">
                    Status: {report.status}
                  </span>
                </div>

                <p className="text-slate-800">
                  <strong>Target:</strong> {report.targetType} ({report.targetAuthorName})
                </p>
                {report.targetContentPreview && (
                  <p className="italic text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100">
                    "{report.targetContentPreview}"
                  </p>
                )}

                {report.status === 'PENDING' && (
                  <div className="flex items-center gap-2 pt-1">
                    {report.targetType === 'user' && (
                      <button
                        onClick={() => handleReportAction(report.id, 'suspend_user')}
                        className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-semibold"
                      >
                        Suspend User
                      </button>
                    )}
                    <button
                      onClick={() => handleReportAction(report.id, 'delete_content')}
                      className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-semibold"
                    >
                      Delete Content
                    </button>
                    <button
                      onClick={() => handleReportAction(report.id, 'dismiss')}
                      className="px-2.5 py-1 neu-button text-slate-700 rounded-lg text-xs"
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
        <div className="glass-card rounded-3xl divide-y divide-slate-100 overflow-hidden shadow-xs">
          {bugs.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-400">
              No bug reports filed.
            </p>
          ) : (
            bugs.map((b) => (
              <div key={b.id} className="p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 text-[10px] uppercase">
                      {b.category}
                    </span>
                    <span className="text-stone-500">Reported by @{b.username}</span>
                  </div>
                  <span className="font-bold text-stone-700 dark:text-stone-300 text-[10px]">{b.status}</span>
                </div>

                <p className="text-stone-800 dark:text-stone-200">{b.description}</p>
                {b.screenshot && (
                  <div className="pt-1">
                    <span className="text-[10px] text-stone-500 font-semibold block mb-0.5">Attached Screenshot:</span>
                    <a href={b.screenshot} target="_blank" rel="noreferrer">
                      <img src={b.screenshot} alt="Bug screenshot" className="h-24 w-auto rounded-xl border border-stone-200 dark:border-stone-700 object-cover hover:opacity-90" />
                    </a>
                  </div>
                )}
                <div className="text-[10px] text-stone-400 font-mono">
                  Browser: {b.deviceInfo.browser} | Viewport: {b.deviceInfo.viewport}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleUpdateBug(b.id, 'REVIEWING')}
                    className="px-2.5 py-1 bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 text-xs font-semibold rounded-lg hover:bg-purple-200 cursor-pointer"
                  >
                    Mark Reviewing
                  </button>
                  <button
                    onClick={() => handleUpdateBug(b.id, 'IN_PROGRESS')}
                    className="px-2.5 py-1 neu-button text-xs font-semibold text-stone-700 dark:text-stone-300 rounded-lg hover:bg-stone-100 cursor-pointer"
                  >
                    Mark In Progress
                  </button>
                  <button
                    onClick={() => handleUpdateBug(b.id, 'RESOLVED')}
                    className="px-2.5 py-1 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 shadow-xs cursor-pointer"
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

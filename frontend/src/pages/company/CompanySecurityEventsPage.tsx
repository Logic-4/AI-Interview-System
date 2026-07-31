import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { ShieldAlert, ShieldCheck, Eye, ImageOff } from 'lucide-react';
import { setPageTitle } from '@/store/themeConfigSlice';
import companyService from '@/services/companyService';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import type { SecurityEvent } from '@/types/companyPortal';

const OUTCOME_LABEL: Record<string, string> = {
  passed: 'Passed',
  failed: 'Face mismatch',
  no_face: 'No face detected',
  multiple_faces: 'Multiple faces',
  no_reference: 'No profile photo',
  provider_error: 'Provider error',
  attempts_exhausted: 'Attempts exhausted',
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'badge-outline-danger',
  warning: 'badge-outline-warning',
  info: 'badge-outline-info',
};

const dateTime = (value?: string | null) =>
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'N/A';

const CompanySecurityEventsPage = () => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [filter, setFilter] = useState<'all' | 'unreviewed'>('unreviewed');
  const [selected, setSelected] = useState<SecurityEvent | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { events: list } = await companyService.getSecurityEvents({
        limit: 50,
        ...(filter === 'unreviewed' ? { reviewed: false } : {}),
      });
      setEvents(list);
    } catch (err) {
      console.error('Failed to load security events:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    dispatch(setPageTitle('Security Events | RecruitAI'));
  }, [dispatch]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleReview = async (id: string) => {
    setReviewingId(id);
    try {
      const updated = await companyService.reviewSecurityEvent(id);
      setEvents((prev) => (filter === 'unreviewed' ? prev.filter((e) => e._id !== id) : prev.map((e) => (e._id === id ? updated : e))));
      setSelected((prev) => (prev && prev._id === id ? updated : prev));
    } catch (err) {
      console.error('Failed to review security event:', err);
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-black dark:text-white">
            <ShieldAlert className="h-6 w-6 text-danger" /> Security Events
          </h1>
          <p className="mt-1 text-sm text-white-dark">
            Identity-verification failures and impersonation attempts flagged during the pre-interview face check.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className={`btn ${filter === 'unreviewed' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setFilter('unreviewed')}
          >
            Needs Review
          </button>
          <button className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setFilter('all')}>
            All Events
          </button>
        </div>
      </div>

      <div className="panel">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Interview</th>
                  <th>Outcome</th>
                  <th>Similarity</th>
                  <th>Attempt</th>
                  <th>Flagged</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event._id}>
                    <td className="font-semibold text-black dark:text-white">{event.candidateName || 'Unknown candidate'}</td>
                    <td>
                      {typeof event.interview === 'object' ? event.interview?.title || event.interview?.jobRole : '—'}
                    </td>
                    <td>
                      <span className={`badge ${SEVERITY_BADGE[event.severity] || 'badge-outline-secondary'}`}>
                        {OUTCOME_LABEL[event.outcome] || event.outcome}
                      </span>
                    </td>
                    <td className="text-xs">{event.similarity !== null ? `${event.similarity.toFixed(1)}%` : '—'}</td>
                    <td className="text-xs">{event.attempt}</td>
                    <td className="text-xs">{dateTime(event.createdAt)}</td>
                    <td>
                      {event.reviewed ? (
                        <span className="badge badge-outline-success flex w-fit items-center gap-1">
                          <ShieldCheck className="h-3 w-3" /> Reviewed
                        </span>
                      ) : (
                        <span className="badge badge-outline-danger">Open</span>
                      )}
                    </td>
                    <td className="text-right">
                      <button className="btn btn-sm btn-outline-primary" onClick={() => setSelected(event)}>
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {events.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-white-dark">
                      {filter === 'unreviewed' ? 'No unreviewed security events. Nothing to act on.' : 'No security events logged yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <Modal open onOpenChange={(open) => !open && setSelected(null)} title="Security Event Detail">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase text-white-dark">Candidate</p>
                <p className="font-semibold text-black dark:text-white">{selected.candidateName || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-white-dark">Outcome</p>
                <p className="font-semibold text-black dark:text-white">{OUTCOME_LABEL[selected.outcome] || selected.outcome}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-white-dark">Similarity</p>
                <p className="font-semibold text-black dark:text-white">
                  {selected.similarity !== null ? `${selected.similarity.toFixed(1)}% (threshold ${selected.threshold ?? '—'}%)` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-white-dark">Attempt</p>
                <p className="font-semibold text-black dark:text-white">{selected.attempt}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-semibold uppercase text-white-dark">Reason</p>
                <p className="text-black dark:text-white">{selected.reason || '—'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs font-semibold uppercase text-white-dark">Flagged at</p>
                <p className="text-black dark:text-white">{dateTime(selected.createdAt)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-white-dark">Profile Photo</p>
                {selected.referenceImageUrl ? (
                  <img src={selected.referenceImageUrl} alt="Reference" className="h-40 w-full rounded-lg object-cover" />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center rounded-lg border border-dashed border-white-light text-white-dark">
                    <ImageOff className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-white-dark">Live Frame (Evidence)</p>
                {selected.liveFrameUrl ? (
                  <img src={selected.liveFrameUrl} alt="Live capture" className="h-40 w-full rounded-lg object-cover" />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center rounded-lg border border-dashed border-white-light text-white-dark">
                    <ImageOff className="h-6 w-6" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button className="btn btn-outline-secondary" onClick={() => setSelected(null)}>
                Close
              </button>
              {!selected.reviewed && (
                <button
                  className="btn btn-primary"
                  disabled={reviewingId === selected._id}
                  onClick={() => handleReview(selected._id)}
                >
                  {reviewingId === selected._id ? 'Marking…' : 'Mark as Reviewed'}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CompanySecurityEventsPage;

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, FileText, CheckCircle2, XCircle, SkipForward } from 'lucide-react'
import toast from 'react-hot-toast'
import { bulkImportListings, getBulkImportJob, listBulkImportJobs } from '../../api/admin'
import type { BulkImportJob } from '../../api/admin'
import { TONE } from './shared'

const POLL_MS = 3000

export function BulkImportListings() {
  const { t } = useTranslation('admin')
  const [file, setFile] = useState<File | null>(null)
  const [job, setJob] = useState<BulkImportJob | null>(null)
  const [uploading, setUploading] = useState(false)
  const [history, setHistory] = useState<BulkImportJob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    listBulkImportJobs().then(setHistory).catch(() => {})
  }, [])

  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed') {
      if (pollRef.current) window.clearInterval(pollRef.current)
      return
    }
    pollRef.current = window.setInterval(async () => {
      try {
        const updated = await getBulkImportJob(job.id)
        setJob(updated)
        if (updated.status === 'completed' || updated.status === 'failed') {
          setHistory(prev => [updated, ...prev.filter(h => h.id !== updated.id)])
        }
      } catch {
        // transient network error — keep polling
      }
    }, POLL_MS)
    return () => { if (pollRef.current) window.clearInterval(pollRef.current) }
  }, [job?.id, job?.status])

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    try {
      const created = await bulkImportListings(file)
      setJob(created)
      setHistory(prev => [created, ...prev])
      toast.success(t('bulk_import_page.toast_started'))
    } catch {
      toast.error(t('bulk_import_page.toast_error'))
    } finally {
      setUploading(false)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const progressPct = job && job.total_rows > 0 ? Math.round((job.processed_rows / job.total_rows) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="bg-paper border border-line rounded-2xl px-6 py-5">
        <h2 className="text-[15px] font-bold text-ink mb-1">{t('bulk_import_page.upload_title')}</h2>
        <p className="text-[13px] text-ink2 mb-4">{t('bulk_import_page.upload_desc')}</p>
        <div className="mb-4 rounded-xl border border-line-soft bg-line-soft/20 p-3 text-[12px] leading-relaxed text-ink2">
          <a href="/templates/listing-import.csv" download className="font-semibold underline">{t('bulk_import_page.download_template')}</a>
          <p className="mt-2 mb-0">{t('bulk_import_page.template_help')}</p>
          <p className="mt-2 mb-0">{t('bulk_import_page.location_help')}</p>
          <p className="mt-2 mb-0">{t('bulk_import_page.location_limits')}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <label className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-line cursor-pointer text-[13px] text-ink2">
            <Upload size={15} />
            {file ? file.name : t('bulk_import_page.choose_file')}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="px-4 py-2.5 rounded-lg text-[13px] font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: TONE }}
          >
            {uploading ? t('bulk_import_page.uploading') : t('bulk_import_page.start_import')}
          </button>
        </div>
      </div>

      {job && (
        <div className="bg-paper border border-line rounded-2xl px-6 py-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-bold text-ink">{t('bulk_import_page.job_title')}</h3>
            <span
              className="text-[12px] font-semibold uppercase tracking-wide"
              style={{ color: job.status === 'failed' ? '#e10f1f' : job.status === 'completed' ? '#1f7a3d' : TONE }}
            >
              {t(`bulk_import_page.status_${job.status}`)}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-line-soft overflow-hidden mb-2">
            <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, background: TONE }} />
          </div>
          <div className="text-[12px] text-ink2 mb-4">
            {t('bulk_import_page.progress', { processed: job.processed_rows, total: job.total_rows })}
          </div>
          <div className="flex gap-4 text-[13px] mb-4">
            <span className="flex items-center gap-1.5 text-[#1f7a3d]"><CheckCircle2 size={14} /> {job.succeeded_count} {t('bulk_import_page.succeeded')}</span>
            <span className="flex items-center gap-1.5 text-[#a16207]"><SkipForward size={14} /> {job.skipped_count} {t('bulk_import_page.skipped')}</span>
            <span className="flex items-center gap-1.5 text-[#e10f1f]"><XCircle size={14} /> {job.failed_count} {t('bulk_import_page.failed')}</span>
          </div>

          {job.results.length > 0 && (
            <div className="overflow-x-auto border border-line-soft rounded-lg">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="bg-line-soft/40 text-left">
                    <th className="px-3 py-2 font-semibold text-ink2">{t('bulk_import_page.col_row')}</th>
                    <th className="px-3 py-2 font-semibold text-ink2">{t('bulk_import_page.col_source_ref')}</th>
                    <th className="px-3 py-2 font-semibold text-ink2">{t('bulk_import_page.col_status')}</th>
                    <th className="px-3 py-2 font-semibold text-ink2">{t('bulk_import_page.col_message')}</th>
                  </tr>
                </thead>
                <tbody>
                  {job.results.map(r => (
                    <tr key={r.row} className="border-t border-line-soft">
                      <td className="px-3 py-2 text-ink2">{r.row}</td>
                      <td className="px-3 py-2 text-ink2">{r.source_ref ?? '—'}</td>
                      <td className="px-3 py-2">
                        <span className={
                          r.status === 'succeeded' ? 'text-[#1f7a3d] font-semibold' :
                          r.status === 'skipped'   ? 'text-[#a16207] font-semibold' : 'text-[#e10f1f] font-semibold'
                        }>
                          {t(`bulk_import_page.status_${r.status}`)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-ink2">{r.message ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-paper border border-line rounded-2xl px-6 py-5">
          <h3 className="text-[14px] font-bold text-ink mb-3">{t('bulk_import_page.history_title')}</h3>
          <div className="space-y-2">
            {history.map(h => (
              <button
                key={h.id}
                onClick={() => setJob(h)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-line-soft text-left hover:bg-line-soft/30 transition-colors"
              >
                <span className="flex items-center gap-2 text-[12.5px] text-ink">
                  <FileText size={14} className="text-ink2" />
                  {new Date(h.created_at).toLocaleString()}
                </span>
                <span className="text-[12px] text-ink2">
                  {t('bulk_import_page.progress', { processed: h.processed_rows, total: h.total_rows })} · {t(`bulk_import_page.status_${h.status}`)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

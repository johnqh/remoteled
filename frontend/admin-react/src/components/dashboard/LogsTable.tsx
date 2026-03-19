import { useState, useMemo } from 'react'
import { formatDateTime } from '../../utils/format'
import type { SystemLog } from '../../types'

interface LogsTableProps {
  logs: SystemLog[]
  onRefresh: () => void
  loading?: boolean
  error?: string | null
}

const ITEMS_PER_PAGE = 20

export const LogsTable = ({ logs, onRefresh, loading = false, error = null }: LogsTableProps) => {
  const [currentPage, setCurrentPage] = useState(1)
  
  const safeLogs = logs || []

  const totalPages = Math.ceil(safeLogs.length / ITEMS_PER_PAGE)
  
  const paginatedLogs = useMemo(() => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE
    const endIdx = startIdx + ITEMS_PER_PAGE
    return safeLogs.slice(startIdx, endIdx)
  }, [safeLogs, currentPage])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const renderPaginationButtons = () => {
    const buttons = []
    const maxVisible = 5
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    const endPage = Math.min(totalPages, startPage + maxVisible - 1)
    
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1)
    }

    if (startPage > 1) {
      buttons.push(
        <button key={1} onClick={() => handlePageChange(1)} className="btn btn-sm">
          1
        </button>
      )
      if (startPage > 2) {
        buttons.push(
          <span key="ellipsis-start" style={{ padding: '0.25rem 0.5rem', color: '#718096' }}>
            ...
          </span>
        )
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`btn btn-sm ${i === currentPage ? 'btn-primary' : ''}`}
          disabled={i === currentPage}
        >
          {i}
        </button>
      )
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        buttons.push(
          <span key="ellipsis-end" style={{ padding: '0.25rem 0.5rem', color: '#718096' }}>
            ...
          </span>
        )
      }
      buttons.push(
        <button key={totalPages} onClick={() => handlePageChange(totalPages)} className="btn btn-sm">
          {totalPages}
        </button>
      )
    }

    return <>{buttons}</>
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">System Logs</div>
          <p style={{ fontSize: '0.85rem', color: '#718096' }}>Recent device communication events</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={onRefresh} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error ? (
        <div style={{ padding: '1rem', color: '#c53030', fontSize: '0.9rem' }}>
          {error}
        </div>
      ) : null}

      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Device</th>
            <th>Direction</th>
            <th>Status</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
                No log entries yet.
              </td>
            </tr>
          ) : (
            paginatedLogs.map(log => (
              <tr key={log.id}>
                <td>{formatDateTime(log.created_at)}</td>
                <td>{log.device_label}</td>
                <td>
                  <span className={`badge ${log.direction === 'OUT' ? 'RUNNING' : 'INFO'}`}>
                    {log.direction}
                  </span>
                </td>
                <td>
                  <span className={`badge ${log.ok ? 'ACTIVE' : 'OFFLINE'}`}>
                    {log.ok ? 'OK' : 'Error'}
                  </span>
                </td>
                <td>{log.details}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {logs.length > ITEMS_PER_PAGE && (
        <div style={{ 
          padding: '1rem', 
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#718096' }}>
            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, logs.length)} of {logs.length} logs
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="btn btn-sm"
              style={{ padding: '0.25rem 0.5rem' }}
            >
              ← Previous
            </button>
            
            {renderPaginationButtons()}
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="btn btn-sm"
              style={{ padding: '0.25rem 0.5rem' }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}



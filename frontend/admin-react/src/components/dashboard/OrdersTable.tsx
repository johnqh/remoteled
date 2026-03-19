import { useState, useMemo, useEffect } from 'react'
import { Order } from '../../types'
import { formatCurrency, formatDateTime } from '../../utils/format'
import { statsApi } from '../../api'

interface OrdersTableProps {
  orders: Order[]
  onExportCSV: () => void
  onRefresh?: () => void
}

const ITEMS_PER_PAGE = 10
const AUTO_REFRESH_INTERVAL = 5000 // 5 seconds

export const OrdersTable = ({ orders: initialOrders, onExportCSV, onRefresh }: OrdersTableProps) => {
  const [currentPage, setCurrentPage] = useState(1)
  const [orders, setOrders] = useState<Order[]>(initialOrders || [])
  const [loading, setLoading] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  // Fetch latest orders
  const fetchOrders = async () => {
    setLoading(true)
    try {
      const data = await statsApi.getRecentOrders(50)
      setOrders(data)
      setLastRefresh(new Date())
      onRefresh?.()
    } catch (err) {
      console.error('Failed to fetch orders:', err)
    } finally {
      setLoading(false)
    }
  }

  // Auto-refresh every 5 seconds
  useEffect(() => {
    fetchOrders() // Initial fetch
    const interval = setInterval(fetchOrders, AUTO_REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  // Update from props if they change
  useEffect(() => {
    if (initialOrders?.length > 0) {
      setOrders(initialOrders)
    }
  }, [initialOrders])
  
  const safeOrders = orders || []

  const totalPages = Math.ceil(safeOrders.length / ITEMS_PER_PAGE)
  
  const paginatedOrders = useMemo(() => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE
    const endIdx = startIdx + ITEMS_PER_PAGE
    return safeOrders.slice(startIdx, endIdx)
  }, [safeOrders, currentPage])

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
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div className="card-title">Recent Orders</div>
          <div style={{ fontSize: '0.75rem', color: '#718096' }}>
            Auto-refresh every 5s • Last: {lastRefresh.toLocaleTimeString()}
            {loading && ' • Refreshing...'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="btn btn-sm" 
            onClick={fetchOrders}
            disabled={loading}
            style={{ padding: '0.25rem 0.75rem' }}
          >
            ↻ Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={onExportCSV}>
            Export CSV
          </button>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Order ID</th>
            <th>Device</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {orders.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
                No orders found.
              </td>
            </tr>
          ) : (
            paginatedOrders.map(order => (
              <tr key={order.id}>
                <td>{order.id.substring(0, 8)}...</td>
                <td>{order.device_label}</td>
                <td>{order.service_type}</td>
                <td>{formatCurrency(order.amount_cents)}</td>
                <td>
                  <span className={`badge ${order.status}`}>{order.status}</span>
                </td>
                <td>{formatDateTime(order.created_at)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {orders.length > ITEMS_PER_PAGE && (
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
            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, orders.length)} of {orders.length} orders
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


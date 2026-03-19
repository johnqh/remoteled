import { useState, useMemo } from 'react'
import { Service } from '../../types'
import { formatCurrency } from '../../utils/format'
import { servicesApi } from '../../api'

interface ServicesTableProps {
  services: Service[]
  onEdit: (service: Service) => void
  onDelete: (id: string, type: string) => void
  onAddNew: () => void
  onStatusChange?: () => void
}

const ITEMS_PER_PAGE = 10

export const ServicesTable = ({ services, onEdit, onDelete, onAddNew, onStatusChange }: ServicesTableProps) => {
  const [currentPage, setCurrentPage] = useState(1)
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)
  
  const safeServices = services || []

  const handleToggleActive = async (service: Service) => {
    setUpdatingStatus(service.id)
    try {
      await servicesApi.update(service.id, { active: !service.active })
      onStatusChange?.()
    } catch (error) {
      console.error('Failed to update service status:', error)
    } finally {
      setUpdatingStatus(null)
    }
  }

  const totalPages = Math.ceil(safeServices.length / ITEMS_PER_PAGE)
  
  const paginatedServices = useMemo(() => {
    const startIdx = (currentPage - 1) * ITEMS_PER_PAGE
    const endIdx = startIdx + ITEMS_PER_PAGE
    return safeServices.slice(startIdx, endIdx)
  }, [safeServices, currentPage])

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
        <div className="card-title">Service Catalog</div>
        <button className="btn btn-primary" onClick={onAddNew}>
          + Add Service
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Price</th>
            <th>Duration</th>
            <th>Assigned Devices</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {services.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
                No services found. Create your first service to get started.
              </td>
            </tr>
          ) : (
            paginatedServices.map(service => (
              <tr key={service.id}>
                <td>{service.type}</td>
                <td>{formatCurrency(service.price_cents)}</td>
                <td>
                  {service.fixed_minutes 
                    ? `${service.fixed_minutes} min` 
                    : (service.minutes_per_25c 
                        ? `${service.minutes_per_25c} min/$0.25` 
                        : '2 sec')}
                </td>
                <td>
                  <span title={service.device_labels?.join(', ') || 'No devices'}>
                    {service.assigned_device_count || 0} device(s)
                  </span>
                </td>
                <td>
                  <button
                    onClick={() => handleToggleActive(service)}
                    disabled={updatingStatus === service.id}
                    style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      border: 'none',
                      cursor: updatingStatus === service.id ? 'wait' : 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      backgroundColor: service.active ? '#10b981' : '#6b7280',
                      color: 'white',
                      transition: 'all 0.2s'
                    }}
                  >
                    {updatingStatus === service.id ? 'Updating...' : (service.active ? 'Active' : 'Inactive')}
                  </button>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className="btn btn-sm" 
                      onClick={() => onEdit(service)}
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    >
                      ✏️ Edit
                    </button>
                    <button 
                      className="btn btn-sm" 
                      onClick={() => onDelete(service.id, service.type)}
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: '#ef4444', color: 'white' }}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {services.length > ITEMS_PER_PAGE && (
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
            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, services.length)} of {services.length} services
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


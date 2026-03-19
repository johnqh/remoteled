import { useState, useEffect } from 'react'
import { useDevices } from '../hooks/useDevices'
import { useServices } from '../hooks/useServices'
import { useStats } from '../hooks/useStats'
import { useLogs } from '../hooks/useLogs'
import { useDeviceModels } from '../hooks/useDeviceModels'
import { useLocations } from '../hooks/useLocations'
import { useServiceTypes } from '../hooks/useServiceTypes'
import {
  Device,
  Service,
  DeviceCreateRequest,
  DeviceUpdateRequest,
  ServiceCreateRequest,
  ServiceUpdateRequest
} from '../types'
import type { DeviceModel, Location, DeviceModelCreate, DeviceModelUpdate, LocationCreate, LocationUpdate, ServiceType, ServiceTypeCreate, ServiceTypeUpdate } from '../types/reference'
import { Header } from '../components/layout/Header'
import { DashboardLayout } from '../components/layout/DashboardLayout'
import { StatsGrid, DeviceGrid, OrdersTable, OrderTrendsChart, ServicesTable, LogsTable, DeviceModelsTable, LocationsTable, ServiceTypesTable, LiveOrdersPanel } from '../components/dashboard'
import { DeviceForm, ServiceForm } from '../components/forms'
import { DeviceModelForm } from '../components/forms/DeviceModelForm'
import { LocationForm } from '../components/forms/LocationForm'
import { ServiceTypeForm } from '../components/forms/ServiceTypeForm'
import { exportToCSV } from '../utils/format'
import { servicesApi } from '../api'

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'devices', label: 'Devices', icon: '💡' },
  { id: 'services', label: 'Services', icon: '⚙️' },
  { id: 'orders', label: 'Orders', icon: '📦' },
  { id: 'logs', label: 'Logs', icon: '📜' }
] as const

type NavItemId = (typeof NAV_ITEMS)[number]['id']

type FeedbackMessage = {
  type: 'success' | 'error'
  message: string
}

export const Dashboard = () => {
  const [activeView, setActiveView] = useState<NavItemId>('overview')
  const [devicesTab, setDevicesTab] = useState<'devices' | 'models' | 'locations'>('devices')
  const [servicesTab, setServicesTab] = useState<'services' | 'types'>('services')
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null)

  const {
    devices,
    loading: devicesLoading,
    createDevice,
    updateDevice,
    deleteDevice,
    error: _devicesError
  } = useDevices(false) // Disable auto-refresh to prevent flashing

  const {
    services,
    loading: servicesLoading,
    createService,
    updateService,
    deleteService,
    fetchServices,
    error: _servicesError
  } = useServices(false) // Disable auto-refresh to prevent flashing

  const deviceModelsHook = useDeviceModels()
  const {
    models = [],
    loading: _modelsLoading = false,
    createModel = async () => ({} as any),
    updateModel = async () => ({} as any),
    deleteModel = async () => {},
    error: _modelsError = null,
    fetchModels = async () => {}
  } = deviceModelsHook || {}

  const locationsHook = useLocations()
  const {
    locations = [],
    loading: _locationsLoading = false,
    createLocation = async () => ({} as any),
    updateLocation = async () => ({} as any),
    deleteLocation = async () => {},
    error: _locationsError = null,
    fetchLocations = async () => {}
  } = locationsHook || {}

  const serviceTypesHook = useServiceTypes()
  const {
    serviceTypes = [],
    loading: _serviceTypesLoading = false,
    error: _serviceTypesError = null,
    createServiceType = async () => ({} as any),
    updateServiceType = async () => ({} as any),
    deleteServiceType = async () => {}
  } = serviceTypesHook || {}

  const {
    stats,
    orders,
    loading: statsLoading,
    error: _statsError
  } = useStats(false) // Disable auto-refresh to prevent flashing

  const {
    logs,
    loading: logsLoading,
    error: logsError,
    refetch: refreshLogs
  } = useLogs(false) // Disable auto-refresh to prevent flashing

  const [showDeviceForm, setShowDeviceForm] = useState(false)
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [showDeviceModelForm, setShowDeviceModelForm] = useState(false)
  const [showLocationForm, setShowLocationForm] = useState(false)
  const [showServiceTypeForm, setShowServiceTypeForm] = useState(false)
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [editingDeviceModel, setEditingDeviceModel] = useState<DeviceModel | null>(null)
  const [editingLocation, setEditingLocation] = useState<Location | null>(null)
  const [editingServiceType, setEditingServiceType] = useState<ServiceType | null>(null)

  const isInitialLoading = devicesLoading || servicesLoading || statsLoading
  const fetchErrors: string[] = []  // Temporarily disabled

  useEffect(() => {
    if (devicesTab === 'models') {
      fetchModels()
    }
    if (devicesTab === 'locations') {
      fetchLocations()
    }
  }, [devicesTab, fetchModels, fetchLocations])

  const showFeedback = (type: FeedbackMessage['type'], message: string) => {
    setFeedback({ type, message })
  }

  const dismissFeedback = () => setFeedback(null)

  const messageFromError = (error: any, fallback: string) => {
    if (error?.message) {
      return error.message
    }
    return fallback
  }

  // Device handlers
  const handleAddDevice = () => {
    setEditingDevice(null)
    setShowDeviceForm(true)
  }

  const handleEditDevice = (device: Device) => {
    setEditingDevice(device)
    setShowDeviceForm(true)
  }

  const handleSubmitDevice = async (device: DeviceCreateRequest | DeviceUpdateRequest, serviceIds: string[] = []) => {
    try {
      let deviceId: string
      
      if (editingDevice) {
        await updateDevice(editingDevice.id, device as DeviceUpdateRequest)
        deviceId = editingDevice.id
        showFeedback('success', 'Device updated successfully.')
      } else {
        const newDevice = await createDevice(device as DeviceCreateRequest)
        deviceId = newDevice.id
        showFeedback('success', `Device "${newDevice.label}" created.`)
      }

      // Handle service assignments
      if (editingDevice) {
        // Get currently assigned services
        const currentServices = await servicesApi.getDeviceServices(deviceId)
        const currentServiceIds = currentServices.map(s => s.id)
        
        // Find services to add and remove
        const toAdd = serviceIds.filter(id => !currentServiceIds.includes(id))
        const toRemove = currentServiceIds.filter(id => !serviceIds.includes(id))
        
        // Update assignments
        await Promise.all([
          ...toAdd.map(serviceId => servicesApi.assignToDevice(deviceId, serviceId)),
          ...toRemove.map(serviceId => servicesApi.unassignFromDevice(deviceId, serviceId))
        ])
      } else {
        // For new devices, just assign selected services
        await Promise.all(
          serviceIds.map(serviceId => servicesApi.assignToDevice(deviceId, serviceId))
        )
      }
      
      setShowDeviceForm(false)
      setEditingDevice(null)
      refreshLogs()
    } catch (error: any) {
      const message = messageFromError(error, 'Unable to save device.')
      showFeedback('error', message)
      throw new Error(message)
    }
  }

  const handleDeleteDevice = async (id: string, label: string) => {
    if (!confirm(`Are you sure you want to delete device "${label}"?\n\nThis will also delete all associated products.`)) {
      return
    }
    try {
      await deleteDevice(id)
      showFeedback('success', `Device "${label}" deleted.`)
      refreshLogs()
    } catch (error: any) {
      showFeedback('error', messageFromError(error, 'Failed to delete device.'))
    }
  }

  // Service handlers
  const handleAddService = () => {
    setEditingService(null)
    setShowServiceForm(true)
  }

  const handleEditService = (service: Service) => {
    setEditingService(service)
    setShowServiceForm(true)
  }

  const handleSubmitService = async (service: ServiceCreateRequest | ServiceUpdateRequest) => {
    try {
      if (editingService) {
        await updateService(editingService.id, service as ServiceUpdateRequest)
        showFeedback('success', 'Service updated successfully.')
      } else {
        const newService = await createService(service as ServiceCreateRequest)
        showFeedback('success', `Service "${newService.type}" created.`)
      }
      setShowServiceForm(false)
      setEditingService(null)
      refreshLogs()
    } catch (error: any) {
      const message = messageFromError(error, 'Unable to save service.')
      showFeedback('error', message)
      throw new Error(message)
    }
  }

  const handleDeleteService = async (id: string, type: string) => {
    if (!confirm(`Are you sure you want to delete this ${type} service?`)) {
      return
    }
    try {
      await deleteService(id)
      showFeedback('success', `Service "${type}" deleted.`)
      refreshLogs()
    } catch (error: any) {
      showFeedback('error', messageFromError(error, 'Failed to delete service.'))
    }
  }

  // Device Model handlers
  const handleAddDeviceModel = () => {
    setEditingDeviceModel(null)
    setShowDeviceModelForm(true)
  }

  const handleEditDeviceModel = (model: DeviceModel) => {
    setEditingDeviceModel(model)
    setShowDeviceModelForm(true)
  }

  const handleSubmitDeviceModel = async (data: DeviceModelCreate | DeviceModelUpdate) => {
    try {
      if (editingDeviceModel) {
        await updateModel(editingDeviceModel.id, data as DeviceModelUpdate)
        showFeedback('success', 'Device model updated successfully.')
      } else {
        await createModel(data as DeviceModelCreate)
        showFeedback('success', 'Device model created successfully.')
      }
      setShowDeviceModelForm(false)
      setEditingDeviceModel(null)
    } catch (error: any) {
      showFeedback('error', messageFromError(error, 'Failed to save device model.'))
      throw error
    }
  }

  const handleDeleteDeviceModel = async (id: string) => {
    try {
      await deleteModel(id)
      showFeedback('success', 'Device model deleted successfully.')
    } catch (error: any) {
      showFeedback('error', messageFromError(error, 'Failed to delete device model.'))
    }
  }

  // Location handlers
  const handleAddLocation = () => {
    setEditingLocation(null)
    setShowLocationForm(true)
  }

  const handleEditLocation = (location: Location) => {
    setEditingLocation(location)
    setShowLocationForm(true)
  }

  const handleSubmitLocation = async (data: LocationCreate | LocationUpdate) => {
    try {
      if (editingLocation) {
        await updateLocation(editingLocation.id, data as LocationUpdate)
        showFeedback('success', 'Location updated successfully.')
      } else {
        await createLocation(data as LocationCreate)
        showFeedback('success', 'Location created successfully.')
      }
      setShowLocationForm(false)
      setEditingLocation(null)
    } catch (error: any) {
      showFeedback('error', messageFromError(error, 'Failed to save location.'))
      throw error
    }
  }

  const handleDeleteLocation = async (id: string) => {
    try {
      await deleteLocation(id)
      showFeedback('success', 'Location deleted successfully.')
    } catch (error: any) {
      showFeedback('error', messageFromError(error, 'Failed to delete location.'))
    }
  }

  // Service Type handlers
  const handleAddServiceType = () => {
    setEditingServiceType(null)
    setShowServiceTypeForm(true)
  }

  const handleEditServiceType = (serviceType: ServiceType) => {
    setEditingServiceType(serviceType)
    setShowServiceTypeForm(true)
  }

  const handleSubmitServiceType = async (data: ServiceTypeCreate | ServiceTypeUpdate) => {
    try {
      if (editingServiceType) {
        await updateServiceType(editingServiceType.id, data as ServiceTypeUpdate)
        showFeedback('success', 'Service type updated successfully.')
      } else {
        await createServiceType(data as ServiceTypeCreate)
        showFeedback('success', 'Service type created successfully.')
      }
      setShowServiceTypeForm(false)
      setEditingServiceType(null)
    } catch (error: any) {
      showFeedback('error', messageFromError(error, 'Failed to save service type.'))
      throw error
    }
  }

  const handleDeleteServiceType = async (id: string) => {
    try {
      await deleteServiceType(id)
      showFeedback('success', 'Service type deleted successfully.')
    } catch (error: any) {
      showFeedback('error', messageFromError(error, 'Failed to delete service type.'))
    }
  }

  // Export CSV
  const handleExportCSV = () => {
    const csvData = orders.map(order => ({
      'Order ID': order.id,
      Device: order.device_label,
      'Service Type': order.service_type,
      Amount: `$${(order.amount_cents / 100).toFixed(2)}`,
      Status: order.status,
      Created: new Date(order.created_at).toLocaleString()
    }))
    exportToCSV(csvData, `orders-${new Date().toISOString().split('T')[0]}.csv`)
  }

  const renderActiveView = () => {
    switch (activeView) {
      case 'devices':
        return (
          <div>
            <div style={{ 
              borderBottom: '1px solid #e2e8f0', 
              marginBottom: '1.5rem',
              display: 'flex',
              gap: '1rem'
            }}>
              <button
                onClick={() => setDevicesTab('devices')}
                style={{
                  padding: '0.75rem 1rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: devicesTab === 'devices' ? '2px solid #4299e1' : '2px solid transparent',
                  color: devicesTab === 'devices' ? '#4299e1' : '#718096',
                  fontWeight: devicesTab === 'devices' ? 600 : 400,
                  cursor: 'pointer'
                }}
              >
                Devices
              </button>
              <button
                onClick={() => setDevicesTab('models')}
                style={{
                  padding: '0.75rem 1rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: devicesTab === 'models' ? '2px solid #4299e1' : '2px solid transparent',
                  color: devicesTab === 'models' ? '#4299e1' : '#718096',
                  fontWeight: devicesTab === 'models' ? 600 : 400,
                  cursor: 'pointer'
                }}
              >
                Models
              </button>
              <button
                onClick={() => setDevicesTab('locations')}
                style={{
                  padding: '0.75rem 1rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: devicesTab === 'locations' ? '2px solid #4299e1' : '2px solid transparent',
                  color: devicesTab === 'locations' ? '#4299e1' : '#718096',
                  fontWeight: devicesTab === 'locations' ? 600 : 400,
                  cursor: 'pointer'
                }}
              >
                Locations
              </button>
            </div>
            {devicesTab === 'devices' && (
              <DeviceGrid
                devices={devices}
                onEdit={handleEditDevice}
                onDelete={handleDeleteDevice}
                onAddNew={handleAddDevice}
              />
            )}
            {devicesTab === 'models' && (
              <DeviceModelsTable
                models={models}
                onAdd={handleAddDeviceModel}
                onEdit={handleEditDeviceModel}
                onDelete={handleDeleteDeviceModel}
              />
            )}
            {devicesTab === 'locations' && (
              <LocationsTable
                locations={locations}
                onAdd={handleAddLocation}
                onEdit={handleEditLocation}
                onDelete={handleDeleteLocation}
              />
            )}
          </div>
        )
      case 'services':
        return (
          <div>
            <div style={{ 
              borderBottom: '1px solid #e2e8f0', 
              marginBottom: '1.5rem',
              display: 'flex',
              gap: '1rem'
            }}>
              <button
                onClick={() => setServicesTab('services')}
                style={{
                  padding: '0.75rem 1rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: servicesTab === 'services' ? '2px solid #4299e1' : '2px solid transparent',
                  color: servicesTab === 'services' ? '#4299e1' : '#718096',
                  fontWeight: servicesTab === 'services' ? 600 : 400,
                  cursor: 'pointer'
                }}
              >
                Services
              </button>
              <button
                onClick={() => setServicesTab('types')}
                style={{
                  padding: '0.75rem 1rem',
                  background: 'none',
                  border: 'none',
                  borderBottom: servicesTab === 'types' ? '2px solid #4299e1' : '2px solid transparent',
                  color: servicesTab === 'types' ? '#4299e1' : '#718096',
                  fontWeight: servicesTab === 'types' ? 600 : 400,
                  cursor: 'pointer'
                }}
              >
                Service Types
              </button>
            </div>
            {servicesTab === 'services' && (
              <ServicesTable
                services={services}
                onEdit={handleEditService}
                onDelete={handleDeleteService}
                onAddNew={handleAddService}
                onStatusChange={fetchServices}
              />
            )}
            {servicesTab === 'types' && (
              <ServiceTypesTable 
                serviceTypes={serviceTypes}
                onAdd={handleAddServiceType}
                onEdit={handleEditServiceType}
                onDelete={handleDeleteServiceType}
              />
            )}
          </div>
        )
      case 'orders':
        return <OrdersTable orders={orders} onExportCSV={handleExportCSV} />
      case 'logs':
        return (
          <LogsTable
            logs={logs}
            loading={logsLoading}
            error={logsError}
            onRefresh={refreshLogs}
          />
        )
      case 'overview':
      default:
        return (
          <div className="overview-stack">
            {stats ? <StatsGrid stats={stats} devices={devices} /> : null}
            
            {/* Live Orders Panel - Real-time order tracking */}
            <div style={{ marginTop: '1.5rem' }}>
              <LiveOrdersPanel refreshInterval={5000} />
            </div>
            
            <div style={{ marginTop: '1.5rem' }}>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Service Distribution</div>
                </div>
                <div style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '0.25rem' }}>
                        Total Services
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                        {services?.length || 0}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.875rem', color: '#718096', marginBottom: '0.25rem' }}>
                        Active Services
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#48bb78' }}>
                        {services?.filter(s => s.active).length || 0}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <OrderTrendsChart orders={orders} />
            </div>
          </div>
        )
    }
  }

  if (isInitialLoading) {
    return <div className="loading">Loading...</div>
  }

  return (
    <>
      <DashboardLayout
        title="RemoteLED Admin"
        subtitle="Control Center"
        navItems={[...NAV_ITEMS]}
        activeItem={activeView}
        onSelect={setActiveView}
        headerSlot={<Header />}
      >
        {feedback ? (
          <div className={`status-banner status-${feedback.type}`}>
            <span>{feedback.message}</span>
            <button type="button" onClick={dismissFeedback} aria-label="Dismiss message">
              ×
            </button>
          </div>
        ) : null}

        {(fetchErrors || []).map((errorMessage, idx) => (
          <div key={`fetch-error-${idx}`} className="status-banner status-error">
            <span>{errorMessage}</span>
          </div>
        ))}

        {renderActiveView()}
      </DashboardLayout>

      <DeviceForm
        isOpen={showDeviceForm}
        onClose={() => {
          setShowDeviceForm(false)
          setEditingDevice(null)
        }}
        onSubmit={handleSubmitDevice}
        editingDevice={editingDevice}
      />

      <ServiceForm
        isOpen={showServiceForm}
        onClose={() => {
          setShowServiceForm(false)
          setEditingService(null)
        }}
        onSubmit={handleSubmitService}
        editingService={editingService}
      />

      {showDeviceModelForm && (
        <DeviceModelForm
          model={editingDeviceModel || undefined}
          onSubmit={handleSubmitDeviceModel}
          onCancel={() => {
            setShowDeviceModelForm(false)
            setEditingDeviceModel(null)
          }}
        />
      )}

      {showLocationForm && (
        <LocationForm
          location={editingLocation || undefined}
          onSubmit={handleSubmitLocation}
          onCancel={() => {
            setShowLocationForm(false)
            setEditingLocation(null)
          }}
        />
      )}

      {showServiceTypeForm && (
        <ServiceTypeForm
          serviceType={editingServiceType || undefined}
          onSubmit={handleSubmitServiceType}
          onCancel={() => {
            setShowServiceTypeForm(false)
            setEditingServiceType(null)
          }}
          existingCodes={serviceTypes?.map(st => st.code) || []}
        />
      )}
    </>
  )
}


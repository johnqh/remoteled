import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = '/api';

interface ServiceFormData {
    device_id: string;
    type: string;
    price_cents: string;
    fixed_minutes: string;
    minutes_per_25c: string;
}

const ServiceForm: React.FC = () => {
    const navigate = useNavigate();
    const [devices, setDevices] = useState<any[]>([]);
    const [formData, setFormData] = useState<ServiceFormData>({
        device_id: '',
        type: 'FIXED',
        price_cents: '',
        fixed_minutes: '',
        minutes_per_25c: ''
    });
    const [error, setError] = useState<string>('');
    const [success, setSuccess] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        loadDevices();
    }, []);

    async function loadDevices() {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/devices/all`);
            const data = await response.json();
            setDevices(data.filter((d: any) => d.status === 'ACTIVE'));
        } catch {
            setError('Failed to load devices');
        }
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError('');
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            // Validation
            if (!formData.device_id) {
                setError('Please select a device');
                setLoading(false);
                return;
            }

            if (!formData.type) {
                setError('Please select a service type');
                setLoading(false);
                return;
            }

            if (!formData.price_cents || parseInt(formData.price_cents) <= 0) {
                setError('Price must be greater than 0');
                setLoading(false);
                return;
            }

            // Type-specific validations
            if (formData.type === 'FIXED' && (!formData.fixed_minutes || parseInt(formData.fixed_minutes) <= 0)) {
                setError('Fixed services require a duration in minutes');
                setLoading(false);
                return;
            }

            if (formData.type === 'VARIABLE' && (!formData.minutes_per_25c || parseInt(formData.minutes_per_25c) <= 0)) {
                setError('Variable services require minutes per 25 cents');
                setLoading(false);
                return;
            }

            const payload: any = {
                device_id: formData.device_id,
                type: formData.type,
                price_cents: parseInt(formData.price_cents),
                active: true
            };

            if (formData.type === 'FIXED') {
                payload.fixed_minutes = parseInt(formData.fixed_minutes);
            } else if (formData.type === 'VARIABLE') {
                payload.minutes_per_25c = parseInt(formData.minutes_per_25c);
            }

            const response = await fetch(`${API_BASE_URL}/admin/services`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to create service');
            }

            setSuccess('Service created successfully!');
            setTimeout(() => navigate('/'), 1500);
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    }

    function formatCurrency(cents: number) {
        return '$' + (cents / 100).toFixed(2);
    }

    return (
        <div className="container" style={{ maxWidth: '800px', margin: '2rem auto' }}>
            <div className="card">
                <div className="card-header">
                    <div className="card-title">Add New Product/Service</div>
                    <button className="btn btn-sm" onClick={() => navigate('/')}>← Back to Dashboard</button>
                </div>
                <div style={{ padding: '2rem' }}>
                    {error && <div className="error-message">{error}</div>}
                    {success && <div style={{ background: '#c6f6d5', color: '#22543d', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>{success}</div>}
                    
                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                Device <span style={{ color: 'red' }}>*</span>
                            </label>
                            <select
                                name="device_id"
                                value={formData.device_id}
                                onChange={handleChange}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                                required
                            >
                                <option value="">Select a device...</option>
                                {devices.map(device => (
                                    <option key={device.id} value={device.id}>
                                        {device.label} ({device.location || 'No location'})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                Service Type <span style={{ color: 'red' }}>*</span>
                            </label>
                            <select
                                name="type"
                                value={formData.type}
                                onChange={handleChange}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                                required
                            >
                                <option value="TRIGGER">TRIGGER - Quick activation (2 seconds)</option>
                                <option value="FIXED">FIXED - Set duration</option>
                                <option value="VARIABLE">VARIABLE - Pay per time</option>
                            </select>
                            <small style={{ color: '#718096', display: 'block', marginTop: '0.5rem' }}>
                                {formData.type === 'TRIGGER' && '🔵 Blue LED blink for 2 seconds'}
                                {formData.type === 'FIXED' && '🟢 Green LED solid for fixed duration'}
                                {formData.type === 'VARIABLE' && '🟠 Amber LED solid, duration based on payment'}
                            </small>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                Price (cents) <span style={{ color: 'red' }}>*</span>
                            </label>
                            <input
                                type="number"
                                name="price_cents"
                                value={formData.price_cents}
                                onChange={handleChange}
                                placeholder="e.g., 100 for $1.00"
                                min="1"
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                                required
                            />
                            {formData.price_cents && (
                                <small style={{ color: '#718096' }}>
                                    = {formatCurrency(parseInt(formData.price_cents) || 0)}
                                </small>
                            )}
                        </div>

                        {formData.type === 'FIXED' && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                    Duration (minutes) <span style={{ color: 'red' }}>*</span>
                                </label>
                                <input
                                    type="number"
                                    name="fixed_minutes"
                                    value={formData.fixed_minutes}
                                    onChange={handleChange}
                                    placeholder="e.g., 30"
                                    min="1"
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                                    required
                                />
                                <small style={{ color: '#718096' }}>How long the device will run</small>
                            </div>
                        )}

                        {formData.type === 'VARIABLE' && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                    Minutes per $0.25 <span style={{ color: 'red' }}>*</span>
                                </label>
                                <input
                                    type="number"
                                    name="minutes_per_25c"
                                    value={formData.minutes_per_25c}
                                    onChange={handleChange}
                                    placeholder="e.g., 5"
                                    min="1"
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                                    required
                                />
                                <small style={{ color: '#718096' }}>How many minutes per quarter</small>
                            </div>
                        )}

                        <div style={{ background: '#f7fafc', padding: '1rem', borderRadius: '6px', marginBottom: '1.5rem' }}>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Service Summary</h4>
                            <p style={{ fontSize: '0.875rem', color: '#4a5568', marginBottom: '0.25rem' }}>
                                <strong>Type:</strong> {formData.type}
                            </p>
                            <p style={{ fontSize: '0.875rem', color: '#4a5568', marginBottom: '0.25rem' }}>
                                <strong>Price:</strong> {formData.price_cents ? formatCurrency(parseInt(formData.price_cents)) : '--'}
                            </p>
                            {formData.type === 'TRIGGER' && (
                                <p style={{ fontSize: '0.875rem', color: '#4a5568' }}>
                                    <strong>Action:</strong> 2 second activation
                                </p>
                            )}
                            {formData.type === 'FIXED' && formData.fixed_minutes && (
                                <p style={{ fontSize: '0.875rem', color: '#4a5568' }}>
                                    <strong>Duration:</strong> {formData.fixed_minutes} minutes
                                </p>
                            )}
                            {formData.type === 'VARIABLE' && formData.minutes_per_25c && (
                                <p style={{ fontSize: '0.875rem', color: '#4a5568' }}>
                                    <strong>Rate:</strong> {formData.minutes_per_25c} minutes per $0.25
                                </p>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={loading}
                                style={{ flex: 1 }}
                            >
                                {loading ? 'Creating...' : 'Create Service'}
                            </button>
                            <button
                                type="button"
                                className="btn"
                                onClick={() => navigate('/')}
                                style={{ flex: 1, background: '#e2e8f0', color: '#2d3748' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ServiceForm;

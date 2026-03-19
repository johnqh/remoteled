import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const API_BASE_URL = '/api';

interface DeviceFormData {
    label: string;
    public_key: string;
    model: string;
    location: string;
    gpio_pin: string;
    status: string;
}

const DeviceForm: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditMode = !!id;

    const [formData, setFormData] = useState<DeviceFormData>({
        label: '',
        public_key: '',
        model: '',
        location: '',
        gpio_pin: '',
        status: 'ACTIVE'
    });
    const [error, setError] = useState<string>('');
    const [success, setSuccess] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        if (isEditMode) {
            loadDevice();
        }
    }, [id]);

    async function loadDevice() {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/devices/all`);
            const devices = await response.json();
            const device = devices.find((d: any) => d.id === id);
            
            if (device) {
                setFormData({
                    label: device.label || '',
                    public_key: '', // Don't show public key in edit mode
                    model: device.model || '',
                    location: device.location || '',
                    gpio_pin: device.gpio_pin?.toString() || '',
                    status: device.status || 'ACTIVE'
                });
            } else {
                setError('Device not found');
            }
        } catch {
            setError('Failed to load device');
        }
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
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
            if (!formData.label.trim()) {
                setError('Label is required');
                setLoading(false);
                return;
            }

            if (!isEditMode && !formData.public_key.trim()) {
                setError('Public key is required for new devices');
                setLoading(false);
                return;
            }

            if (formData.gpio_pin && (parseInt(formData.gpio_pin) < 0 || parseInt(formData.gpio_pin) > 40)) {
                setError('GPIO pin must be between 0 and 40');
                setLoading(false);
                return;
            }

            const payload: any = {
                label: formData.label,
                model: formData.model || null,
                location: formData.location || null,
                gpio_pin: formData.gpio_pin ? parseInt(formData.gpio_pin) : null
            };

            if (isEditMode) {
                payload.status = formData.status;
            } else {
                payload.public_key = formData.public_key;
            }

            const url = isEditMode ? `${API_BASE_URL}/admin/devices/${id}` : `${API_BASE_URL}/admin/devices`;
            const method = isEditMode ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to save device');
            }

            setSuccess(isEditMode ? 'Device updated successfully!' : 'Device created successfully!');
            setTimeout(() => navigate('/'), 1500);
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="container" style={{ maxWidth: '800px', margin: '2rem auto' }}>
            <div className="card">
                <div className="card-header">
                    <div className="card-title">{isEditMode ? 'Edit Device' : 'Add New Device'}</div>
                    <button className="btn btn-sm" onClick={() => navigate('/')}>← Back to Dashboard</button>
                </div>
                <div style={{ padding: '2rem' }}>
                    {error && <div className="error-message">{error}</div>}
                    {success && <div style={{ background: '#c6f6d5', color: '#22543d', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>{success}</div>}
                    
                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                Device Label <span style={{ color: 'red' }}>*</span>
                            </label>
                            <input
                                type="text"
                                name="label"
                                value={formData.label}
                                onChange={handleChange}
                                placeholder="e.g., Laundry Room A"
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                                required
                            />
                        </div>

                        {!isEditMode && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                    Public Key <span style={{ color: 'red' }}>*</span>
                                </label>
                                <textarea
                                    name="public_key"
                                    value={formData.public_key}
                                    onChange={handleChange}
                                    placeholder="-----BEGIN PUBLIC KEY-----&#10;...&#10;-----END PUBLIC KEY-----"
                                    rows={6}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontFamily: 'monospace' }}
                                    required
                                />
                            </div>
                        )}

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                Model
                            </label>
                            <input
                                type="text"
                                name="model"
                                value={formData.model}
                                onChange={handleChange}
                                placeholder="e.g., RPi 4 Model B"
                                maxLength={100}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                            />
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                Location
                            </label>
                            <input
                                type="text"
                                name="location"
                                value={formData.location}
                                onChange={handleChange}
                                placeholder="e.g., Building 5, Floor 2"
                                maxLength={255}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                            />
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                GPIO Pin
                            </label>
                            <input
                                type="number"
                                name="gpio_pin"
                                value={formData.gpio_pin}
                                onChange={handleChange}
                                placeholder="e.g., 17"
                                min="0"
                                max="40"
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                            />
                            <small style={{ color: '#718096' }}>Enter a value between 0 and 40</small>
                        </div>

                        {isEditMode && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                    Status
                                </label>
                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleChange}
                                    style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                                >
                                    <option value="ACTIVE">ACTIVE</option>
                                    <option value="OFFLINE">OFFLINE</option>
                                    <option value="MAINTENANCE">MAINTENANCE</option>
                                    <option value="DEACTIVATED">DEACTIVATED</option>
                                </select>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={loading}
                                style={{ flex: 1 }}
                            >
                                {loading ? 'Saving...' : (isEditMode ? 'Update Device' : 'Create Device')}
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

export default DeviceForm;

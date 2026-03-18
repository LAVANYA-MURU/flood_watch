/**
 * FloodWatch Frontend Application
 * AI Powered Urban Flood Early Warning System
 * 
 * This file handles fetching data from the backend API
 * and dynamically updating the dashboard.
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

// Backend API URL - Change this if your backend runs on a different port
const API_BASE_URL = 'http://localhost:5000';

// API Endpoints
const API_ENDPOINTS = {
    zones: '/api/zones',
    risk: '/api/risk',
    alerts: '/api/alerts'
};

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

// Store for caching API data
let appState = {
    zones: [],
    riskData: [],
    alerts: [],
    activeAlerts: [],
    emergencyAlertLogs: [],
    smsSimulation: null,
    lastUpdated: null
};

// =============================================================================
// LEAFLET MAP INITIALIZATION
// =============================================================================

// Leaflet map instance
let floodMap = null;

// Array to store map circles for easy removal
let mapCircles = [];

/**
 * Initialize the Leaflet map
 */
function initMap() {
    const mapContainer = document.getElementById('flood-map');
    if (!mapContainer) {
        console.error('Map container not found');
        return;
    }

    // Initialize map centered on Chennai
    floodMap = L.map('flood-map').setView([13.0827, 80.2707], 13);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(floodMap);

    console.log('Leaflet map initialized successfully');
}

/**
 * Clear all circles from the map
 */
function clearMapCircles() {
    mapCircles.forEach(circle => {
        if (circle && floodMap) {
            floodMap.removeLayer(circle);
        }
    });
    mapCircles = [];
}

/**
 * Get color based on flood probability value
 */
function getCircleColorByProbability(probability) {
    if (probability >= 75) {
        return '#ef4444'; // red
    } else if (probability >= 60) {
        return '#eab308'; // orange
    }
    return '#22c55e'; // green
}

/**
 * Render flood risk circles on the map
 */
function renderMapCircles(zones) {
    if (!floodMap) {
        console.error('Map not initialized');
        return;
    }

    // Clear existing circles before re-rendering
    clearMapCircles();

    zones.forEach(zone => {
        const mapData = zone.map_data;
        if (!mapData) return;

        const centerLat = mapData.center_lat;
        const centerLon = mapData.center_lon;
        const radiusKm = mapData.risk_radius_km || 0.5;
        
        const fusion = zone.fusion_prediction || {};
        const probability = fusion.probability_percent || 0;
        
        // Derive color directly from probability
        const color = getCircleColorByProbability(probability);
        const heatIntensity = probability / 100.0;

        // Create circle
        const circle = L.circle([centerLat, centerLon], {
            color: color,
            fillColor: color,
            fillOpacity: heatIntensity,
            radius: radiusKm * 1000,
            weight: 2
        }).addTo(floodMap);

        const confidence = fusion.confidence_percent || 0;
        const sar = zone.sar_analysis || {};
        const waterExpansion = sar.water_expansion_rate_percent || 0;
        const geoDistress = zone.geo_distress_analysis || {};
        const distressSpike = geoDistress.distress_spike_detected || false;

        let riskClass = 'low-risk';
        if (probability >= 75) riskClass = 'high-risk';
        else if (probability >= 60) riskClass = 'medium-risk';

        const popupContent = `
            <div class="flood-popup">
                <h4>${zone.name}</h4>
                <div class="popup-row">
                    <span class="popup-label">Flood Probability:</span>
                    <span class="popup-value ${riskClass}">${probability.toFixed(1)}%</span>
                </div>
                <div class="popup-row">
                    <span class="popup-label">Confidence:</span>
                    <span class="popup-value">${confidence.toFixed(1)}%</span>
                </div>
                <div class="popup-row">
                    <span class="popup-label">Water Expansion:</span>
                    <span class="popup-value">${waterExpansion >= 0 ? '+' : ''}${waterExpansion.toFixed(1)}%</span>
                </div>
                <div class="popup-row">
                    <span class="popup-label">Risk Level:</span>
                    <span class="popup-value ${riskClass}">${zone.risk_level}</span>
                </div>
                ${distressSpike ? '<div class="popup-row"><span class="popup-label">Distress Spike:</span><span class="popup-value high-risk">DETECTED</span></div>' : ''}
            </div>
        `;

        circle.bindPopup(popupContent);
        mapCircles.push(circle);
    });

    console.log(`Rendered ${mapCircles.length} zone circles on map`);
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Fetch data from the backend API
 */
async function fetchAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error);
        throw error;
    }
}

/**
 * Fetch all required data from the API
 */
async function fetchAllData() {
    try {
        const riskResponse = await fetchAPI(API_ENDPOINTS.risk);
        
        // Debug: Log the full response
        console.log('API Response:', riskResponse);
        
        return {
            riskData: riskResponse.zones || [],
            activeAlerts: riskResponse.active_alerts || [],
            alerts: riskResponse.alerts || [],
            emergencyAlertLogs: riskResponse.emergency_alert_logs || [],
            smsSimulation: riskResponse.sms_simulation || null,
            timestamp: riskResponse.timestamp || new Date().toISOString(),
            model: riskResponse.model || 'Unknown'
        };
    } catch (error) {
        console.error('Error fetching data:', error);
        showError('Failed to connect to backend. Please ensure the server is running.');
        throw error;
    }
}

// =============================================================================
// UI UPDATE FUNCTIONS
// =============================================================================

function updateAlerts(alerts, riskData = null) {
    const alertsContainer = document.getElementById('alerts-container');
    const alertCount = document.getElementById('alert-count');
    const noAlerts = document.getElementById('no-alerts');
    const alertsSection = document.querySelector('.alerts-section');
    
    let activeAlerts = [];
    if (riskData && riskData.active_alerts && Array.isArray(riskData.active_alerts)) {
        activeAlerts = riskData.active_alerts;
    }
    
    const allAlerts = activeAlerts;
    
    const hasHighAlert = allAlerts.some(a => a.alert_level === 'HIGH');
    const hasMediumAlert = allAlerts.some(a => a.alert_level === 'MEDIUM');
    
    if (hasHighAlert) {
        alertsSection.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
        alertsSection.style.border = '2px solid #ef4444';
        alertCount.style.background = '#ef4444';
    } else if (hasMediumAlert) {
        alertsSection.style.background = 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)';
        alertsSection.style.border = '2px solid #f59e0b';
        alertCount.style.background = '#f59e0b';
    } else {
        alertsSection.style.background = '';
        alertsSection.style.border = '';
        alertCount.style.background = '';
    }
    
    noAlerts.style.display = 'none';
    alertCount.textContent = allAlerts.length;
    
    if (allAlerts.length === 0) {
        noAlerts.style.display = 'flex';
        noAlerts.style.background = 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)';
        noAlerts.innerHTML = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg><p style="color: #166534; font-weight: 600;">No active alerts – All zones safe</p>';
        
        const existingAlerts = alertsContainer.querySelectorAll('.alert-card');
        existingAlerts.forEach(alert => alert.remove());
        
        alertCount.classList.add('zero');
    } else {
        noAlerts.style.display = 'none';
        alertCount.classList.remove('zero');
        
        const existingAlerts = alertsContainer.querySelectorAll('.alert-card');
        existingAlerts.forEach(alert => alert.remove());
        
        allAlerts.forEach(alert => {
            const alertCard = createActiveAlertCard(alert);
            alertsContainer.appendChild(alertCard);
        });
    }
}

function createActiveAlertCard(alert) {
    const card = document.createElement('div');
    card.className = 'alert-card';
    
    const isHigh = alert.alert_level === 'HIGH';
    const bgGradient = isHigh 
        ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)'
        : 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)';
    const borderColor = isHigh ? '#ef4444' : '#f59e0b';
    const titleColor = isHigh ? '#dc2626' : '#d97706';
    const labelColor = isHigh ? '#7f1d1d' : '#92400e';
    const valueColor = isHigh ? '#991b1b' : '#b45309';
    
    card.style.background = bgGradient;
    card.style.borderLeftColor = borderColor;
    
    const sosSpikeDetected = alert.sos_spike_detected === true;
    const sosMessage = alert.sos_spike_message || '';
    
    let sosHtml = '';
    if (sosSpikeDetected) {
        sosHtml = `
            <div style="margin-top: 8px; padding: 8px; background: rgba(220, 38, 38, 0.1); border-radius: 4px; border: 1px solid #dc2626;">
                <span style="color: #dc2626; font-weight: 600; font-size: 12px;">
                    🚨 SOS Signal Spike Detected
                </span>
                <p style="color: #991b1b; font-size: 11px; margin: 4px 0 0 0;">${sosMessage}</p>
            </div>
        `;
    }
    
    card.innerHTML = `
        <h3 style="color: ${titleColor};">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            ${alert.zone_name} - ${alert.alert_level} Alert
        </h3>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 8px;">
            <div style="font-size: 12px;">
                <span style="color: ${labelColor};">Flood Probability:</span>
                <strong style="color: ${valueColor};">${alert.flood_probability}%</strong>
            </div>
            <div style="font-size: 12px;">
                <span style="color: ${labelColor};">Confidence:</span>
                <strong style="color: ${valueColor};">${alert.confidence_percent}%</strong>
            </div>
            <div style="font-size: 12px;">
                <span style="color: ${labelColor};">Lead Time:</span>
                <strong style="color: ${valueColor};">${alert.lead_time} min</strong>
            </div>
            <div style="font-size: 12px;">
                <span style="color: ${labelColor};">Distress Count:</span>
                <strong style="color: ${valueColor};">${alert.distress_post_count}</strong>
            </div>
        </div>
        ${sosHtml}
    `;
    
    return card;
}

/**
 * Update Emergency Alert Console section
 */
function updateEmergencyAlerts(emergencyAlerts) {
    const emergencySection = document.getElementById('emergency-console-section');
    const emergencyContainer = document.getElementById('emergency-alerts-container');
    
    if (!emergencySection || !emergencyContainer) return;
    
    // Clear previous content
    emergencyContainer.innerHTML = '';
    
    // Render section if emergency_alert_logs exists AND length > 0
    if (!emergencyAlerts || emergencyAlerts.length === 0) {
        emergencySection.style.display = 'none';
        return;
    }
    
    // Show section
    emergencySection.style.display = 'block';
    
    // Add emergency alert cards
    emergencyAlerts.forEach(alert => {
        const alertCard = document.createElement('div');
        alertCard.className = 'emergency-alert-card';
        alertCard.style.cssText = `
            background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
            border: 2px solid #ef4444;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 12px;
            animation: emergency-blink 1s ease-in-out infinite;
        `;
        
        alertCard.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                <span style="font-size: 18px;">🚨</span>
                <h3 style="color: #dc2626; font-size: 14px; font-weight: 700; margin: 0; text-transform: uppercase;">Emergency Alert</h3>
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 12px;">
                <div>
                    <span style="color: #7f1d1d; font-weight: 600;">Zone:</span>
                    <span style="color: #991b1b; font-weight: 700;">${alert.zone_name}</span>
                </div>
                <div>
                    <span style="color: #7f1d1d; font-weight: 600;">Flood Probability:</span>
                    <span style="color: #991b1b; font-weight: 700;">${alert.flood_probability}%</span>
                </div>
                <div>
                    <span style="color: #7f1d1d; font-weight: 600;">Confidence:</span>
                    <span style="color: #991b1b; font-weight: 700;">${alert.confidence_percent}%</span>
                </div>
                <div>
                    <span style="color: #7f1d1d; font-weight: 600;">Lead Time:</span>
                    <span style="color: #991b1b; font-weight: 700;">${alert.lead_time}</span>
                </div>
            </div>
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #fecaca; font-size: 11px; color: #7f1d1d;">
                <span style="font-weight: 600;">Timestamp:</span> ${formatTimestamp(alert.timestamp)}
            </div>
        `;
        
        emergencyContainer.appendChild(alertCard);
    });
}

/**
 * Update SMS Dispatch Simulation section
 */
function updateSMSDispatch(smsData) {
    const smsSection = document.getElementById('sms-dispatch-section');
    const smsContainer = document.getElementById('sms-dispatch-container');
    
    if (!smsSection || !smsContainer) return;
    
    // Clear previous content
    smsContainer.innerHTML = '';
    
    // Render section if sms_simulation is NOT null
    if (!smsData) {
        smsSection.style.display = 'none';
        return;
    }
    
    // Show section
    smsSection.style.display = 'block';
    
    // Create SMS dispatch card
    const smsCard = document.createElement('div');
    smsCard.className = 'sms-dispatch-card';
    smsCard.style.cssText = `
        background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
        border: 2px solid #f97316;
        border-radius: 8px;
        padding: 12px;
    `;
    
    smsCard.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <span style="font-size: 18px;">📱</span>
            <h3 style="color: #c2410c; font-size: 14px; font-weight: 700; margin: 0; text-transform: uppercase;">SMS Dispatch Simulation</h3>
        </div>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 12px; margin-bottom: 10px;">
            <div>
                <span style="color: #7c2d12; font-weight: 600;">Zone:</span>
                <span style="color: #9a3412; font-weight: 700;">${smsData.zone_name}</span>
            </div>
            <div>
                <span style="color: #7c2d12; font-weight: 600;">Status:</span>
                <span style="color: #16a34a; font-weight: 700;">${smsData.status}</span>
            </div>
            <div>
                <span style="color: #7c2d12; font-weight: 600;">Recipients:</span>
                <span style="color: #9a3412; font-weight: 700;">${smsData.recipients_notified.toLocaleString()}</span>
            </div>
            <div>
                <span style="color: #7c2d12; font-weight: 600;">Timestamp:</span>
                <span style="color: #9a3412; font-weight: 700;">${formatTimestamp(smsData.timestamp)}</span>
            </div>
        </div>
        <div style="background: white; border-radius: 4px; padding: 10px; font-size: 11px; color: #7c2d12;">
            <span style="font-weight: 600;">Message:</span>
            <p style="margin: 4px 0 0 0; color: #431407;">${smsData.message}</p>
        </div>
    `;
    
    smsContainer.appendChild(smsCard);
}

function updateZones(zones) {
    const zonesGrid = document.getElementById('zones-grid');
    zonesGrid.innerHTML = '';
    
    zones.forEach(zone => {
        const zoneCard = createZoneCard(zone);
        zonesGrid.appendChild(zoneCard);
    });
}

function createZoneCard(zone) {
    const card = document.createElement('div');
    
    const sar = zone.sar_analysis || {};
    const surfaceIndex = sar.surface_water_index || 0;
    const expansionRate = sar.water_expansion_rate_percent || 0;
    const corridorSpread = sar.corridor_spread_detected || false;
    
    const geoDistress = zone.geo_distress_analysis || {};
    const distressSpike = geoDistress.distress_spike_detected || false;
    const clusterCount = geoDistress.cluster_count || 0;
    const clusterCenter = geoDistress.cluster_center || null;
    const clusterRadius = geoDistress.cluster_radius_km || 1.2;
    
    const fusion = zone.fusion_prediction || {};
    const probability = fusion.probability_percent || 0;
    const leadTime = fusion.lead_time_minutes || 0;
    const confidence = fusion.confidence_percent || 0;
    
    // Determine risk level based on flood_probability value
    let riskLevel = 'low';
    let riskBadgeText = 'LOW RISK';
    if (probability >= 75) {
        riskLevel = 'high';
        riskBadgeText = 'HIGH RISK';
    } else if (probability >= 60) {
        riskLevel = 'medium';
        riskBadgeText = 'MODERATE RISK';
    }
    
    card.className = `zone-card ${riskLevel}`;
    
    // Apply inline styles based on probability value
    if (probability >= 75) {
        card.style.border = '2px solid #ef4444';
        card.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
    } else if (probability >= 60) {
        card.style.border = '2px solid #f59e0b';
        card.style.background = 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)';
    }
    
    let sarIndicatorClass = 'sar-low';
    if (surfaceIndex > 0.7) {
        sarIndicatorClass = 'sar-high';
    } else if (surfaceIndex >= 0.4) {
        sarIndicatorClass = 'sar-medium';
    }
    
    let probBarClass = 'prob-low';
    if (probability >= 75) {
        probBarClass = 'prob-high';
    } else if (probability >= 60) {
        probBarClass = 'prob-medium';
    }
    
    const corridorBadge = corridorSpread 
        ? `<div class="corridor-badge">
             <span class="badge-dot"></span>
             Low-Lying Corridor Spread
           </div>`
        : '';
    
    const geoSpikeBadge = distressSpike
        ? `<div class="geo-spike-badge">
             <span class="geo-spike-icon">📍</span>
             <span>Geo-Distress Spike: ${clusterCount} posts in ${clusterRadius}km</span>
           </div>`
        : '';
    
    let clusterCenterHtml = '';
    if (clusterCenter) {
        clusterCenterHtml = `
            <div class="geo-cluster-info">
                <span class="geo-label">Cluster Center:</span>
                <span class="geo-value">${clusterCenter.lat}, ${clusterCenter.lon}</span>
            </div>
        `;
    }
    
    card.innerHTML = `
        <div class="zone-header">
            <span class="zone-name">${zone.name}</span>
            <span class="risk-badge ${riskLevel}">${riskBadgeText}</span>
        </div>
        
        <div class="zone-data">
            <div class="data-item">
                <span class="data-label">Rainfall</span>
                <span class="data-value">${zone.data.rainfall_mm} mm</span>
            </div>
            <div class="data-item">
                <span class="data-label">Citizen Reports</span>
                <span class="data-value">${zone.data.social_reports}</span>
            </div>
            <div class="data-item">
                <span class="data-label">Water Level</span>
                <span class="data-value">${zone.data.water_level_m} m</span>
            </div>
            <div class="data-item">
                <span class="data-label">Lead Time</span>
                <span class="data-value">${leadTime} min</span>
            </div>
        </div>
        
        <div class="sar-section">
            <div class="sar-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <circle cx="12" cy="12" r="6"></circle>
                    <circle cx="12" cy="12" r="2"></circle>
                </svg>
                <span>SAR Radar Monitoring</span>
            </div>
            <div class="sar-data">
                <div class="sar-item">
                    <span class="sar-label">Surface Water Index</span>
                    <div class="sar-value-container">
                        <span class="sar-value ${sarIndicatorClass}">${surfaceIndex.toFixed(2)}</span>
                        <span class="sar-indicator ${sarIndicatorClass}"></span>
                    </div>
                </div>
                <div class="sar-item">
                    <span class="sar-label">Water Expansion Rate</span>
                    <span class="sar-value">${expansionRate >= 0 ? '+' : ''}${expansionRate.toFixed(1)}%</span>
                </div>
                <div class="sar-item">
                    <span class="sar-label">Corridor Spread</span>
                    <span class="sar-value ${corridorSpread ? 'corridor-detected' : ''}">${corridorSpread ? 'Yes' : 'No'}</span>
                </div>
            </div>
            ${corridorBadge}
        </div>
        
        <div class="geo-section ${distressSpike ? 'geo-spike-active' : ''}">
            <div class="geo-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>Geo-Radius Clustering</span>
                ${distressSpike ? '<span class="spike-indicator">⚠️ SPIKE</span>' : ''}
            </div>
            <div class="geo-data">
                <div class="geo-item">
                    <span class="geo-label">Distress Spike</span>
                    <span class="geo-value ${distressSpike ? 'spike-detected' : ''}">${distressSpike ? 'DETECTED' : 'None'}</span>
                </div>
                <div class="geo-item">
                    <span class="geo-label">Cluster Count</span>
                    <span class="geo-value">${clusterCount} posts</span>
                </div>
                <div class="geo-item">
                    <span class="geo-label">Cluster Radius</span>
                    <span class="geo-value">${clusterRadius} km</span>
                </div>
            </div>
            ${clusterCenterHtml}
            ${geoSpikeBadge}
        </div>
        
        <div class="fusion-section">
            <div class="fusion-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                    <path d="M2 17l10 5 10-5"></path>
                    <path d="M2 12l10 5 10-5"></path>
                </svg>
                <span>AI Fusion Prediction</span>
            </div>
            <div class="fusion-stats">
                <div class="fusion-item">
                    <span class="fusion-label">Flood Probability</span>
                    <div class="prob-bar-container">
                        <div class="prob-bar ${probBarClass}" style="width: ${probability}%"></div>
                    </div>
                    <span class="fusion-value ${probBarClass}">${probability.toFixed(1)}%</span>
                </div>
                <div class="fusion-item">
                    <span class="fusion-label">Model Confidence</span>
                    <span class="fusion-value">${confidence}%</span>
                </div>
            </div>
        </div>
        
        <p class="zone-description">${zone.description}</p>
    `;
    
    return card;
}

function updateLastUpdated(timestamp) {
    const lastUpdatedEl = document.getElementById('last-updated');
    if (lastUpdatedEl) {
        lastUpdatedEl.textContent = formatTimestamp(timestamp);
    }
}

function formatTimestamp(timestamp) {
    try {
        const date = new Date(timestamp);
        return date.toLocaleString();
    } catch (error) {
        return timestamp;
    }
}

function showError(message) {
    const alertsContainer = document.getElementById('alerts-container');
    const noAlerts = document.getElementById('no-alerts');
    
    noAlerts.style.display = 'none';
    
    const errorCard = document.createElement('div');
    errorCard.className = 'alert-card';
    errorCard.style.background = '#fee2e2';
    errorCard.style.borderLeftColor = '#ef4444';
    
    errorCard.innerHTML = `
        <h3 style="color: #ef4444;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            Connection Error
        </h3>
        <p>${message}</p>
        <p>Make sure the Flask backend is running on port 5000.</p>
    `;
    
    alertsContainer.appendChild(errorCard);
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

async function loadDashboard() {
    try {
        console.log('Loading FloodWatch dashboard...');
        
        const data = await fetchAllData();
        
        appState.riskData = data.riskData;
        appState.activeAlerts = data.activeAlerts;
        appState.alerts = data.alerts;
        appState.emergencyAlertLogs = data.emergencyAlertLogs;
        appState.smsSimulation = data.smsSimulation;
        appState.lastUpdated = data.timestamp;
        
        updateAlerts(data.alerts, data);
        updateEmergencyAlerts(data.emergencyAlertLogs);
        updateSMSDispatch(data.smsSimulation);
        updateZones(data.riskData);
        updateLastUpdated(data.timestamp);
        
        // Render map circles with zone data
        renderMapCircles(data.riskData);
        
        console.log('Dashboard loaded successfully!');
        console.log(`Model: ${data.model}`);
        console.log(`Found ${data.activeAlerts.length} active alerts`);
        console.log(`Monitoring ${data.riskData.length} zones`);
        console.log(`Emergency Alerts: ${data.emergencyAlertLogs.length}`);
        console.log(`SMS Simulation: ${data.smsSimulation ? 'Active' : 'None'}`);
        
    } catch (error) {
        console.error('Failed to load dashboard:', error);
    }
}

async function refreshData() {
    const refreshBtn = document.querySelector('.refresh-btn');
    
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = `
        <svg class="loading-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
        Refreshing...
    `;
    
    try {
        await loadDashboard();
    } finally {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            Refresh
        `;
    }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

function init() {
    console.log('Initializing FloodWatch...');
    
    // Initialize the Leaflet map
    initMap();
    
    // Check if the API is available
    fetchAPI('/')
        .then(data => {
            console.log('API Status:', data);
            
            // Load dashboard data
            loadDashboard();
            
            // Auto-refresh every 5 seconds
            setInterval(loadDashboard, 5000);
        })
        .catch(error => {
            console.error('API not available:', error);
            showError('Cannot connect to FloodWatch API. Please start the backend server.');
        });
}

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', init);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getZoneById(zoneId) {
    return appState.riskData.find(zone => zone.id === zoneId) || null;
}

function getAlertsForZone(zoneId) {
    return appState.alerts.filter(alert => alert.zone_id === zoneId);
}

function getZonesByRiskLevel(riskLevel) {
    return appState.riskData.filter(zone => zone.risk_level === riskLevel);
}

function exportData() {
    return {
        zones: appState.riskData,
        alerts: appState.alerts,
        activeAlerts: appState.activeAlerts,
        emergencyAlertLogs: appState.emergencyAlertLogs,
        smsSimulation: appState.smsSimulation,
        lastUpdated: appState.lastUpdated
    };
}

// Make functions available globally for debugging
window.FloodWatch = {
    refreshData,
    getZoneById,
    getAlertsForZone,
    getZonesByRiskLevel,
    exportData
};

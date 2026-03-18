/**
 * FloodWatch Frontend Application
 * AI Powered Urban Flood Early Warning System
 * 
 * This file handles fetching data from the backend API
 * and dynamically updating the dashboard with live map visualization.
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
    lastUpdated: null
};

// Map instance and markers
let floodMap = null;
let mapLayers = {};

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Fetch data from the backend API
 * @param {string} endpoint - API endpoint to fetch from
 * @returns {Promise<Object>} - JSON response from API
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
 * @returns {Promise<Object>} - Combined data from all endpoints
 */
async function fetchAllData() {
    try {
        // Fetch risk data which now includes active_alerts and map_data
        const riskResponse = await fetchAPI(API_ENDPOINTS.risk);
        
        return {
            riskData: riskResponse.zones || [],
            activeAlerts: riskResponse.active_alerts || [],
            alerts: riskResponse.alerts || [],
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
// MAP FUNCTIONS WITH ANIMATIONS
// =============================================================================

/**
 * Initialize the Leaflet map
 */
function initMap() {
    const mapContainer = document.getElementById('flood-map');
    if (!mapContainer) {
        console.warn('Map container not found');
        return;
    }
    
    // Initialize map centered on NYC
    floodMap = L.map('flood-map').setView([40.73, -73.95], 11);
    
    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(floodMap);
    
    console.log('Map initialized');
}

/**
 * Update map with zone data and animations
 * Only updates affected zone layers without reloading entire map
 * @param {Array} zones - List of zone risk data with map_data
 */
function updateMap(zones) {
    if (!floodMap) {
        initMap();
    }
    
    // Track which zones are still active
    const activeZoneIds = new Set();
    
    zones.forEach(zone => {
        activeZoneIds.add(zone.id);
        const mapData = zone.map_data;
        
        if (!mapData || !mapData.center_lat || !mapData.center_lon) {
            console.warn(`No map data for zone: ${zone.name}`);
            return;
        }
        
        const sar = zone.sar_analysis || {};
        const geo = zone.geo_distress_analysis || {};
        
        // Get values for animations
        const expansionRate = sar.water_expansion_rate_percent || 0;
        const surfaceIndex = sar.surface_water_index || 0;
        const distressSpike = geo.distress_spike_detected || false;
        
        // Update or create zone layer
        if (mapLayers[zone.id]) {
            // Update existing layer with animation
            updateZoneLayer(zone, mapData, expansionRate, surfaceIndex, distressSpike);
        } else {
            // Create new layer
            createZoneLayer(zone, mapData, expansionRate, surfaceIndex, distressSpike);
        }
    });
    
    // Remove layers for zones that no longer exist
    Object.keys(mapLayers).forEach(zoneId => {
        if (!activeZoneIds.has(parseInt(zoneId))) {
            removeZoneLayer(zoneId);
        }
    });
    
    // Fit map to show all markers if this is first load
    if (Object.keys(mapLayers).length > 0) {
        const group = L.featureGroup(Object.values(mapLayers).map(l => l.marker));
        floodMap.fitBounds(group.getBounds().pad(0.1));
    }
}

/**
 * Create a new zone layer with animations
 */
function createZoneLayer(zone, mapData, expansionRate, surfaceIndex, distressSpike) {
    const color = getRiskColorHex(mapData.risk_color || 'green');
    const radiusMeters = mapData.risk_radius_km * 1000;
    
    // Create heat circle with animation
    const heatCircle = L.circle([mapData.center_lat, mapData.center_lon], {
        radius: radiusMeters,
        color: color,
        fillColor: color,
        fillOpacity: 0.3,
        weight: 2,
        className: 'heat-circle'
    }).addTo(floodMap);
    
    // Add expanding animation if expansion rate > 10%
    if (expansionRate > 10) {
        animateCircleExpansion(heatCircle, radiusMeters, expansionRate);
    }
    
    // Add heat intensity glow if surface_index > 0.75
    if (surfaceIndex > 0.75) {
        addHeatGlow(heatCircle, color);
    }
    
    // Add distress spike flashing border
    if (distressSpike) {
        addDistressFlashing(heatCircle);
    }
    
    // Create marker
    const marker = L.circleMarker([mapData.center_lat, mapData.center_lon], {
        radius: 8,
        fillColor: color,
        color: '#fff',
        weight: 2,
        fillOpacity: 1,
        className: 'zone-marker'
    }).addTo(floodMap);
    
    // Create popup content
    const popupContent = createPopupContent(zone, mapData);
    heatCircle.bindPopup(popupContent);
    marker.bindPopup(popupContent);
    
    // Store layer references
    mapLayers[zone.id] = {
        heatCircle,
        marker,
        color,
        currentRadius: radiusMeters,
        hasGlow: false,
        hasFlashing: false
    };
}

/**
 * Update existing zone layer with animations
 */
function updateZoneLayer(zone, mapData, expansionRate, surfaceIndex, distressSpike) {
    const layer = mapLayers[zone.id];
    if (!layer) return;
    
    const newColor = getRiskColorHex(mapData.risk_color || 'green');
    const newRadius = mapData.risk_radius_km * 1000;
    
    // Animate radius change if expansion rate > 10%
    if (expansionRate > 10 && Math.abs(newRadius - layer.currentRadius) > 50) {
        animateCircleRadius(layer.heatCircle, layer.currentRadius, newRadius);
        layer.currentRadius = newRadius;
    }
    
    // Update color
    layer.heatCircle.setStyle({ color: newColor, fillColor: newColor });
    layer.marker.setStyle({ fillColor: newColor });
    layer.color = newColor;
    
    // Update heat glow based on surface_index
    if (surfaceIndex > 0.75 && !layer.hasGlow) {
        addHeatGlow(layer.heatCircle, newColor);
        layer.hasGlow = true;
    } else if (surfaceIndex <= 0.75 && layer.hasGlow) {
        removeHeatGlow(layer.heatCircle);
        layer.hasGlow = false;
    }
    
    // Update distress flashing
    if (distressSpike && !layer.hasFlashing) {
        addDistressFlashing(layer.heatCircle);
        layer.hasFlashing = true;
    } else if (!distressSpike && layer.hasFlashing) {
        removeDistressFlashing(layer.heatCircle);
        layer.hasFlashing = false;
    }
    
    // Update popup content
    const popupContent = createPopupContent(zone, mapData);
    layer.heatCircle.setPopupContent(popupContent);
    layer.marker.setPopupContent(popupContent);
}

/**
 * Remove a zone layer
 */
function removeZoneLayer(zoneId) {
    const layer = mapLayers[zoneId];
    if (layer) {
        floodMap.removeLayer(layer.heatCircle);
        floodMap.removeLayer(layer.marker);
        delete mapLayers[zoneId];
    }
}

/**
 * Animate circle radius expansion over 3 seconds
 */
function animateCircleRadius(circle, fromRadius, toRadius) {
    const duration = 3000; // 3 seconds
    const startTime = Date.now();
    
    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease-out animation
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentRadius = fromRadius + (toRadius - fromRadius) * eased;
        
        circle.setRadius(currentRadius);
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    
    requestAnimationFrame(animate);
}

/**
 * Animate initial circle expansion for new zones
 */
function animateCircleExpansion(circle, baseRadius, expansionRate) {
    const maxExpansion = Math.min(expansionRate / 10, 2); // Max 2x expansion
    const targetRadius = baseRadius * (1 + maxExpansion * 0.3);
    
    // Start from smaller radius
    circle.setRadius(baseRadius * 0.7);
    
    // Animate to target
    const duration = 3000;
    const startTime = Date.now();
    
    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Pulse animation
        const eased = 1 - Math.pow(1 - progress, 2);
        const currentRadius = (baseRadius * 0.7) + (targetRadius - baseRadius * 0.7) * eased;
        
        circle.setRadius(currentRadius);
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    
    requestAnimationFrame(animate);
}

/**
 * Add heat glow effect for high surface water index
 */
function addHeatGlow(circle, color) {
    const element = circle.getElement();
    if (element) {
        element.classList.add('heat-glow');
        element.style.boxShadow = `0 0 20px ${color}, 0 0 40px ${color}`;
    }
}

/**
 * Remove heat glow effect
 */
function removeHeatGlow(circle) {
    const element = circle.getElement();
    if (element) {
        element.classList.remove('heat-glow');
        element.style.boxShadow = '';
    }
}

/**
 * Add flashing border for distress spike
 */
function addDistressFlashing(circle) {
    const element = circle.getElement();
    if (element) {
        element.classList.add('distress-flash');
    }
}

/**
 * Remove flashing border
 */
function removeDistressFlashing(circle) {
    const element = circle.getElement();
    if (element) {
        element.classList.remove('distress-flash');
    }
}

/**
 * Create popup content for zone
 */
function createPopupContent(zone, mapData) {
    const sar = zone.sar_analysis || {};
    const geo = zone.geo_distress_analysis || {};
    const fusion = zone.fusion_prediction || {};
    
    return `
        <div style="min-width: 220px; font-family: Arial, sans-serif;">
            <h3 style="margin: 0 0 10px 0; color: ${mapData.risk_color}; border-bottom: 2px solid ${mapData.risk_color}; padding-bottom: 5px;">
                ${zone.name}
            </h3>
            <p style="margin: 5px 0;"><strong>Risk Level:</strong> ${zone.risk_level}</p>
            <p style="margin: 5px 0;"><strong>Flood Probability:</strong> ${fusion.probability_percent}%</p>
            <hr style="margin: 10px 0; border: 0; border-top: 1px solid #ddd;">
            <p style="margin: 5px 0; font-size: 12px; color: #666;"><strong>Map Visualization:</strong></p>
            <p style="margin: 3px 0; font-size: 11px;">📍 Center: ${mapData.center_lat}, ${mapData.center_lon}</p>
            <p style="margin: 3px 0; font-size: 11px;">⭕ Radius: ${mapData.risk_radius_km} km</p>
            <p style="margin: 3px 0; font-size: 11px;">🎨 Color: <span style="color: ${mapData.risk_color}; font-weight: bold;">${mapData.risk_color}</span></p>
            <p style="margin: 3px 0; font-size: 11px;">🔥 Heat: ${mapData.heat_intensity}</p>
            <hr style="margin: 10px 0; border: 0; border-top: 1px solid #ddd;">
            <p style="margin: 3px 0; font-size: 11px;">📡 SAR: ${sar.surface_water_index} (${sar.water_expansion_rate_percent}%)</p>
            ${geo.distress_spike_detected ? '<p style="margin: 5px 0; font-size: 11px; color: red; font-weight: bold;">⚠️ DISTRESS SPIKE</p>' : ''}
        </div>
    `;
}

/**
 * Get hex color for risk color string
 */
function getRiskColorHex(riskColor) {
    const colors = {
        'green': '#22c55e',
        'orange': '#eab308',
        'red': '#ef4444'
    };
    return colors[riskColor] || colors['green'];
}

// =============================================================================
// UI UPDATE FUNCTIONS
// =============================================================================

/**
 * Update the alerts panel with current alerts
 */
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

/**
 * Create an active alert card
 */
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
 * Update the zones grid with risk data
 */
function updateZones(zones) {
    const zonesGrid = document.getElementById('zones-grid');
    zonesGrid.innerHTML = '';
    
    zones.forEach(zone => {
        const zoneCard = createZoneCard(zone);
        zonesGrid.appendChild(zoneCard);
    });
}

/**
 * Create a zone card element
 */
function createZoneCard(zone) {
    const card = document.createElement('div');
    const riskLevel = zone.risk_level.toLowerCase();
    card.className = `zone-card ${riskLevel}`;
    
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
    
    const mapData = zone.map_data || {};
    const centerLat = mapData.center_lat || 'N/A';
    const centerLon = mapData.center_lon || 'N/A';
    const riskRadiusKm = mapData.risk_radius_km || 'N/A';
    const riskColor = mapData.risk_color || 'N/A';
    const heatIntensity = mapData.heat_intensity || 'N/A';
    
    let sarIndicatorClass = 'sar-low';
    if (surfaceIndex > 0.7) sarIndicatorClass = 'sar-high';
    else if (surfaceIndex >= 0.4) sarIndicatorClass = 'sar-medium';
    
    let probBarClass = 'prob-low';
    if (probability > 85) probBarClass = 'prob-high';
    else if (probability > 60) probBarClass = 'prob-medium';
    
    const corridorBadge = corridorSpread 
        ? `<div class="corridor-badge"><span class="badge-dot"></span>Low-Lying Corridor Spread</div>` : '';
    
    const geoSpikeBadge = distressSpike
        ? `<div class="geo-spike-badge"><span class="geo-spike-icon">📍</span><span>Geo-Distress Spike: ${clusterCount} posts in ${clusterRadius}km</span></div>` : '';
    
    let clusterCenterHtml = '';
    if (clusterCenter) {
        clusterCenterHtml = `<div class="geo-cluster-info"><span class="geo-label">Cluster Center:</span><span class="geo-value">${clusterCenter.lat}, ${clusterCenter.lon}</span></div>`;
    }
    
    card.innerHTML = `
        <div class="zone-header">
            <span class="zone-name">${zone.name}</span>
            <span class="risk-badge ${riskLevel}">${zone.risk_level} Risk</span>
        </div>
        
        <div class="zone-data">
            <div class="data-item"><span class="data-label">Rainfall</span><span class="data-value">${zone.data.rainfall_mm} mm</span></div>
            <div class="data-item"><span class="data-label">Citizen Reports</span><span class="data-value">${zone.data.social_reports}</span></div>
            <div class="data-item"><span class="data-label">Water Level</span><span class="data-value">${zone.data.water_level_m} m</span></div>
            <div class="data-item"><span class="data-label">Lead Time</span><span class="data-value">${leadTime} min</span></div>
        </div>
        
        <div class="sar-section">
            <div class="sar-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
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
                <div class="sar-item"><span class="sar-label">Water Expansion Rate</span><span class="sar-value">${expansionRate >= 0 ? '+' : ''}${expansionRate.toFixed(1)}%</span></div>
                <div class="sar-item"><span class="sar-label">Corridor Spread</span><span class="sar-value ${corridorSpread ? 'corridor-detected' : ''}">${corridorSpread ? 'Yes' : 'No'}</span></div>
            </div>
            ${corridorBadge}
        </div>
        
        <div class="geo-section ${distressSpike ? 'geo-spike-active' : ''}">
            <div class="geo-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                <span>Geo-Radius Clustering</span>
                ${distressSpike ? '<span class="spike-indicator">⚠️ SPIKE</span>' : ''}
            </div>
            <div class="geo-data">
                <div class="geo-item"><span class="geo-label">Distress Spike</span><span class="geo-value ${distressSpike ? 'spike-detected' : ''}">${distressSpike ? 'DETECTED' : 'None'}</span></div>
                <div class="geo-item"><span class="geo-label">Cluster Count</span><span class="geo-value">${clusterCount} posts</span></div>
                <div class="geo-item"><span class="geo-label">Cluster Radius</span><span class="geo-value">${clusterRadius} km</span></div>
            </div>
            ${clusterCenterHtml}
            ${geoSpikeBadge}
        </div>
        
        <div class="map-data-section">
            <div class="map-data-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                <span>Map Visualization Data</span>
            </div>
            <div class="map-data-grid">
                <div class="map-data-item"><span class="map-data-label">Center Lat</span><span class="map-data-value">${centerLat}</span></div>
                <div class="map-data-item"><span class="map-data-label">Center Lon</span><span class="map-data-value">${centerLon}</span></div>
                <div class="map-data-item"><span class="map-data-label">Risk Radius</span><span class="map-data-value">${riskRadiusKm} km</span></div>
                <div class="map-data-item"><span class="map-data-label">Risk Color</span><span class="map-data-value risk-color-${riskColor}">${riskColor}</span></div>
                <div class="map-data-item"><span class="map-data-label">Heat Intensity</span><span class="map-data-value">${heatIntensity}</span></div>
            </div>
        </div>
        
        <div class="fusion-section">
            <div class="fusion-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
                <span>AI Fusion Prediction</span>
            </div>
            <div class="fusion-stats">
                <div class="fusion-item">
                    <span class="fusion-label">Flood Probability</span>
                    <div class="prob-bar-container"><div class="prob-bar ${probBarClass}" style="width: ${probability}%"></div></div>
                    <span class="fusion-value ${probBarClass}">${probability.toFixed(1)}%</span>
                </div>
                <div class="fusion-item"><span class="fusion-label">Model Confidence</span><span class="fusion-value">${confidence}%</span></div>
            </div>
        </div>
        
        <p class="zone-description">${zone.description}</p>
    `;
    
    return card;
}

/**
 * Update the last updated timestamp
 */
function updateLastUpdated(timestamp) {
    const lastUpdatedEl = document.getElementById('last-updated');
    if (lastUpdatedEl) {
        lastUpdatedEl.textContent = formatTimestamp(timestamp);
    }
}

/**
 * Format ISO timestamp
 */
function formatTimestamp(timestamp) {
    try {
        const date = new Date(timestamp);
        return date.toLocaleString();
    } catch (error) {
        return timestamp;
    }
}

/**
 * Show error message
 */
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

/**
 * Main function to load and display all data
 */
async function loadDashboard() {
    try {
        console.log('Loading FloodWatch dashboard...');
        
        const data = await fetchAllData();
        
        appState.riskData = data.riskData;
        appState.activeAlerts = data.activeAlerts;
        appState.alerts = data.alerts;
        appState.lastUpdated = data.timestamp;
        
        updateAlerts(data.alerts, data);
        updateZones(data.riskData);
        updateLastUpdated(data.timestamp);
        
        // Update map with animations
        updateMap(data.riskData);
        
        console.log('Dashboard loaded successfully!');
        console.log(`Model: ${data.model}`);
        console.log(`Found ${data.activeAlerts.length} active alerts`);
        console.log(`Monitoring ${data.riskData.length} zones`);
        
    } catch (error) {
        console.error('Failed to load dashboard:', error);
    }
}

/**
 * Refresh data from the API
 */
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

/**
 * Initialize the application when the DOM is ready
 */
function init() {
    console.log('Initializing FloodWatch...');
    
    // Initialize map
    initMap();
    
    // Check if the API is available
    fetchAPI('/')
        .then(data => {
            console.log('API Status:', data);
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
        lastUpdated: appState.lastUpdated
    };
}

// Make functions available globally
window.FloodWatch = {
    refreshData,
    getZoneById,
    getAlertsForZone,
    getZonesByRiskLevel,
    exportData
};

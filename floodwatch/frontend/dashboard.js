/**
 * FloodWatch - Hackathon Winning Dashboard (Final Version)
 * AI Powered Urban Flood Early Warning System
 */

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

let appState = {
    zones: [],
    riskData: [],
    alerts: [],
    activeAlerts: [],
    emergencyAlertLogs: [],
    smsSimulation: null,
    lastUpdated: null,
    selectedZone: null,
    viewMode: 'overview'
};

const API_BASE_URL = 'http://localhost:5000';

// =============================================================================
// ZONE COORDINATES
// =============================================================================

const zoneCoordinates = {
    "T Nagar": { lat: 13.0418, lng: 80.2341, zoom: 16 },
    "Velachery": { lat: 12.9791, lng: 80.2212, zoom: 15 },
    "Tambaram": { lat: 12.9249, lng: 80.1275, zoom: 14 },
    "Anna Nagar": { lat: 13.0850, lng: 80.2101, zoom: 15 },
    "Adyar": { lat: 13.0012, lng: 80.2565, zoom: 15 },
    "Perungudi": { lat: 12.9602, lng: 80.2460, zoom: 15 },
    "Pallavaram": { lat: 12.9675, lng: 80.1491, zoom: 14 },
    "Saidapet": { lat: 13.0214, lng: 80.2237, zoom: 16 }
};

// Chennai center coordinates
const CHENNAI_CENTER = { lat: 13.0827, lng: 80.2707 };
const CHENNAI_ZOOM = 12;

// =============================================================================
// LEAFLET MAP
// =============================================================================

let floodMap = null;
let floodMapDetail = null;
let mapCircles = [];

function initMap() {
    // Overview map
    const mapContainer = document.getElementById('flood-map');
    if (mapContainer) {
        floodMap = L.map('flood-map', {
            minZoom: 10,
            maxZoom: 19
        }).setView([CHENNAI_CENTER.lat, CHENNAI_CENTER.lng], CHENNAI_ZOOM);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap',
            maxZoom: 19
        }).addTo(floodMap);
    }
    
    // Detail map (hidden initially)
    const detailMapContainer = document.getElementById('flood-map-detail');
    if (detailMapContainer) {
        floodMapDetail = L.map('flood-map-detail', {
            minZoom: 10,
            maxZoom: 19,
            zoomControl: true
        }).setView([CHENNAI_CENTER.lat, CHENNAI_CENTER.lng], CHENNAI_ZOOM);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap',
            maxZoom: 19
        }).addTo(floodMapDetail);
    }
    
    console.log('Maps initialized');
}

function getCircleColor(probability) {
    if (probability >= 75) return '#ef4444';
    if (probability >= 60) return '#eab308';
    return '#22c55e';
}

function renderMapCircles(mapInstance, zones, highlightZoneId = null) {
    if (!mapInstance) return;
    
    // Clear existing circles
    mapCircles.forEach(circle => {
        if (circle && mapInstance) mapInstance.removeLayer(circle);
    });
    mapCircles = [];

    zones.forEach(zone => {
        const mapData = zone.map_data;
        if (!mapData) return;

        const fusion = zone.fusion_prediction || {};
        const probability = fusion.probability_percent || 0;
        const color = getCircleColor(probability);
        const isHighlighted = highlightZoneId && zone.id === highlightZoneId;
        
        const radius = isHighlighted ? (mapData.risk_radius_km || 0.5) * 1500 : (mapData.risk_radius_km || 0.5) * 1000;
        
        const circle = L.circle([mapData.center_lat, mapData.center_lng || mapData.center_lon], {
            color: color,
            fillColor: color,
            fillOpacity: isHighlighted ? 0.8 : (probability / 100),
            radius: radius,
            weight: isHighlighted ? 4 : 2
        }).addTo(mapInstance);

        const popupContent = `
            <div style="font-family: 'Inter', sans-serif; min-width: 180px;">
                <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
                    ${zone.name}
                </h4>
                <div style="font-size: 12px;">
                    <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                        <span style="color: #64748b;">Flood Probability:</span>
                        <span style="font-weight: 600; color: ${color};">${probability.toFixed(1)}%</span>
                    </div>
                </div>
            </div>
        `;
        
        circle.bindPopup(popupContent);
        mapCircles.push(circle);
    });
}

function zoomToZoneDetail(zoneName, riskLevel) {
    if (!floodMapDetail) return;
    
    const selected = zoneCoordinates[zoneName];
    if (!selected) return;
    
    // Set view to exact zone coordinates with zone-specific zoom
    floodMapDetail.setView([selected.lat, selected.lng], selected.zoom, {
        animate: true,
        duration: 0.5
    });
    
    // Restrict zoom - can zoom in but not out beyond selected zoom level
    floodMapDetail.setMinZoom(selected.zoom);
    floodMapDetail.setMaxZoom(19);
    
    // Enable zoom control
    floodMapDetail.zoomControl.enable();
    
    // Optional: For HIGH risk, disable dragging to keep focus
    if (riskLevel === 'HIGH') {
        floodMapDetail.dragging.disable();
    } else {
        floodMapDetail.dragging.enable();
    }
}

function resetToOverview() {
    if (!floodMapDetail) return;
    
    // Reset to Chennai overview
    floodMapDetail.setView([CHENNAI_CENTER.lat, CHENNAI_CENTER.lng], CHENNAI_ZOOM, {
        animate: true,
        duration: 0.5
    });
    
    // Reset zoom restrictions
    floodMapDetail.setMinZoom(12);
    floodMapDetail.setMaxZoom(19);
    
    // Re-enable dragging
    floodMapDetail.dragging.enable();
}

function invalidateMapSize(mapInstance) {
    if (mapInstance) {
        setTimeout(() => {
            mapInstance.invalidateSize({ animate: true });
        }, 300);
    }
}

// =============================================================================
// API
// =============================================================================

async function fetchAPI(endpoint) {
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

async function fetchAllData() {
    const data = await fetchAPI('/api/risk');
    if (!data) return null;
    
    console.log('API Response:', data);
    
    return {
        riskData: data.zones || [],
        activeAlerts: data.active_alerts || [],
        emergencyAlertLogs: data.emergency_alert_logs || [],
        smsSimulation: data.sms_simulation || null,
        timestamp: data.timestamp
    };
}

// =============================================================================
// UI RENDERING
// =============================================================================

function renderOverview() {
    const zonesSection = document.getElementById('zones-section');
    const mapSection = document.getElementById('map-section');
    const splitContainer = document.getElementById('split-container');
    
    zonesSection.style.display = 'block';
    mapSection.style.display = 'block';
    splitContainer.style.display = 'none';
    
    renderMapCircles(floodMap, appState.riskData);
    renderZoneCards();
    renderEmergencyAlerts();
    renderSMSDispatch();
}

function renderDetailView(zone) {
    const zonesSection = document.getElementById('zones-section');
    const mapSection = document.getElementById('map-section');
    const splitContainer = document.getElementById('split-container');
    
    zonesSection.style.display = 'none';
    mapSection.style.display = 'none';
    splitContainer.style.display = 'flex';
    
    renderZoneDetail(zone);
    
    if (floodMapDetail) {
        const fusion = zone.fusion_prediction || {};
        const probability = fusion.probability_percent || 0;
        const riskLevel = probability >= 75 ? 'HIGH' : (probability >= 60 ? 'MODERATE' : 'LOW');
        
        zoomToZoneDetail(zone.name, riskLevel);
        
        setTimeout(() => {
            renderMapCircles(floodMapDetail, appState.riskData, zone.id);
            invalidateMapSize(floodMapDetail);
        }, 350);
    }
}

function renderZoneCards() {
    const container = document.getElementById('zones-grid');
    container.innerHTML = '';
    
    appState.riskData.forEach(zone => {
        const fusion = zone.fusion_prediction || {};
        const probability = fusion.probability_percent || 0;
        const riskLevel = probability >= 75 ? 'HIGH' : (probability >= 60 ? 'MODERATE' : 'LOW');
        
        const color = getCircleColor(probability);
        
        const card = document.createElement('div');
        card.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 20px;
            cursor: pointer;
            transition: all 0.3s ease;
            border: 2px solid ${color}20;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        `;
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <div>
                    <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b;">${zone.name}</h3>
                    <span style="font-size: 12px; color: #64748b;">Chennai Zone</span>
                </div>
                <div style="width: 12px; height: 12px; border-radius: 50%; background: ${color}; box-shadow: 0 0 8px ${color};"></div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                <div>
                    <span style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Flood Probability</span>
                    <div style="font-size: 28px; font-weight: 700; color: ${color};">${probability.toFixed(0)}%</div>
                </div>
                <span style="padding: 6px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; background: ${color}15; color: ${color}; text-transform: uppercase;">${riskLevel}</span>
            </div>
        `;
        
        card.addEventListener('click', () => selectZone(zone));
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-4px)';
            card.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
        });
        
        container.appendChild(card);
    });
}

function renderZoneDetail(zone) {
    const detailPanel = document.getElementById('detail-panel');
    
    const fusion = zone.fusion_prediction || {};
    const sar = zone.sar_analysis || {};
    const geo = zone.geo_distress_analysis || {};
    
    const probability = fusion.probability_percent || 0;
    const confidence = fusion.confidence_percent || 0;
    const riskLevel = probability >= 75 ? 'HIGH' : (probability >= 60 ? 'MODERATE' : 'LOW');
    const color = getCircleColor(probability);
    
    const hasEmergency = appState.emergencyAlertLogs.some(log => log.zone_name === zone.name);
    const zoneSms = appState.smsSimulation && appState.smsSimulation.zone_name === zone.name ? appState.smsSimulation : null;
    
    // Get zone coordinates for display
    const zoneCoords = zoneCoordinates[zone.name];
    
    detailPanel.innerHTML = `
        <!-- Simple Close Button -->
        <button onclick="backToOverview()" style="
            position: absolute;
            top: 16px;
            left: 16px;
            z-index: 100;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: white;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            transition: all 0.2s;
        " onmouseover="this.style.background='#f1f5f9';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.2)';" onmouseout="this.style.background='white';this.style.boxShadow='0 2px 8px rgba(0,0,0,0.15)';">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>
        
        <div style="padding: 24px; padding-top: 60px;">
            <!-- Header -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;">
                <div>
                    <h2 style="margin: 0; font-size: 24px; font-weight: 700; color: #1e293b;">${zone.name}</h2>
                    <span style="color: #64748b;">Chennai Urban Zone</span>
                    ${zoneCoords ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">📍 ${zoneCoords.lat.toFixed(4)}, ${zoneCoords.lng.toFixed(4)}</div>` : ''}
                </div>
                <span style="padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; background: ${color}; color: white; ${probability >= 75 ? 'animation: pulse-red 2s infinite;' : ''}">${riskLevel} RISK</span>
            </div>
            
            <!-- Main Stats -->
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
                <div style="background: linear-gradient(135deg, ${color}10, ${color}05); border-radius: 12px; padding: 20px; border: 1px solid ${color}20;">
                    <span style="font-size: 12px; color: #64748b; text-transform: uppercase;">Flood Probability</span>
                    <div style="font-size: 36px; font-weight: 700; color: ${color};">${probability.toFixed(1)}%</div>
                </div>
                <div style="background: #f8fafc; border-radius: 12px; padding: 20px;">
                    <span style="font-size: 12px; color: #64748b; text-transform: uppercase;">Confidence</span>
                    <div style="font-size: 36px; font-weight: 700; color: #1e293b;">${confidence.toFixed(0)}%</div>
                </div>
            </div>
            
            <!-- SAR Section -->
            <div style="background: #f0f9ff; border-radius: 12px; padding: 20px; margin-bottom: 16px; border: 1px solid #bae6fd;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0369a1" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <circle cx="12" cy="12" r="6"></circle>
                        <circle cx="12" cy="12" r="2"></circle>
                    </svg>
                    <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #0369a1;">SAR Radar</h3>
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                    <div>
                        <span style="font-size: 11px; color: #64748b;">Surface Index</span>
                        <div style="font-size: 18px; font-weight: 600; color: #1e293b;">${(sar.surface_water_index || 0).toFixed(2)}</div>
                    </div>
                    <div>
                        <span style="font-size: 11px; color: #64748b;">Expansion</span>
                        <div style="font-size: 18px; font-weight: 600; color: #1e293b;">${(sar.water_expansion_rate_percent || 0).toFixed(1)}%</div>
                    </div>
                    <div>
                        <span style="font-size: 11px; color: #64748b;">Corridor</span>
                        <div style="font-size: 18px; font-weight: 600; color: ${sar.corridor_spread_detected ? '#ef4444' : '#22c55e'};">${sar.corridor_spread_detected ? 'Yes' : 'No'}</div>
                    </div>
                </div>
            </div>
            
            <!-- Geo Section -->
            <div style="background: #f5f3ff; border-radius: 12px; padding: 20px; margin-bottom: 16px; border: 1px solid #c4b5fd;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5b21b6" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #5b21b6;">Geo Clustering</h3>
                </div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                    <div>
                        <span style="font-size: 11px; color: #64748b;">Distress Spike</span>
                        <div style="font-size: 18px; font-weight: 600; color: ${geo.distress_spike_detected ? '#ef4444' : '#22c55e'};">${geo.distress_spike_detected ? 'DETECTED' : 'None'}</div>
                    </div>
                    <div>
                        <span style="font-size: 11px; color: #64748b;">Cluster Count</span>
                        <div style="font-size: 18px; font-weight: 600; color: #1e293b;">${geo.cluster_count || 0} posts</div>
                    </div>
                </div>
            </div>
            
            ${hasEmergency ? `
            <div style="background: linear-gradient(135deg, #fee2e2, #fecaca); border-radius: 12px; padding: 20px; margin-bottom: 16px; border: 2px solid #ef4444; animation: pulse-red 2s infinite;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                    <span style="font-size: 20px;">🚨</span>
                    <h3 style="margin: 0; font-size: 14px; font-weight: 700; color: #dc2626; text-transform: uppercase;">Emergency Alert</h3>
                </div>
                <p style="margin: 0; color: #991b1b; font-size: 13px;">SMS dispatch triggered</p>
            </div>
            ` : ''}
            
            ${zoneSms ? `
            <div style="background: linear-gradient(135deg, #fff7ed, #ffedd5); border-radius: 12px; padding: 20px; border: 2px solid #f97316;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                    <span style="font-size: 20px;">📱</span>
                    <h3 style="margin: 0; font-size: 14px; font-weight: 700; color: #c2410c; text-transform: uppercase;">SMS Dispatch</h3>
                </div>
                <div style="font-size: 12px; color: #7c2d12;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>Recipients:</span>
                        <strong>${zoneSms.recipients_notified.toLocaleString()}</strong>
                    </div>
                    <div style="background: white; padding: 10px; border-radius: 6px; margin-top: 10px; font-size: 11px;">
                        ${zoneSms.message}
                    </div>
                </div>
            </div>
            ` : ''}
        </div>
    `;
}

function renderEmergencyAlerts() {
    const section = document.getElementById('emergency-console-section');
    const container = document.getElementById('emergency-alerts-container');
    
    if (!section || !container) return;
    
    container.innerHTML = '';
    
    if (appState.emergencyAlertLogs.length === 0) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    
    appState.emergencyAlertLogs.forEach(log => {
        const card = document.createElement('div');
        card.style.cssText = `
            background: linear-gradient(135deg, #fee2e2, #fecaca);
            border: 2px solid #ef4444;
            border-radius: 12px;
            padding: 16px;
            animation: pulse-red 2s infinite;
        `;
        
        card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 24px;">🚨</span>
                <div>
                    <h4 style="margin: 0; font-size: 14px; font-weight: 700; color: #dc2626;">${log.zone_name} - ${log.flood_probability}%</h4>
                    <span style="font-size: 12px; color: #991b1b;">${log.lead_time} • ${log.alert_level}</span>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

function renderSMSDispatch() {
    const section = document.getElementById('sms-dispatch-section');
    const container = document.getElementById('sms-dispatch-container');
    
    if (!section || !container) return;
    
    container.innerHTML = '';
    
    if (!appState.smsSimulation) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    
    const sms = appState.smsSimulation;
    const card = document.createElement('div');
    card.style.cssText = `
        background: linear-gradient(135deg, #fff7ed, #ffedd5);
        border: 2px solid #f97316;
        border-radius: 12px;
        padding: 16px;
    `;
    
    card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px;">📱</span>
            <div>
                <h4 style="margin: 0; font-size: 14px; font-weight: 700; color: #c2410c;">${sms.zone_name} - ${sms.recipients_notified.toLocaleString()} notified</h4>
                <span style="font-size: 12px; color: #9a3412;">Status: ${sms.status}</span>
            </div>
        </div>
    `;
    
    container.appendChild(card);
}

// =============================================================================
// INTERACTIONS
// =============================================================================

function selectZone(zone) {
    if (appState.selectedZone && appState.selectedZone.id === zone.id && appState.viewMode === 'detail') {
        return;
    }
    
    appState.selectedZone = zone;
    appState.viewMode = 'detail';
    renderDetailView(zone);
}

function backToOverview() {
    appState.selectedZone = null;
    appState.viewMode = 'overview';
    
    // Reset map to overview
    resetToOverview();
    
    renderOverview();
    invalidateMapSize(floodMap);
}

// =============================================================================
// INITIALIZATION
// =============================================================================

async function init() {
    console.log('Initializing FloodWatch Dashboard...');
    
    initMap();
    await loadDashboard();
    setInterval(loadDashboard, 5000);
}

async function loadDashboard() {
    console.log('Loading dashboard...');
    
    const data = await fetchAllData();
    if (!data) {
        console.error('Failed to load data');
        return;
    }
    
    appState.riskData = data.riskData;
    appState.activeAlerts = data.activeAlerts;
    appState.emergencyAlertLogs = data.emergencyAlertLogs;
    appState.smsSimulation = data.smsSimulation;
    appState.lastUpdated = data.timestamp;
    
    if (appState.viewMode === 'overview') {
        renderOverview();
    } else if (appState.selectedZone) {
        const updatedZone = appState.riskData.find(z => z.id === appState.selectedZone.id);
        if (updatedZone) {
            appState.selectedZone = updatedZone;
            renderZoneDetail(updatedZone);
            if (floodMapDetail) {
                const fusion = updatedZone.fusion_prediction || {};
                const probability = fusion.probability_percent || 0;
                const riskLevel = probability >= 75 ? 'HIGH' : (probability >= 60 ? 'MODERATE' : 'LOW');
                
                setTimeout(() => {
                    zoomToZoneDetail(updatedZone.name, riskLevel);
                    renderMapCircles(floodMapDetail, appState.riskData, updatedZone.id);
                    invalidateMapSize(floodMapDetail);
                }, 100);
            }
        }
    }
    
    const lastUpdatedEl = document.getElementById('last-updated');
    if (lastUpdatedEl) {
        lastUpdatedEl.textContent = new Date().toLocaleString();
    }
    
    console.log('Dashboard loaded!', appState.riskData.length, 'zones');
}

document.addEventListener('DOMContentLoaded', init);

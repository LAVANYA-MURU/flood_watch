/**
 * AI Control Panel - Fusion Intelligence Dashboard
 * Integrates with POST /api/flood-risk endpoint
 */

class AIControlPanel {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.options = {
            apiEndpoint: options.apiEndpoint || '/api/flood-risk',
            refreshInterval: options.refreshInterval || 5000,
            autoRefresh: options.autoRefresh || false,
            mockValues: options.mockValues || {
                sar_score: 0.8,
                distress_score: 0.6,
                previous_probability: 0.65
            },
            ...options
        };
        
        this.autoRefreshTimer = null;
        this.init();
    }

    init() {
        this.render();
        this.bindEvents();
        if (this.options.autoRefresh) {
            this.enableAutoRefresh();
        }
        this.fetchData();
    }

    render() {
        this.container.innerHTML = `
            <div class="ai-control-panel">
                <div class="ai-panel-header">
                    <div class="ai-panel-title">
                        <h2>AI Fusion Intelligence</h2>
                        <span class="ai-badge">Live</span>
                    </div>
                    <div class="auto-refresh-toggle">
                        <label for="auto-refresh-switch">Auto-Refresh</label>
                        <label class="toggle-switch">
                            <input type="checkbox" id="auto-refresh-switch" ${this.options.autoRefresh ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
                
                <div class="ai-cards-grid">
                    <!-- Card 1: Flood Probability -->
                    <div class="ai-card probability-card">
                        <div class="card-label">Flood Probability</div>
                        <div class="probability-value" id="probability-value">--%</div>
                        <div class="progress-bar-container">
                            <div class="progress-bar" id="probability-progress" style="width: 0%"></div>
                        </div>
                    </div>
                    
                    <!-- Card 2: Risk Level -->
                    <div class="ai-card risk-card">
                        <div class="card-label">Risk Level</div>
                        <div class="risk-value" id="risk-value">---</div>
                    </div>
                    
                    <!-- Card 3: Confidence Score -->
                    <div class="ai-card confidence-card">
                        <div class="card-label">
                            Confidence Score
                            <span class="tooltip">
                                <span class="info-icon">?</span>
                                <span class="tooltip-text">Agreement between SAR satellite & distress signal analysis</span>
                            </span>
                        </div>
                        <div class="confidence-value" id="confidence-value">--%</div>
                        <div class="confidence-description">Signal Agreement</div>
                    </div>
                    
                    <!-- Card 4: Trend Indicator -->
                    <div class="ai-card trend-card">
                        <div class="card-label">Trend</div>
                        <div class="trend-icon" id="trend-icon">→</div>
                        <div class="trend-text" id="trend-text">STABLE</div>
                    </div>
                </div>
                
                <!-- T+15 MIN FLOOD FORECAST Card -->
                <div class="forecast-card" id="forecast-card">
                    <div class="forecast-header">
                        <div class="forecast-title">T+15 MIN FLOOD FORECAST</div>
                        <div class="forecast-subtitle">Short-term AI extrapolation (15-minute lead time)</div>
                    </div>
                    <div class="forecast-content">
                        <div class="forecast-main">
                            <div class="forecast-probability" id="forecast-probability">--%</div>
                            <div class="forecast-risk" id="forecast-risk">---</div>
                        </div>
                        <div class="forecast-indicator">
                            <span class="forecast-arrow" id="forecast-arrow">→</span>
                            <span class="forecast-status" id="forecast-status">Stable</span>
                        </div>
                    </div>
                </div>
                
                <!-- Input Values Section -->
                <div class="input-values-section">
                    <div class="input-values-title">Input Values (for testing)</div>
                    <div class="input-grid">
                        <div class="input-field">
                            <label for="sar-score-input">SAR Score (0-1)</label>
                            <input type="number" id="sar-score-input" 
                                   min="0" max="1" step="0.1" 
                                   value="${this.options.mockValues.sar_score}"
                                   placeholder="0.0 - 1.0">
                        </div>
                        <div class="input-field">
                            <label for="distress-score-input">Distress Score (0-1)</label>
                            <input type="number" id="distress-score-input" 
                                   min="0" max="1" step="0.1" 
                                   value="${this.options.mockValues.distress_score}"
                                   placeholder="0.0 - 1.0">
                        </div>
                        <div class="input-field">
                            <label for="previous-prob-input">Previous Probability (0-1)</label>
                            <input type="number" id="previous-prob-input" 
                                   min="0" max="1" step="0.1" 
                                   value="${this.options.mockValues.previous_probability}"
                                   placeholder="Optional">
                        </div>
                    </div>
                </div>
                
                <div class="ai-panel-timestamp">
                    Last Updated: <span id="timestamp">--:--:--</span>
                </div>
                
                <div id="ai-panel-status"></div>
            </div>
        `;
    }

    bindEvents() {
        // Auto-refresh toggle
        const toggle = document.getElementById('auto-refresh-switch');
        if (toggle) {
            toggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.enableAutoRefresh();
                } else {
                    this.disableAutoRefresh();
                }
            });
        }

        // Input change handlers - fetch data when inputs change
        const sarInput = document.getElementById('sar-score-input');
        const distressInput = document.getElementById('distress-score-input');
        const prevInput = document.getElementById('previous-prob-input');

        if (sarInput) {
            sarInput.addEventListener('change', () => this.fetchData());
            sarInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.fetchData();
            });
        }
        if (distressInput) {
            distressInput.addEventListener('change', () => this.fetchData());
            distressInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.fetchData();
            });
        }
        if (prevInput) {
            prevInput.addEventListener('change', () => this.fetchData());
            prevInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.fetchData();
            });
        }
    }

    getInputValues() {
        const sarScore = parseFloat(document.getElementById('sar-score-input')?.value) || 0;
        const distressScore = parseFloat(document.getElementById('distress-score-input')?.value) || 0;
        const prevProbInput = document.getElementById('previous-prob-input')?.value;
        
        const requestData = {
            sar_score: Math.max(0, Math.min(1, sarScore)),
            distress_score: Math.max(0, Math.min(1, distressScore))
        };
        
        // Only include previous_probability if it's not empty
        if (prevProbInput !== '' && prevProbInput !== null) {
            requestData.previous_probability = Math.max(0, Math.min(1, parseFloat(prevProbInput)));
        }
        
        return requestData;
    }

    async fetchData() {
        const statusEl = document.getElementById('ai-panel-status');
        
        try {
            // Show loading state
            if (statusEl) {
                statusEl.innerHTML = `
                    <div class="ai-panel-loading">
                        <div class="loading-spinner"></div>
                    </div>
                `;
            }

            const inputData = this.getInputValues();
            
            const response = await fetch(this.options.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(inputData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                this.updateDisplay(result.result);
            } else {
                throw new Error(result.error || 'Unknown error');
            }

        } catch (error) {
            console.error('Error fetching flood risk data:', error);
            if (statusEl) {
                statusEl.innerHTML = `
                    <div class="ai-panel-error">
                        Error: ${error.message}
                    </div>
                `;
            }
        }
    }

    updateDisplay(data) {
        const probabilityValue = document.getElementById('probability-value');
        const probabilityProgress = document.getElementById('probability-progress');
        const riskValue = document.getElementById('risk-value');
        const confidenceValue = document.getElementById('confidence-value');
        const trendIcon = document.getElementById('trend-icon');
        const trendText = document.getElementById('trend-text');
        const timestamp = document.getElementById('timestamp');
        const statusEl = document.getElementById('ai-panel-status');

        // Update probability
        if (probabilityValue && probabilityProgress) {
            const prob = (data.flood_probability * 100).toFixed(0);
            probabilityValue.textContent = `${prob}%`;
            probabilityProgress.style.width = `${prob}%`;
            
            // Remove old classes and add new
            probabilityValue.classList.remove('high', 'moderate', 'low');
            probabilityProgress.classList.remove('high', 'moderate', 'low');
            
            const riskClass = data.risk_level.toLowerCase();
            probabilityValue.classList.add(riskClass);
            probabilityProgress.classList.add(riskClass);
        }

        // Update risk level
        if (riskValue) {
            riskValue.textContent = data.risk_level;
            riskValue.classList.remove('high', 'moderate', 'low');
            riskValue.classList.add(data.risk_level.toLowerCase());
        }

        // Update confidence
        if (confidenceValue) {
            const conf = (data.confidence_score * 100).toFixed(0);
            confidenceValue.textContent = `${conf}%`;
        }

        // Update trend
        if (trendIcon && trendText) {
            const trend = data.trend;
            trendText.textContent = trend;
            
            trendIcon.classList.remove('rising', 'falling', 'stable');
            trendText.classList.remove('rising', 'falling', 'stable');
            
            trendIcon.classList.add(trend.toLowerCase());
            trendText.classList.add(trend.toLowerCase());
            
            // Update arrow icon
            if (trend === 'RISING') {
                trendIcon.textContent = '↑';
            } else if (trend === 'FALLING') {
                trendIcon.textContent = '↓';
            } else {
                trendIcon.textContent = '→';
            }
        }

        // Update timestamp
        if (timestamp) {
            const now = new Date();
            timestamp.textContent = now.toLocaleTimeString('en-US', { 
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }

        // Clear loading/error state
        if (statusEl) {
            statusEl.innerHTML = '';
        }
        
        // Update T+15 MIN Forecast Card
        this.updateForecastDisplay(data);
    }

    updateForecastDisplay(data) {
        const forecastCard = document.getElementById('forecast-card');
        const forecastProbability = document.getElementById('forecast-probability');
        const forecastRisk = document.getElementById('forecast-risk');
        const forecastArrow = document.getElementById('forecast-arrow');
        const forecastStatus = document.getElementById('forecast-status');
        
        if (forecastProbability) {
            forecastProbability.textContent = (data.predicted_15min_probability * 100).toFixed(0) + '%';
        }
        
        if (forecastRisk) {
            forecastRisk.textContent = data.predicted_risk_level;
            forecastRisk.className = 'forecast-risk ' + data.predicted_risk_level.toLowerCase();
        }
        
        if (forecastCard) {
            forecastCard.className = 'forecast-card ' + data.predicted_risk_level.toLowerCase();
            if (data.predicted_risk_level === 'HIGH') {
                forecastCard.classList.add('pulse-animation');
            }
        }
        
        if (forecastArrow && forecastStatus) {
            const diff = data.predicted_15min_probability - data.flood_probability;
            if (diff > 0.001) {
                forecastArrow.textContent = '↑';
                forecastStatus.textContent = 'Escalating';
            } else if (diff < -0.001) {
                forecastArrow.textContent = '↓';
                forecastStatus.textContent = 'Decreasing';
            } else {
                forecastArrow.textContent = '→';
                forecastStatus.textContent = 'Stable';
            }
        }
    }

    enableAutoRefresh() {
        this.disableAutoRefresh(); // Clear any existing timer
        this.autoRefreshTimer = setInterval(() => {
            this.fetchData();
        }, this.options.refreshInterval);
        
        const toggle = document.getElementById('auto-refresh-switch');
        if (toggle) toggle.checked = true;
    }

    disableAutoRefresh() {
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer);
            this.autoRefreshTimer = null;
        }
        
        const toggle = document.getElementById('auto-refresh-switch');
        if (toggle) toggle.checked = false;
    }

    // Public method to manually refresh data
    refresh() {
        this.fetchData();
    }

    // Update mock values programmatically
    setMockValues(values) {
        const sarInput = document.getElementById('sar-score-input');
        const distressInput = document.getElementById('distress-score-input');
        const prevInput = document.getElementById('previous-prob-input');

        if (sarInput && values.sar_score !== undefined) {
            sarInput.value = values.sar_score;
        }
        if (distressInput && values.distress_score !== undefined) {
            distressInput.value = values.distress_score;
        }
        if (prevInput && values.previous_probability !== undefined) {
            prevInput.value = values.previous_probability;
        }
        
        this.fetchData();
    }

    // Destroy the control panel instance
    destroy() {
        this.disableAutoRefresh();
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

// Auto-initialize if data attribute is present
document.addEventListener('DOMContentLoaded', function() {
    const panelContainer = document.getElementById('ai-control-panel');
    if (panelContainer) {
        window.aiControlPanel = new AIControlPanel('ai-control-panel', {
            autoRefresh: true,
            mockValues: {
                sar_score: 0.85,
                distress_score: 0.75,
                previous_probability: 0.70
            }
        });
    }
});

// Export for manual initialization
window.AIControlPanel = AIControlPanel;

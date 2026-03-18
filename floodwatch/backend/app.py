"""
FloodWatch Backend API
AI Powered Urban Flood Early Warning System

This module provides the Flask API for flood risk prediction.
It uses a hybrid multimodal flood risk fusion model combining:
- Rainfall intensity
- Social distress reports
- Water level measurements
- SAR satellite radar data
- Geo-radius clustering detection
"""

from flask import Flask, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from datetime import datetime
import random

# Import SAR processor module
from sar_processor import generate_sar_data

# Import Geo-Distress processor module
from geo_distress_processor import generate_geo_distress_data

# Import Multi-Modal AI Fusion Engine
from flood_fusion_engine import fuse_signals, validate_input, predict_15min

# Initialize Flask app
app = Flask(__name__)

# Enable CORS (Cross-Origin Resource Sharing) for frontend-backend communication
CORS(app)

# =============================================================================
# EMERGENCY ALERT SIMULATION MODULE
# =============================================================================

# Global storage for emergency alert logs and SMS simulation
emergency_alert_logs = []
sms_simulation = None

def trigger_emergency_alert(zone_name, flood_probability, confidence_percent, lead_time_minutes):
    """
    Trigger an emergency alert simulation when flood probability >= 75%.
    
    Args:
        zone_name: Name of the zone
        flood_probability: Flood probability percentage
        confidence_percent: Model confidence percentage
        lead_time_minutes: Lead time in minutes
    
    Returns:
        dict: Emergency alert log entry
    """
    global emergency_alert_logs, sms_simulation
    
    current_time = datetime.now().isoformat()
    
    # A) Console Log Simulation
    console_message = f"""
==============================
EMERGENCY FLOOD ALERT TRIGGERED
Zone: {zone_name}
Flood Probability: {flood_probability}%
Confidence: {confidence_percent}%
Lead Time: {lead_time_minutes} minutes
Timestamp: {current_time}
=============================="""
    print(console_message)
    
    # B) Create structured alert log entry
    alert_entry = {
        "zone_name": zone_name,
        "flood_probability": flood_probability,
        "confidence_percent": confidence_percent,
        "lead_time": f"{lead_time_minutes} minutes",
        "alert_level": "HIGH",
        "timestamp": current_time
    }
    
    emergency_alert_logs.append(alert_entry)
    
    # C) SMS Dispatch Simulation
    recipients_count = random.randint(1000, 5000)
    
    sms_message = f"Flood Alert for {zone_name}. High flood probability ({flood_probability}%). Expected within 15 minutes. Please take precautionary measures."
    
    sms_simulation = {
        "zone_name": zone_name,
        "message": sms_message,
        "recipients_notified": recipients_count,
        "status": "DISPATCHED",
        "timestamp": current_time
    }
    
    print(f"SMS Dispatched: {recipients_count} recipients notified for {zone_name}")
    
    return alert_entry

# =============================================================================
# MOCK DATA - Simulating real-time rainfall and social media reports
# =============================================================================

def get_mock_zone_data():
    """Returns mock data for Chennai city zones with geographic coordinates."""
    return [
        {"id": 1, "name": "T Nagar", "rainfall_mm": 65.5, "social_reports": 5, "water_level_m": 2.1, "latitude": 13.0418, "longitude": 80.2341, "last_updated": datetime.now().isoformat()},
        {"id": 2, "name": "Velachery", "rainfall_mm": 48.2, "social_reports": 4, "water_level_m": 3.5, "latitude": 12.9759, "longitude": 80.2209, "last_updated": datetime.now().isoformat()},
        {"id": 3, "name": "Tambaram", "rainfall_mm": 35.0, "social_reports": 2, "water_level_m": 1.8, "latitude": 12.9249, "longitude": 80.1000, "last_updated": datetime.now().isoformat()},
        {"id": 4, "name": "Anna Nagar", "rainfall_mm": 28.5, "social_reports": 1, "water_level_m": 0.9, "latitude": 13.0878, "longitude": 80.2170, "last_updated": datetime.now().isoformat()},
        {"id": 5, "name": "Adyar", "rainfall_mm": 15.0, "social_reports": 0, "water_level_m": 0.5, "latitude": 13.0067, "longitude": 80.2572, "last_updated": datetime.now().isoformat()},
        {"id": 6, "name": "Perungudi", "rainfall_mm": 42.0, "social_reports": 3, "water_level_m": 2.0, "latitude": 12.9635, "longitude": 80.2411, "last_updated": datetime.now().isoformat()},
        {"id": 7, "name": "Pallavaram", "rainfall_mm": 55.0, "social_reports": 4, "water_level_m": 2.3, "latitude": 12.9675, "longitude": 80.1500, "last_updated": datetime.now().isoformat()},
        {"id": 8, "name": "Saidapet", "rainfall_mm": 38.0, "social_reports": 2, "water_level_m": 1.5, "latitude": 13.0237, "longitude": 80.2206, "last_updated": datetime.now().isoformat()}
    ]

# =============================================================================
# FLOOD RISK PREDICTION LOGIC
# =============================================================================

def calculate_flood_risk(rainfall_mm, social_reports):
    """Calculate flood risk level based on rainfall and citizen reports."""
    if rainfall_mm > 50 and social_reports > 3:
        return "High"
    elif rainfall_mm > 30:
        return "Medium"
    else:
        return "Low"

def calculate_fusion_risk(rainfall_mm, social_reports, water_level_m, sar_data, geo_distress_data):
    """
    Calculate flood risk using Hybrid Multimodal Flood Risk Fusion Model.
    Now includes Geo-Radius Clustering Detection.
    """
    rainfall_norm = min(rainfall_mm / 80, 1.0)
    social_norm = min(social_reports / 10, 1.0)
    water_norm = min(water_level_m / 5, 1.0)
    sar_norm = sar_data.get("surface_water_index", 0.0)
    
    base_score = (0.25 * rainfall_norm + 0.15 * social_norm + 0.15 * water_norm + 0.45 * sar_norm)
    probability_percent = base_score * 100
    
    if sar_norm < 0.35:
        probability_percent = min(probability_percent, 55)
    elif sar_norm > 0.75:
        probability_percent = max(probability_percent, 70)
    
    expansion = sar_data.get("water_expansion_rate_percent", 0)
    if expansion > 15:
        probability_percent += 10
    elif expansion > 8:
        probability_percent += 5
    elif expansion < -5:
        probability_percent -= 8
    
    # Geo-distress spike detection - increases probability by +7%
    geo_analysis = geo_distress_data.get("geo_distress_analysis", {})
    distress_spike = geo_analysis.get("distress_spike_detected", False)
    if distress_spike:
        probability_percent += 7
        # Increase confidence by +3%
    
    # Clamp probability to max 100
    probability_percent = max(0, min(100, probability_percent))
    
    if probability_percent > 85:
        risk_label = "High"
    elif probability_percent > 60:
        risk_label = "Medium"
    else:
        risk_label = "Low"
    
    lead_time_minutes = 15
    agreement_score = (abs(rainfall_norm - sar_norm) + abs(social_norm - sar_norm))
    confidence_percent = max(75, min(95 - (agreement_score * 20), 95))
    
    # Add +3% confidence if distress spike detected
    if distress_spike:
        confidence_percent = min(98, confidence_percent + 3)
    
    return {
        "probability_percent": round(probability_percent, 2),
        "risk_label": risk_label,
        "lead_time_minutes": lead_time_minutes,
        "confidence_percent": round(confidence_percent, 2),
        "distress_spike_detected": distress_spike
    }

def get_risk_color(risk_level):
    colors = {"Low": "#22c55e", "Medium": "#eab308", "High": "#ef4444"}
    return colors.get(risk_level, "#22c55e")

def get_risk_description(risk_level, rainfall_mm, social_reports):
    descriptions = {
        "Low": "No significant flooding expected.",
        "Medium": "Moderate flood risk. Avoid low-lying areas.",
        "High": "URGENT: High flood risk detected!"
    }
    return descriptions.get(risk_level, "")

def get_fusion_description(probability_percent, risk_label, distress_spike=False, cluster_count=0):
    base_desc = ""
    if risk_label == "High":
        base_desc = f"CRITICAL: {probability_percent}% probability of flooding."
    elif risk_label == "Medium":
        base_desc = f"WARNING: {probability_percent}% probability of flooding."
    else:
        base_desc = f"MONITORING: {probability_percent}% probability. Conditions stable."
    
    # Add SOS spike info if detected
    if distress_spike and cluster_count > 0:
        base_desc += f" SOS Signal Spike: {cluster_count} flood-related distress posts detected within 1.2 km radius."
    
    return base_desc

def generate_map_data(zone, sar_data, probability_percent):
    """
    Generate map visualization data for a zone.
    
    Args:
        zone (dict): Zone data including latitude and longitude
        sar_data (dict): SAR analysis data including surface_water_index and water_expansion_rate_percent
        probability_percent (float): Flood probability percentage
        
    Returns:
        dict: Map data containing center coordinates, risk radius, color, and heat intensity
    """
    # Get coordinates from zone
    center_lat = zone.get("latitude", 0.0)
    center_lon = zone.get("longitude", 0.0)
    
    # Get SAR data values
    water_expansion_rate = sar_data.get("water_expansion_rate_percent", 0)
    surface_water_index = sar_data.get("surface_water_index", 0.0)
    
    # Calculate risk_radius_km
    # Base radius = 0.5 km
    # If expansion > 10% → increase radius by 0.3 km
    # If expansion > 20% → increase radius by 0.5 km (cumulative)
    risk_radius_km = 0.5
    
    if water_expansion_rate > 20:
        risk_radius_km += 0.5  # 1.0 km total
    elif water_expansion_rate > 10:
        risk_radius_km += 0.3  # 0.8 km total
    
    # Additional expansion based on surface_water_index
    if surface_water_index > 0.7:
        risk_radius_km += 0.2
    elif surface_water_index > 0.5:
        risk_radius_km += 0.1
    
    # Determine risk_color based on probability
    # Green if probability < 60
    # Orange if 60-74
    # Red if >= 75
    if probability_percent >= 75:
        risk_color = "red"
    elif probability_percent >= 60:
        risk_color = "orange"
    else:
        risk_color = "green"
    
    # Calculate heat_intensity (probability / 100)
    heat_intensity = probability_percent / 100.0
    
    return {
        "center_lat": center_lat,
        "center_lon": center_lon,
        "risk_radius_km": round(risk_radius_km, 2),
        "risk_color": risk_color,
        "heat_intensity": round(heat_intensity, 3)
    }

# =============================================================================
# API ROUTES
# =============================================================================

@app.route('/')
def index():
    return jsonify({
        "name": "FloodWatch API",
        "version": "1.0.0",
        "description": "AI Powered Urban Flood Early Warning System",
        "status": "Running"
    })

@app.route('/api/zones', methods=['GET'])
def get_zones():
    zones = get_mock_zone_data()
    zones_response = [{"id": z["id"], "name": z["name"], "last_updated": z["last_updated"]} for z in zones]
    return jsonify({"success": True, "count": len(zones_response), "zones": zones_response})

@app.route('/api/risk', methods=['GET'])
def get_risk():
    global emergency_alert_logs, sms_simulation
    
    # Clear previous emergency alerts and SMS for fresh calculation
    emergency_alert_logs = []
    sms_simulation = None
    
    zones = get_mock_zone_data()
    risk_data = []
    active_alerts = []
    
    for zone in zones:
        # Generate SAR data
        sar_data = generate_sar_data(zone["name"])
        
        # Generate Geo-Distress data
        geo_distress_data = generate_geo_distress_data(zone["name"])
        
        # Calculate fusion risk with geo-distress integration
        fusion_result = calculate_fusion_risk(
            zone["rainfall_mm"], 
            zone["social_reports"], 
            zone["water_level_m"], 
            sar_data,
            geo_distress_data
        )
        
        # Get geo-distress analysis
        geo_analysis = geo_distress_data.get("geo_distress_analysis", {})
        distress_spike = geo_analysis.get("distress_spike_detected", False)
        cluster_count = geo_analysis.get("cluster_count", 0)
        cluster_center = geo_analysis.get("cluster_center", None)
        
        # =====================================================================
        # Demo override for hackathon presentation – force high risk zone
        # =====================================================================
        if zone["name"] == "Velachery":
            # Force minimum 85% flood probability for Velachery
            fusion_result["probability_percent"] = max(fusion_result["probability_percent"], 85)
            # Force minimum 90% confidence for Velachery
            fusion_result["confidence_percent"] = max(fusion_result["confidence_percent"], 90)
            # Force HIGH risk label
            fusion_result["risk_label"] = "High"
            # Force distress spike detected for demo
            distress_spike = True
            cluster_count = 5
            fusion_result["distress_spike_detected"] = True
        # =====================================================================
        
        risk_level = fusion_result["risk_label"]
        
        zone_risk = {
            "id": zone["id"],
            "name": zone["name"],
            "risk_level": risk_level,
            "risk_color": get_risk_color(risk_level),
            "description": get_fusion_description(
                fusion_result["probability_percent"], 
                risk_level,
                distress_spike,
                cluster_count
            ),
            "data": {
                "rainfall_mm": zone["rainfall_mm"],
                "social_reports": zone["social_reports"],
                "water_level_m": zone["water_level_m"]
            },
            "sar_analysis": {
                "surface_water_index": sar_data["surface_water_index"],
                "water_expansion_rate_percent": sar_data["water_expansion_rate_percent"],
                "corridor_spread_detected": sar_data["corridor_spread_detected"]
            },
            "geo_distress_analysis": {
                "distress_spike_detected": distress_spike,
                "cluster_count": cluster_count,
                "cluster_radius_km": 1.2,
                "cluster_center": cluster_center
            },
            "fusion_prediction": {
                "probability_percent": fusion_result["probability_percent"],
                "lead_time_minutes": fusion_result["lead_time_minutes"],
                "confidence_percent": fusion_result["confidence_percent"],
                "distress_spike_detected": distress_spike
            },
            "prediction": {
                "time_horizon_minutes": str(fusion_result["lead_time_minutes"]),
                "model_type": "fusion_multimodal_geo",
                "confidence": f"{fusion_result['confidence_percent']}%"
            },
            "map_data": generate_map_data(zone, sar_data, fusion_result["probability_percent"]),
            "last_updated": zone["last_updated"]
        }
        risk_data.append(zone_risk)
        
        # Add to active_alerts based on probability
        probability = fusion_result["probability_percent"]
        sos_spike_msg = ""
        if distress_spike:
            sos_spike_msg = f" SOS Signal Spike: {cluster_count} flood-related distress posts detected within 1.2 km radius."
        
        if probability >= 75:
            active_alerts.append({
                "zone_name": zone["name"],
                "flood_probability": probability,
                "confidence_percent": fusion_result["confidence_percent"],
                "lead_time": fusion_result["lead_time_minutes"],
                "distress_post_count": zone["social_reports"],
                "alert_level": "HIGH",
                "sos_spike_detected": distress_spike,
                "sos_spike_message": sos_spike_msg if distress_spike else ""
            })
            
            # Trigger Emergency Alert Simulation
            trigger_emergency_alert(
                zone["name"],
                probability,
                fusion_result["confidence_percent"],
                fusion_result["lead_time_minutes"]
            )
        elif probability >= 60:
            active_alerts.append({
                "zone_name": zone["name"],
                "flood_probability": probability,
                "confidence_percent": fusion_result["confidence_percent"],
                "lead_time": fusion_result["lead_time_minutes"],
                "distress_post_count": zone["social_reports"],
                "alert_level": "MEDIUM",
                "sos_spike_detected": distress_spike,
                "sos_spike_message": sos_spike_msg if distress_spike else ""
            })
    
    return jsonify({
        "success": True,
        "count": len(risk_data),
        "timestamp": datetime.now().isoformat(),
        "model": "Hybrid Multimodal Flood Risk Fusion + Geo-Clustering",
        "zones": risk_data,
        "active_alerts": active_alerts,
        "emergency_alert_logs": emergency_alert_logs,
        "sms_simulation": sms_simulation
    })

@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    zones = get_mock_zone_data()
    alerts = []
    
    for zone in zones:
        sar_data = generate_sar_data(zone["name"])
        geo_distress_data = generate_geo_distress_data(zone["name"])
        fusion_result = calculate_fusion_risk(zone["rainfall_mm"], zone["social_reports"], zone["water_level_m"], sar_data, geo_distress_data)
        
        geo_analysis = geo_distress_data.get("geo_distress_analysis", {})
        distress_spike = geo_analysis.get("distress_spike_detected", False)
        cluster_count = geo_analysis.get("cluster_count", 0)
        
        if fusion_result["risk_label"] == "High":
            sos_msg = ""
            if distress_spike:
                sos_msg = f" SOS Signal Spike: {cluster_count} flood-related distress posts detected within 1.2 km radius."
            alert = {
                "id": f"ALERT-{zone['id']}",
                "zone_id": zone["id"],
                "zone_name": zone["name"],
                "severity": "High",
                "message": f"Flood warning: {zone['name']} is at HIGH risk. Probability: {fusion_result['probability_percent']}%.{sos_msg}",
                "recommendation": "Evacuate low-lying areas immediately.",
                "timestamp": zone["last_updated"],
                "sos_spike_detected": distress_spike
            }
            alerts.append(alert)
    
    return jsonify({"success": True, "count": len(alerts), "timestamp": datetime.now().isoformat(), "alerts": alerts})

@app.route('/api/data/features', methods=['GET'])
def get_features():
    zones = get_mock_zone_data()
    features = []
    
    for zone in zones:
        sar_data = generate_sar_data(zone["name"])
        geo_distress_data = generate_geo_distress_data(zone["name"])
        geo_analysis = geo_distress_data.get("geo_distress_analysis", {})
        
        feature_vector = {
            "zone_id": zone["id"],
            "rainfall_normalized": min(zone["rainfall_mm"] / 80, 1.0),
            "social_reports_normalized": min(zone["social_reports"] / 10, 1.0),
            "water_level_normalized": min(zone["water_level_m"] / 5, 1.0),
            "sar_surface_water_index": sar_data["surface_water_index"],
            "sar_expansion_rate": sar_data["water_expansion_rate_percent"],
            "geo_distress_spike": geo_analysis.get("distress_spike_detected", False),
            "geo_cluster_count": geo_analysis.get("cluster_count", 0),
            "rainfall_mm": zone["rainfall_mm"],
            "social_reports": zone["social_reports"],
            "water_level_m": zone["water_level_m"]
        }
        features.append(feature_vector)
    
    return jsonify({"success": True, "features": features, "model_ready": True, "note": "Features normalized for ML model input"})

# =============================================================================
# MULTI-MODAL AI FUSION ENGINE ENDPOINT
# =============================================================================

@app.route('/api/flood-risk', methods=['POST'])
def calculate_flood_risk_fusion():
    """
    POST endpoint for multi-modal AI flood risk fusion.
    
    Input JSON:
    {
        "sar_score": float,           # Required: SAR flood intensity score (0-1)
        "distress_score": float,     # Required: Distress density score (0-1)
        "previous_probability": float # Optional: Previous flood probability for trend
    }
    
    Returns:
    JSON: Flood risk assessment containing:
        - flood_probability (float): Rounded to 2 decimal places
        - risk_level (str): "HIGH", "MODERATE", or "LOW"
        - confidence_score (float): Rounded to 2 decimal places
        - trend (str): "RISING", "FALLING", or "STABLE"
    """
    from flask import request
    
    # Get JSON data from request
    data = request.get_json()
    
    # Check if request has valid JSON
    if data is None:
        return jsonify({
            "success": False,
            "error": "Invalid JSON in request body"
        }), 400
    
    # Extract required parameters
    sar_score = data.get('sar_score')
    distress_score = data.get('distress_score')
    
    # Validate required parameters
    if sar_score is None:
        return jsonify({
            "success": False,
            "error": "Missing required field: sar_score"
        }), 400
    
    if distress_score is None:
        return jsonify({
            "success": False,
            "error": "Missing required field: distress_score"
        }), 400
    
    # Validate input types
    is_valid, error_message = validate_input(sar_score, distress_score)
    if not is_valid:
        return jsonify({
            "success": False,
            "error": error_message
        }), 400
    
    # Get optional previous_probability
    previous_probability = data.get('previous_probability')
    
    try:
        # Call the fusion engine
        result = fuse_signals(
            sar_score=sar_score,
            distress_score=distress_score,
            previous_probability=previous_probability
        )
        
        # Add 15-minute nowcasting prediction
        prediction = predict_15min(
            current_probability=result["flood_probability"],
            previous_probability=previous_probability
        )
        
        # Merge prediction into result
        result["predicted_15min_probability"] = prediction["predicted_15min_probability"]
        result["predicted_risk_level"] = prediction["predicted_risk_level"]
        
        # Return successful response
        return jsonify({
            "success": True,
            "result": result
        }), 200
        
    except TypeError as e:
        return jsonify({
            "success": False,
            "error": f"Invalid input type: {str(e)}"
        }), 400
        
    except ValueError as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400
        
    except Exception as e:
        # Catch any unexpected errors
        return jsonify({
            "success": False,
            "error": f"Internal server error: {str(e)}"
        }), 500

# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

if __name__ == '__main__':
    print("=" * 60)
    print("FloodWatch - AI Powered Urban Flood Early Warning System")
    print("=" * 60)
    print("\nAPI Endpoints:")
    print("  - GET /           : Welcome message")
    print("  - GET /api/zones  : List of monitored zones")
    print("  - GET /api/risk   : Flood risk assessment (Fusion Model + Geo-Clustering)")
    print("  - GET /api/alerts : Active flood alerts")
    print("  - GET /api/data/features : ML-ready features")
    print("\n" + "=" * 60)
    print("Server running at: http://localhost:5000")
    print("=" * 60 + "\n")
    app.run(debug=True, host='0.0.0.0', port=5000)

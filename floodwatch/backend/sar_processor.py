"""
SAR Satellite Simulation Module

This module simulates SAR (Synthetic Aperture Radar) satellite data for flood monitoring.
In production, this would connect to real satellite APIs (e.g., Sentinel-1, Landsat).

The simulation generates realistic flood lifecycle phases:
- "normal": Baseline water levels
- "expanding": Water levels increasing
- "peak": Maximum water levels
- "receding": Water levels decreasing
"""

import random
from datetime import datetime


# Global state dictionary to maintain per-zone SAR state
_previous_sar_state = {}


def generate_sar_data(zone_name):
    """
    Generate simulated SAR satellite data for a given zone.
    
    This function simulates real-time SAR radar monitoring by generating
    data with physically realistic flood lifecycle phases.
    
    Args:
        zone_name (str): Name of the zone to generate SAR data for
        
    Returns:
        dict: SAR analysis data containing:
            - surface_water_index: float (0-1)
            - water_expansion_rate_percent: float (-15 to +20)
            - corridor_spread_detected: boolean
            - flood_phase: str ("normal", "expanding", "peak", "receding")
            - last_updated: ISO format timestamp
    """
    global _previous_sar_state
    
    # Get previous state for this zone or initialize
    if zone_name not in _previous_sar_state:
        # Initialize new zone with normal phase
        surface_water_index = random.uniform(0.2, 0.4)
        phase = "normal"
        _previous_sar_state[zone_name] = {
            "surface_water_index": surface_water_index,
            "phase": phase
        }
    
    # Get previous state
    prev_state = _previous_sar_state[zone_name]
    prev_surface = prev_state["surface_water_index"]
    phase = prev_state["phase"]
    
    # Calculate new values based on current phase
    if phase == "normal":
        # Slight random variation
        delta = random.uniform(-0.02, 0.05)
        surface_water_index = prev_surface + delta
        # Check if should transition to expanding
        if surface_water_index > 0.5:
            phase = "expanding"
    
    elif phase == "expanding":
        # Increase surface water index
        delta = random.uniform(0.03, 0.08)
        surface_water_index = prev_surface + delta
        # Check if should transition to peak
        if surface_water_index > 0.8:
            phase = "peak"
    
    elif phase == "peak":
        # Small variation around peak
        delta = random.uniform(-0.01, 0.02)
        surface_water_index = prev_surface + delta
        # Transition to receding based on random chance
        if random.random() < 0.3:
            phase = "receding"
    
    elif phase == "receding":
        # Decrease surface water index
        delta = random.uniform(-0.08, -0.02)
        surface_water_index = prev_surface + delta
        # Check if should transition back to normal
        if surface_water_index < 0.3:
            phase = "normal"
    
    # Clamp surface_water_index between 0.0 and 1.0
    surface_water_index = max(0.0, min(1.0, surface_water_index))
    
    # Calculate water expansion rate based on phase
    if phase == "normal":
        water_expansion_rate_percent = random.uniform(-2.0, 5.0)
    elif phase == "expanding":
        water_expansion_rate_percent = random.uniform(5.0, 20.0)
    elif phase == "peak":
        water_expansion_rate_percent = random.uniform(0.0, 5.0)
    elif phase == "receding":
        water_expansion_rate_percent = random.uniform(-15.0, -5.0)
    
    # Determine corridor spread detection
    # Only when expanding AND surface_water_index > 0.65
    corridor_spread_detected = (phase == "expanding" and surface_water_index > 0.65)
    
    # Update state
    _previous_sar_state[zone_name] = {
        "surface_water_index": surface_water_index,
        "phase": phase
    }
    
    return {
        "surface_water_index": round(surface_water_index, 3),
        "water_expansion_rate_percent": round(water_expansion_rate_percent, 2),
        "corridor_spread_detected": corridor_spread_detected,
        "flood_phase": phase,
        "last_updated": datetime.now().isoformat()
    }


def get_sar_data_for_zones(zones):
    """
    Generate SAR data for multiple zones.
    
    Args:
        zones (list): List of zone dictionaries with 'name' key
        
    Returns:
        dict: Mapping of zone names to their SAR data
    """
    sar_data = {}
    for zone in zones:
        zone_name = zone.get("name", "")
        sar_data[zone_name] = generate_sar_data(zone_name)
    return sar_data


def reset_zone_state(zone_name):
    """
    Reset the SAR state for a specific zone (useful for testing).
    
    Args:
        zone_name (str): Name of the zone to reset
    """
    global _previous_sar_state
    if zone_name in _previous_sar_state:
        del _previous_sar_state[zone_name]


def reset_all_states():
    """
    Reset all SAR states (useful for testing).
    """
    global _previous_sar_state
    _previous_sar_state = {}

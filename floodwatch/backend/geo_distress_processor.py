"""
Geo-Radius Clustering Detection Module

This module simulates social media distress posts with geo-location data
and implements clustering detection to identify flood-related distress spikes.

Features:
- Simulated distress posts with lat/lon coordinates
- Haversine distance formula for geographic distance calculation
- Geo-radius clustering detection (5+ posts within 1.2km radius in last 15 minutes)
- Severity-weighted keyword scoring for enhanced distress analysis
"""

import random
import math
from datetime import datetime, timedelta


# Zone center coordinates (fixed)
ZONE_COORDINATES = {
    "Downtown Central": {"lat": 40.7128, "lon": -74.0060},
    "Riverside District": {"lat": 40.7580, "lon": -73.9855},
    "Industrial Park": {"lat": 40.7282, "lon": -74.0776},
    "University Campus": {"lat": 40.7295, "lon": -73.9965},
    "Old Town": {"lat": 40.7489, "lon": -73.9680},
    "Tech Valley": {"lat": 40.6892, "lon": -74.0445}
}

# Flood-related distress keywords
DISTRESS_KEYWORDS = [
    "flood", "water rising", "flooding", "underwater", "evacuation",
    "stuck in water", "roads flooded", "basement flooding", "emergency",
    "help", "trapped", "rescue", "heavy rain", "storm drain overflow"
]

# Weighted keywords for severity scoring (higher weight = more severe)
SEVERITY_KEYWORDS = {
    "help": 2,
    "rescue": 3,
    "trapped": 4,
    "flood": 2,
    "water rising": 3,
    "urgent": 3,
    "emergency": 4,
    "submerged": 5,
    "flooding": 2,
    "underwater": 4,
    "evacuation": 3,
    "stuck in water": 4,
    "roads flooded": 3,
    "basement flooding": 3,
    "heavy rain": 2,
    "storm drain overflow": 2
}

# Weights for combining severity with density
SEVERITY_WEIGHT = 0.7
DENSITY_WEIGHT = 0.3

# Normalization factor for severity score
NORMALIZATION_FACTOR = 20


def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees) using Haversine formula.
    
    Args:
        lat1, lon1: Latitude and longitude of first point
        lat2, lon2: Latitude and longitude of second point
        
    Returns:
        float: Distance in kilometers
    """
    # Convert decimal degrees to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    # Radius of earth in kilometers
    r = 6371
    
    return c * r


def calculate_severity_score(posts):
    """
    Calculate severity-weighted score from distress posts.
    
    Args:
        posts (list): List of distress post dictionaries
        
    Returns:
        dict: Contains distress_density, severity_score, and final_distress_score
    """
    if not posts:
        return {
            "distress_density": 0.0,
            "severity_score": 0.0,
            "final_distress_score": 0.0
        }
    
    # Calculate distress density (normalized by max possible posts)
    num_posts = len(posts)
    max_posts = 10  # Assume max 10 posts for normalization
    distress_density = min(num_posts / max_posts, 1.0)
    
    # Calculate severity score based on keyword weights
    total_severity = 0
    
    for post in posts:
        # Get the distress keyword from the post
        keyword = post.get("distress_keyword", "").lower()
        
        # Check for keyword matches in SEVERITY_KEYWORDS
        if keyword in SEVERITY_KEYWORDS:
            total_severity += SEVERITY_KEYWORDS[keyword]
        else:
            # Check for partial matches (keyword contained in text)
            for sev_key, weight in SEVERITY_KEYWORDS.items():
                if sev_key in keyword or keyword in sev_key:
                    total_severity += weight
                    break
    
    # Normalize severity score to 0-1 scale
    normalized_severity = min(total_severity / NORMALIZATION_FACTOR, 1.0)
    
    # Combine severity with distress density using weighted formula
    final_distress_score = (SEVERITY_WEIGHT * normalized_severity) + (DENSITY_WEIGHT * distress_density)
    
    return {
        "distress_density": round(distress_density, 3),
        "severity_score": round(normalized_severity, 3),
        "final_distress_score": round(final_distress_score, 3)
    }


def generate_distress_posts(zone_name, num_posts=None):
    """
    Generate simulated distress posts for a zone with geo-coordinates.
    
    Args:
        zone_name (str): Name of the zone
        num_posts (int): Number of posts to generate. If None, uses random 0-8.
        
    Returns:
        list: List of distress post dictionaries
    """
    posts = []
    
    # Get zone center coordinates
    zone_center = ZONE_COORDINATES.get(zone_name, {"lat": 40.7128, "lon": -74.0060})
    center_lat = zone_center["lat"]
    center_lon = zone_center["lon"]
    
    # Determine number of posts
    if num_posts is None:
        num_posts = random.randint(0, 8)
    
    # Generate posts with timestamps in last 15 minutes
    current_time = datetime.now()
    
    for i in range(num_posts):
        # Generate random coordinate within ~2km of zone center
        # Approx: 0.018 degrees ~ 2km
        lat_offset = random.uniform(-0.018, 0.018)
        lon_offset = random.uniform(-0.018, 0.018)
        
        post_lat = center_lat + lat_offset
        post_lon = center_lon + lon_offset
        
        # Random timestamp within last 15 minutes
        minutes_ago = random.uniform(0, 15)
        timestamp = (current_time - timedelta(minutes=minutes_ago)).isoformat()
        
        post = {
            "latitude": round(post_lat, 6),
            "longitude": round(post_lon, 6),
            "timestamp": timestamp,
            "zone_name": zone_name,
            "distress_keyword": random.choice(DISTRESS_KEYWORDS)
        }
        posts.append(post)
    
    return posts


def detect_geo_distress_spike(posts, radius_km=1.2, min_posts=5, time_window_minutes=15):
    """
    Detect geo-radius clustering of distress posts.
    
    Uses Haversine distance formula to find posts within the specified radius.
    Only considers posts from the last 15 minutes.
    
    Args:
        posts (list): List of distress post dictionaries
        radius_km (float): Radius in kilometers (default 1.2)
        min_posts (int): Minimum number of posts to trigger spike (default 5)
        time_window_minutes (int): Time window in minutes (default 15)
        
    Returns:
        dict: Geo-distress analysis result
    """
    if not posts or len(posts) < min_posts:
        return {
            "distress_spike_detected": False,
            "cluster_count": 0,
            "cluster_radius_km": radius_km,
            "cluster_center": None,
            "posts_analyzed": len(posts)
        }
    
    current_time = datetime.now()
    time_threshold = current_time - timedelta(minutes=time_window_minutes)
    
    # Filter posts within time window
    recent_posts = []
    for post in posts:
        try:
            post_time = datetime.fromisoformat(post["timestamp"])
            if post_time >= time_threshold:
                recent_posts.append(post)
        except:
            continue
    
    if len(recent_posts) < min_posts:
        return {
            "distress_spike_detected": False,
            "cluster_count": len(recent_posts),
            "cluster_radius_km": radius_km,
            "cluster_center": None,
            "posts_analyzed": len(posts)
        }
    
    # Find cluster center using centroid of all recent posts
    avg_lat = sum(p["latitude"] for p in recent_posts) / len(recent_posts)
    avg_lon = sum(p["longitude"] for p in recent_posts) / len(recent_posts)
    
    # Count posts within radius of the centroid
    posts_in_radius = 0
    for post in recent_posts:
        distance = haversine_distance(
            avg_lat, avg_lon,
            post["latitude"], post["longitude"]
        )
        if distance <= radius_km:
            posts_in_radius += 1
    
    # Detect spike if enough posts in radius
    distress_spike_detected = posts_in_radius >= min_posts
    
    return {
        "distress_spike_detected": distress_spike_detected,
        "cluster_count": posts_in_radius,
        "cluster_radius_km": radius_km,
        "cluster_center": {
            "lat": round(avg_lat, 6),
            "lon": round(avg_lon, 6)
        },
        "posts_analyzed": len(posts)
    }


def generate_geo_distress_data(zone_name):
    """
    Generate complete geo-distress analysis for a zone.
    
    Args:
        zone_name (str): Name of the zone
        
    Returns:
        dict: Geo-distress analysis with posts and spike detection
    """
    # Generate distress posts for this zone
    posts = generate_distress_posts(zone_name)
    
    # Detect geo-distress spike
    geo_analysis = detect_geo_distress_spike(posts)
    
    # Calculate severity-weighted scores
    severity_scores = calculate_severity_score(posts)
    
    return {
        "distress_posts": posts,
        "geo_distress_analysis": {
            "distress_spike_detected": geo_analysis["distress_spike_detected"],
            "cluster_count": geo_analysis["cluster_count"],
            "cluster_radius_km": geo_analysis["cluster_radius_km"],
            "cluster_center": geo_analysis["cluster_center"]
        },
        "severity_analysis": {
            "distress_density": severity_scores["distress_density"],
            "severity_score": severity_scores["severity_score"],
            "final_distress_score": severity_scores["final_distress_score"]
        },
        "last_updated": datetime.now().isoformat()
    }


def get_distress_score(zone_name):
    """
    Get the final distress score for a zone (convenience function for fusion engine).
    
    Args:
        zone_name (str): Name of the zone
        
    Returns:
        float: Final distress score (0-1)
    """
    data = generate_geo_distress_data(zone_name)
    return data["severity_analysis"]["final_distress_score"]


def get_zone_coordinates(zone_name):
    """
    Get the center coordinates for a zone.
    
    Args:
        zone_name (str): Name of the zone
        
    Returns:
        dict: Zone coordinates with lat and lon
    """
    return ZONE_COORDINATES.get(zone_name, {"lat": 40.7128, "lon": -74.0060})

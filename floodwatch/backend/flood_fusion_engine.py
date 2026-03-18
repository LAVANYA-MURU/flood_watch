"""
Multi-Modal AI Flood Fusion Engine

This module implements the core AI fusion logic for combining:
- SAR (Synthetic Aperture Radar) flood intensity score
- Geo-Distress social signal density score

The fusion engine uses weighted combination with confidence scoring
and trend analysis for real-time flood nowcasting.

Author: FloodWatch AI Team
Version: 1.0.0
"""

from typing import Optional, Dict, Any, Union


# =============================================================================
# CONSTANTS - Fusion Weights and Thresholds
# =============================================================================

# Weight configuration for signal fusion
SAR_WEIGHT = 0.6
DISTRESS_WEIGHT = 0.4

# Risk classification thresholds
RISK_HIGH_THRESHOLD = 0.85
RISK_MODERATE_THRESHOLD = 0.6

# Trend thresholds (for stability detection)
TREND_THRESHOLD = 0.001  # Consider stable if difference < 0.1%

# Nowcasting prediction constants
NOWCASTING_GROWTH_FACTOR = 1.5  # Multiplier for growth rate
NOWCASTING_DEFAULT_GROWTH = 1.1  # Default growth when no previous data


# =============================================================================
# CORE FUSION FUNCTION
# =============================================================================

def fuse_signals(
    sar_score: Union[int, float],
    distress_score: Union[int, float],
    previous_probability: Optional[float] = None
) -> Dict[str, Any]:
    """
    Fuse SAR and distress signals to generate flood risk assessment.
    
    This function combines multi-modal AI signals using weighted fusion
    to produce a comprehensive flood probability estimate with confidence
    scoring and trend analysis.
    
    Args:
        sar_score (float): Flood intensity score from SAR processor (0-1)
        distress_score (float): Distress density score from distress processor (0-1)
        previous_probability (float, optional): Previous flood probability for trend analysis
        
    Returns:
        dict: Flood risk assessment containing:
            - flood_probability (float): Rounded to 2 decimal places
            - risk_level (str): "HIGH", "MODERATE", or "LOW"
            - confidence_score (float): Rounded to 2 decimal places
            - trend (str): "RISING", "FALLING", or "STABLE"
            
    Raises:
        TypeError: If sar_score or distress_score are not numeric types
        ValueError: If sar_score or distress_score are out of valid range after clipping attempt
        
    Example:
        >>> result = fuse_signals(0.8, 0.6, previous_probability=0.65)
        >>> print(result)
        {
            'flood_probability': 0.72,
            'risk_level': 'MODERATE',
            'confidence_score': 0.8,
            'trend': 'RISING'
        }
    """
    
    # -------------------------------------------------------------------------
    # STEP 1: Input Validation and Type Checking
    # -------------------------------------------------------------------------
    
    # Validate required parameters are numeric
    if not isinstance(sar_score, (int, float)):
        raise TypeError(
            f"sar_score must be a numeric type (int or float), "
            f"got {type(sar_score).__name__}"
        )
    
    if not isinstance(distress_score, (int, float)):
        raise TypeError(
            f"distress_score must be a numeric type (int or float), "
            f"got {type(distress_score).__name__}"
        )
    
    # Handle NaN and infinity
    if isinstance(sar_score, float) and (float('nan') == sar_score or float('inf') == sar_score):
        raise ValueError("sar_score cannot be NaN or infinity")
    
    if isinstance(distress_score, float) and (float('nan') == distress_score or float('inf') == distress_score):
        raise ValueError("distress_score cannot be NaN or infinity")
    
    # -------------------------------------------------------------------------
    # STEP 2: Score Clipping - Ensure values are within valid range [0, 1]
    # -------------------------------------------------------------------------
    
    # Clip scores to valid range [0, 1]
    sar_score_clipped = max(0.0, min(1.0, float(sar_score)))
    distress_score_clipped = max(0.0, min(1.0, float(distress_score)))
    
    # -------------------------------------------------------------------------
    # STEP 3: Weighted Fusion Calculation
    # -------------------------------------------------------------------------
    
    # Calculate flood probability using weighted fusion formula
    # flood_probability = (0.6 * sar_score) + (0.4 * distress_score)
    flood_probability = (SAR_WEIGHT * sar_score_clipped) + (DISTRESS_WEIGHT * distress_score_clipped)
    
    # -------------------------------------------------------------------------
    # STEP 4: Risk Classification
    # -------------------------------------------------------------------------
    
    # Classify risk level based on flood probability
    if flood_probability > RISK_HIGH_THRESHOLD:
        risk_level = "HIGH"
    elif flood_probability > RISK_MODERATE_THRESHOLD:
        risk_level = "MODERATE"
    else:
        risk_level = "LOW"
    
    # -------------------------------------------------------------------------
    # STEP 5: Confidence Score Calculation
    # -------------------------------------------------------------------------
    
    # Calculate confidence based on signal agreement
    # Higher agreement (smaller difference) = higher confidence
    # confidence = 1 - abs(sar_score - distress_score)
    confidence = 1.0 - abs(sar_score_clipped - distress_score_clipped)
    
    # Ensure confidence is also within [0, 1] range
    confidence = max(0.0, min(1.0, confidence))
    
    # -------------------------------------------------------------------------
    # STEP 6: Trend Direction Analysis
    # -------------------------------------------------------------------------
    
    trend = "STABLE"  # Default trend
    
    # Only calculate trend if previous_probability is provided
    if previous_probability is not None:
        # Validate previous_probability is a valid number
        if not isinstance(previous_probability, (int, float)):
            raise TypeError(
                f"previous_probability must be a numeric type, "
                f"got {type(previous_probability).__name__}"
            )
        
        # Handle NaN and infinity for previous_probability
        if isinstance(previous_probability, float):
            if float('nan') == previous_probability or float('inf') == previous_probability:
                trend = "STABLE"
            else:
                # Clip previous_probability to valid range for comparison
                previous_prob_clipped = max(0.0, min(1.0, float(previous_probability)))
                
                # Calculate the difference
                probability_diff = flood_probability - previous_prob_clipped
                
                # Determine trend direction
                if probability_diff > TREND_THRESHOLD:
                    trend = "RISING"
                elif probability_diff < -TREND_THRESHOLD:
                    trend = "FALLING"
                else:
                    trend = "STABLE"
    
    # -------------------------------------------------------------------------
    # STEP 7: Build Result Dictionary
    # -------------------------------------------------------------------------
    
    result = {
        "flood_probability": round(flood_probability, 2),
        "risk_level": risk_level,
        "confidence_score": round(confidence, 2),
        "trend": trend
    }
    
    return result


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_risk_level_description(risk_level: str) -> str:
    """
    Get human-readable description for risk level.
    
    Args:
        risk_level (str): Risk level ("HIGH", "MODERATE", or "LOW")
        
    Returns:
        str: Human-readable description
    """
    descriptions = {
        "HIGH": "URGENT: High flood risk detected. Immediate action recommended.",
        "MODERATE": "WARNING: Moderate flood risk. Stay alert and monitor updates.",
        "LOW": "MONITORING: Low flood risk. Conditions are stable."
    }
    return descriptions.get(risk_level, "Unknown risk level")


def get_trend_recommendation(trend: str, risk_level: str) -> str:
    """
    Get recommendation based on trend direction and risk level.
    
    Args:
        trend (str): Trend direction ("RISING", "FALLING", or "STABLE")
        risk_level (str): Current risk level
        
    Returns:
        str: Recommendation message
    """
    if risk_level == "HIGH":
        if trend == "RISING":
            return "Situation deteriorating rapidly. Initiate emergency protocols."
        elif trend == "FALLING":
            return "Flood levels may be peaking. Continue monitoring."
        else:
            return "High risk persists. Maintain emergency readiness."
    elif risk_level == "MODERATE":
        if trend == "RISING":
            return "Risk increasing. Prepare for potential evacuation."
        elif trend == "FALLING":
            return "Risk decreasing. Continue normal operations."
        else:
            return "Maintain situational awareness."
    else:  # LOW
        return "Conditions stable. No immediate action required."


def validate_input(
    sar_score: Any,
    distress_score: Any,
    previous_probability: Optional[Any] = None
) -> tuple[bool, Optional[str]]:
    """
    Validate input parameters for fuse_signals.
    
    Args:
        sar_score: SAR score to validate
        distress_score: Distress score to validate
        previous_probability: Optional previous probability to validate
        
    Returns:
        tuple: (is_valid, error_message)
            - is_valid: True if inputs are valid
            - error_message: Error message if invalid, None if valid
    """
    # Check sar_score
    if not isinstance(sar_score, (int, float)):
        return False, f"sar_score must be numeric, got {type(sar_score).__name__}"
    
    # Check distress_score
    if not isinstance(distress_score, (int, float)):
        return False, f"distress_score must be numeric, got {type(distress_score).__name__}"
    
    # Check previous_probability if provided
    if previous_probability is not None:
        if not isinstance(previous_probability, (int, float)):
            return False, f"previous_probability must be numeric, got {type(previous_probability).__name__}"
    
    return True, None


# =============================================================================
# NOWCASTING PREDICTION FUNCTION
# =============================================================================

def predict_15min(
    current_probability: Union[int, float],
    previous_probability: Optional[float] = None
) -> Dict[str, Any]:
    """
    Lightweight 15-minute nowcasting prediction model.
    
    Args:
        current_probability (float): Current flood probability (0-1)
        previous_probability (float, optional): Previous flood probability for trend
        
    Returns:
        dict: Prediction with predicted_15min_probability and predicted_risk_level
    """
    # Validate current_probability
    if not isinstance(current_probability, (int, float)):
        raise TypeError(f"current_probability must be numeric")
    
    if isinstance(current_probability, float) and (float('nan') == current_probability or float('inf') == current_probability):
        raise ValueError("current_probability cannot be NaN or infinity")
    
    # Clip to valid range
    current_prob_clipped = max(0.0, min(1.0, float(current_probability)))
    
    # Calculate predicted probability
    if previous_probability is not None:
        if isinstance(previous_probability, float) and (float('nan') == previous_probability or float('inf') == previous_probability):
            predicted_probability = current_prob_clipped * NOWCASTING_DEFAULT_GROWTH
        else:
            previous_prob_clipped = max(0.0, min(1.0, float(previous_probability)))
            growth = current_prob_clipped - previous_prob_clipped
            predicted_probability = current_prob_clipped + (growth * NOWCASTING_GROWTH_FACTOR)
    else:
        predicted_probability = current_prob_clipped * NOWCASTING_DEFAULT_GROWTH
    
    # Clip predicted probability
    predicted_probability = max(0.0, min(1.0, predicted_probability))
    
    # Risk classification for prediction
    if predicted_probability > RISK_HIGH_THRESHOLD:
        predicted_risk_level = "HIGH"
    elif predicted_probability > RISK_MODERATE_THRESHOLD:
        predicted_risk_level = "MODERATE"
    else:
        predicted_risk_level = "LOW"
    
    return {
        "predicted_15min_probability": round(predicted_probability, 2),
        "predicted_risk_level": predicted_risk_level
    }


# =============================================================================
# MAIN ENTRY POINT (for testing)
# =============================================================================

if __name__ == "__main__":
    # Test the fusion engine
    print("=" * 60)
    print("FloodWatch AI Fusion Engine - Test Suite")
    print("=" * 60)
    
    # Test Case 1: High risk scenario
    print("\nTest 1: High Risk Scenario")
    result1 = fuse_signals(0.9, 0.8, previous_probability=0.7)
    print(f"  Input: sar_score=0.9, distress_score=0.8, previous_probability=0.7")
    print(f"  Result: {result1}")
    
    # Test Case 2: Moderate risk scenario
    print("\nTest 2: Moderate Risk Scenario")
    result2 = fuse_signals(0.7, 0.6, previous_probability=0.72)
    print(f"  Input: sar_score=0.7, distress_score=0.6, previous_probability=0.72")
    print(f"  Result: {result2}")
    
    # Test Case 3: Low risk scenario
    print("\nTest 3: Low Risk Scenario")
    result3 = fuse_signals(0.3, 0.2, previous_probability=0.28)
    print(f"  Input: sar_score=0.3, distress_score=0.2, previous_probability=0.28")
    print(f"  Result: {result3}")
    
    # Test Case 4: Without previous probability
    print("\nTest 4: Without Previous Probability")
    result4 = fuse_signals(0.8, 0.6)
    print(f"  Input: sar_score=0.8, distress_score=0.6")
    print(f"  Result: {result4}")
    
    # Test Case 5: Score clipping
    print("\nTest 5: Score Clipping (values out of range)")
    result5 = fuse_signals(1.5, -0.5)
    print(f"  Input: sar_score=1.5, distress_score=-0.5")
    print(f"  Result: {result5}")
    
    # Test Case 6: Maximum confidence (identical scores)
    print("\nTest 6: Maximum Confidence (identical scores)")
    result6 = fuse_signals(0.7, 0.7)
    print(f"  Input: sar_score=0.7, distress_score=0.7")
    print(f"  Result: {result6}")
    
    # Test Case 7: Minimum confidence (opposite scores)
    print("\nTest 7: Minimum Confidence (opposite scores)")
    result7 = fuse_signals(0.1, 0.9)
    print(f"  Input: sar_score=0.1, distress_score=0.9")
    print(f"  Result: {result7}")
    
    print("\n" + "=" * 60)
    print("Test Suite Complete")
    print("=" * 60)

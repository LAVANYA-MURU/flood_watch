# FloodWatch AI Fusion Engine Implementation

## Task: Create multi-modal AI fusion engine for flood nowcasting

### Plan Steps:

- [ ] Create `flood_fusion_engine.py` with `fuse_signals()` function
  - [ ] Input validation (check for missing values)
  - [ ] Score clipping (ensure between 0-1)
  - [ ] Weighted fusion: `(0.6 * sar_score) + (0.4 * distress_score)`
  - [ ] Risk classification: HIGH (>0.85), MODERATE (>0.6), LOW (otherwise)
  - [ ] Confidence score: `1 - abs(sar_score - distress_score)`
  - [ ] Trend direction: RISING/FALLING/STABLE based on previous_probability
  - [ ] Return JSON-like dictionary with rounded values

- [ ] Update `app.py` to add POST endpoint
  - [ ] Import flood_fusion_engine
  - [ ] Add POST /api/flood-risk endpoint
  - [ ] Handle JSON input parsing
  - [ ] Add proper error handling

- [ ] Test the implementation

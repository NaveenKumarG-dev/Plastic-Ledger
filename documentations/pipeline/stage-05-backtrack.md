# Stage 5: Hydrodynamic Back-Tracking

**File:** `pipeline/05_backtrack.py`

---

## Overview

Stage 5 implements a **Lagrangian particle back-tracking** model using the **OceanParcels** framework. Starting from the centroid of each confirmed debris cluster at the time of satellite detection, it releases virtual particles and integrates them **backward in time** through ocean current and wind fields. The endpoints of all particle trajectories cluster into **probable source regions**.

---

## Input

| Parameter | Type | Description |
|-----------|------|-------------|
| `scene_id` | `str` | Scene identifier |
| `detections_path` | `Path` | `detections_classified.geojson` from Stage 4 |
| `output_dir` | `Path` | Root output directory (default: `data/attribution`) |
| `config` | `dict` | Back-tracking parameters |
| `detection_date` | `str` (ISO 8601) | Date of the satellite image (start of backward integration) |
| `bbox` | `tuple` | Bounding box for current/wind data download |

---

## Output

```
data/attribution/<SCENE_ID>/
├── backtrack_summary.json              # Source region list for Stage 6
├── backtrack_<cluster_id>.geojson      # Trajectory lines per cluster
└── forcing_data/
    ├── ocean_currents.nc               # CMEMS current data (NetCDF)
    └── wind_data.nc                    # ERA5 wind data (NetCDF)
```

**Returns:** `List[Dict]` — list of source region dicts.

---

## External Data Sources

### Ocean Currents — CMEMS

| Property | Value |
|----------|-------|
| API | Copernicus Marine Service (copernicusmarine Python package) |
| Dataset | `cmems_mod_glo_phy_anfc_merged-uv_PT1H-i` |
| Variables | `uo` (eastward velocity, m/s), `vo` (northward velocity, m/s) |
| Resolution | ~8 km, hourly |
| Domain | Expanded bounding box + 5° padding |

```python
cm.subset(
    dataset_id="cmems_mod_glo_phy_anfc_merged-uv_PT1H-i",
    variables=["uo", "vo"],
    minimum_longitude=bbox[0], maximum_longitude=bbox[2],
    minimum_latitude=bbox[1],  maximum_latitude=bbox[3],
    start_datetime=date_start, end_datetime=date_end,
    ...
)
```

### Wind Data — ERA5 (ECMWF)

| Property | Value |
|----------|-------|
| API | CDS API (`cdsapi` Python package) |
| Dataset | `reanalysis-era5-single-levels` |
| Variables | `10m_u_component_of_wind`, `10m_v_component_of_wind` |
| Resolution | ~31 km, hourly |

```python
c.retrieve("reanalysis-era5-single-levels", {
    "product_type": "reanalysis",
    "variable": ["10m_u_component_of_wind", "10m_v_component_of_wind"],
    "area": [N, W, S, E],
    "date": f"{date_start}/{date_end}",
    "time": ["00:00", "01:00", ..., "23:00"],
    "format": "netcdf",
})
```


## OceanParcels Integration

The pipeline utilizes the **OceanParcels** framework (`parcels`) to construct a `FieldSet` from the downloaded NetCDF files. The ocean currents (`uo`, `vo`) and wind fields (`u10`, `v10`) are ingested directly without manual geographic conversions (handled internally by OceanParcels spherical mesh).

Each particle is integrated backward in time using a `ParticleSet` with a combination of two kernels:

1. **`AdvectionRK4`**: Built-in 4th-order Runge-Kutta advection over the ocean current fields.
2. **`StokesDriftWindage`**: A custom kernel that applies a configurable windage factor (default 3% of wind speed) to simulate the wind-driven drift of floating macroplastics.

**Backward execution:**
```python
pset.execute(
    kernel,
    runtime=timedelta(days=bt_days),
    dt=timedelta(hours=-dt_hours),  # Negative dt for backward tracking
    output_file=pfile
)
```

---

## Particle Release

For each debris cluster, `n_particles` (default: 50) particles are released with small random offsets around the cluster centroid:

```python
rng = np.random.default_rng(cluster_id + 42)
p_lon = centroid.x + rng.normal(0, 0.01)   # ±0.01° ≈ ±1 km
p_lat = centroid.y + rng.normal(0, 0.01)
```

Each particle is integrated backward for `bt_days × 24` hours at `dt_hours = 1.0` hour steps.

---

## Endpoint Clustering (DBSCAN)

After back-tracking, the final positions (oldest points in each trajectory) are clustered to identify **source regions**:

```python
DBSCAN(
    eps=eps_degrees,       # 0.5° ≈ 55 km
    min_samples=5          # Minimum density for a cluster
).fit(endpoints)
```

Each DBSCAN cluster becomes a **source region**:

```json
{
  "source_centroid": [lon, lat],
  "source_bbox":     [lon_min, lat_min, lon_max, lat_max],
  "source_probability": 0.72,   // fraction of particles ending here
  "n_particles": 36,
  "cluster_id": 0,
  "days_to_source": 30
}
```

`source_probability = cluster_particle_count / total_particles`

---

## Processing Steps

```
1. Load classified detections, filter out false positives
       ↓
2. Determine detection datetime and back-track date range
       ↓
3. Download ocean currents (CMEMS) for detection − bt_days to detection
       ↓
4. Download wind data (ERA5) for the same period
       ↓
5. For each confirmed debris cluster:
     a. Release n_particles (default 50) with ±1 km random offsets
     b. For each particle:
          - Run OceanParcels execution backward for bt_days
          - Record trajectory (lon, lat, time) automatically via Zarr output
     c. Extract trajectory endpoint (oldest time step)
     d. DBSCAN-cluster endpoints → source regions
     e. Save backtrack_<id>.geojson with trajectory lines
       ↓
6. Save backtrack_summary.json
```

---

## Config Keys Used

```yaml
backtracking:
  days:                 30    # How far back to integrate (days)
  n_particles:          50    # Particles per debris cluster
  time_step_hours:       1    # RK4 time step
  ocean_wind_ratio: [0.97, 0.03]  # [ocean weight, wind weight]
  dbscan_eps_degrees:  0.5   # DBSCAN spatial epsilon
  dbscan_min_samples:    5   # DBSCAN minimum cluster density
```

---

## Caching

If `backtrack_summary.json` already exists, the stage is skipped and the existing data is returned.

---

## CLI Usage

```bash
python -m pipeline.05_backtrack \
    --scene_id       S2A_MSIL2A_20240115... \
    --detections     data/detections/S2A.../detections_classified.geojson \
    --output_dir     data/attribution \
    --detection_date 2024-01-15 \
    --bbox           "80.0,8.0,82.0,10.0" \
    --config         config/config.yaml
```

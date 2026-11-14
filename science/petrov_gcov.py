"""Measure a radar-dark lake component and compare it with Sentinel-2 NDWI."""

import argparse
import hashlib
import json
from pathlib import Path

import h5py
import numpy as np
from PIL import Image
from pyproj import Transformer
import rasterio
from rasterio.features import shapes
from rasterio.transform import array_bounds, from_bounds, from_origin
from rasterio.warp import Resampling, reproject, transform_bounds, transform_geom
from scipy.ndimage import binary_dilation, binary_erosion, binary_fill_holes, label, median_filter

from discover import ROOT

SCENE_ID = "G4408360790-ASF"
OPTICAL_ID = "S2C_T43TGG_20261023T053859_L2A"
OPTICAL_STAC = f"https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a/items/{OPTICAL_ID}"
OPTICAL_BASE = ("https://e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com/"
                f"sentinel-2-c1-l2a/43/T/GG/2026/10/{OPTICAL_ID}")
GCOV_GROUP = "/science/LSAR/GCOV/grids/frequencyA"
SEED = (78.2390, 41.9047)


def otsu(db, valid):
    counts, edges = np.histogram(db[valid].clip(-32, -2), bins=120, range=(-32, -2))
    midpoints = (edges[:-1] + edges[1:]) / 2
    weights = counts.cumsum().astype(float)
    sums = (counts * midpoints).cumsum()
    score = (sums[-1] * weights - sums * weights[-1]) ** 2
    score /= np.maximum(weights * (weights[-1] - weights), 1)
    return float(midpoints[score.argmax()])


def component(mask, seed):
    groups, _ = label(mask)
    seed_label = groups[seed]
    if not seed_label:
        raise ValueError("Lake reference point was rejected by the classifier")
    return groups == seed_label


def radar(path, expected_name):
    with h5py.File(path, "r") as hdf:
        identity = hdf["/science/LSAR/identification"]
        if identity["granuleId"].asstr()[()].removesuffix(".h5") != expected_name:
            raise ValueError("HDF5 identity differs from the selected Earthdata granule")
        grid = hdf[GCOV_GROUP]
        crs = int(grid["projection"][()])
        dx, dy = float(grid["xCoordinateSpacing"][()]), -float(grid["yCoordinateSpacing"][()])
        if (crs, dx, dy) != (32643, 20, 20):
            raise ValueError("Unexpected source grid")
        x, y = grid["xCoordinates"][:], grid["yCoordinates"][:]
        sx, sy = Transformer.from_crs(4326, crs, always_xy=True).transform(*SEED)
        col, row = np.argmin(abs(x - sx)), np.argmin(abs(y - sy))
        seed = (160, 205)
        window = np.s_[row-160:row+161, col-205:col+206]
        transform = from_origin(x[col-205] - dx / 2, y[row-160] + dy / 2, dx, dy)
        hh = grid["HHHH"][window]
        looks = grid["numberOfLooks"][window]
        swath = grid["mask"][window]
        exceptions = grid["inputDataExceptionMask"][window]
    # The low byte contains anomaly flags. Bit 8 is the fully-focused HH flag.
    valid = (np.isfinite(hh) & (hh > 0) & np.isfinite(looks) & (looks >= 2)
             & (swath > 0) & (swath < 255) & ((exceptions & 255) == 0) & ((exceptions & 256) != 0))
    db = 10 * np.log10(np.where(valid, hh, np.nan))
    # Exclude pixels near missing samples from the median filter and classifier.
    neighborhood = binary_erosion(valid, np.ones((3, 3), dtype=bool), border_value=0)
    smooth = median_filter(np.nan_to_num(db), size=3)
    # Local window brackets the basin and nearby land without including distant shadows.
    local = np.s_[80:220, 85:305]
    threshold = otsu(smooth[local], neighborhood[local])
    masks = [component((smooth <= cutoff) & neighborhood, seed)
             for cutoff in (threshold - 1, threshold, threshold + 1)]
    if masks[-1][0].any() or masks[-1][-1].any() or masks[-1][:, 0].any() or masks[-1][:, -1].any():
        raise ValueError("Threshold sensitivity extends beyond the analysis window")
    filled = binary_fill_holes(masks[-1])
    shore = binary_dilation(filled, iterations=2) & ~binary_erosion(filled, iterations=2)
    return db, looks, masks, neighborhood, shore, threshold, transform, crs, seed


def optical(transform, crs, shape, seed):
    assets = {key: f"{OPTICAL_BASE}/{name}.tif"
              for key, name in (("green", "B03"), ("nir", "B08"), ("scl", "SCL"))}
    arrays = {}
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif"):
        for key, url in assets.items():
            out = np.zeros(shape, dtype=np.float32)
            with rasterio.open(url) as src:
                reproject(rasterio.band(src, 1), out, dst_transform=transform, dst_crs=crs,
                          src_nodata=0, dst_nodata=0,
                          resampling=Resampling.nearest if key == "scl" else Resampling.average)
            arrays[key] = out
    g, n, scl = (arrays[key] for key in ("green", "nir", "scl"))
    good = np.isin(scl, [4, 5, 6, 7]) & (g > 0) & (n > 0)
    g, n = g * 0.0001 - 0.1, n * 0.0001 - 0.1  # STAC raster:bands reflectance scales.
    good &= (g + n) > 0
    ndwi = np.divide(g - n, g + n, out=np.zeros_like(g), where=good)
    water = component(good & (ndwi > 0.15), seed)
    return assets, good, water


def digest(path):
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("hdf5", type=Path)
    parser.add_argument("--sentinel", action="store_true", help="Compare a public Sentinel-2 scene")
    args = parser.parse_args()
    out = ROOT / "public" / "data"
    inventory = json.loads((out / "scene_inventory.json").read_text(encoding="utf-8"))
    petrov = next(lake for lake in inventory["lakes"] if lake["slug"] == "petrov")
    scene = next(s for s in petrov["scenes"] if s["id"] == SCENE_ID)
    db, looks, masks, valid, shore, threshold, transform, crs, seed = radar(args.hdf5, scene["name"])
    selected = masks[1]
    area = lambda mask: round(int(mask.sum()) * 0.0004, 4)
    comparison = None
    if args.sentinel:
        assets, clear, water = optical(transform, crs, db.shape, seed)
        shared = clear & valid
        intersection = shared & selected & water
        union = shared & (selected | water)
        comparison = {
            "id": OPTICAL_ID, "date": "2026-10-23T05:47:20Z", "stac": OPTICAL_STAC,
            "assets": assets, "ndwiThreshold": 0.15, "waterAreaKm2": area(water),
            "intersectionCells": int(intersection.sum()), "unionCells": int(union.sum()),
            "iou": round(float(intersection.sum() / union.sum()), 4),
            "sharedRadarFraction": round(float((selected & shared).sum() / selected.sum()), 4),
        }
    bounds = transform_bounds(crs, 4326, *array_bounds(*db.shape, transform))
    west, south, east, north = bounds
    hue = np.uint8(np.nan_to_num((np.clip(db, -30, -4) + 30) * 255 / 26))
    rgba = np.stack([hue, hue, hue, np.uint8(np.isfinite(db)) * 255])
    rgba[:, selected] = np.array([26, 175, 163, 255])[:, None]
    raster = np.zeros_like(rgba)
    for source, target in zip(rgba, raster):
        reproject(source, target, src_transform=transform, src_crs=crs,
                  dst_transform=from_bounds(*bounds, db.shape[1], db.shape[0]),
                  dst_crs=4326, resampling=Resampling.nearest)
    image = out / "radar" / "petrov-gcov-water.png"
    Image.fromarray(np.moveaxis(raster, 0, -1)).save(image, optimize=True)
    features = [{"type": "Feature", "properties": {"scene": SCENE_ID},
                 "geometry": transform_geom(crs, 4326, geom, precision=7)}
                for geom, _ in shapes(selected.astype(np.uint8), mask=selected, transform=transform)]
    geojson = out / "petrov-water.geojson"
    geojson.write_text(json.dumps({"type": "FeatureCollection", "features": features}, separators=(",", ":")) + "\n")
    payload = {
        "scene": SCENE_ID, "granule": scene["name"], "acquired": scene["acquired"],
        "status": "REVIEW", "sourceSha256": digest(args.hdf5), "dataset": GCOV_GROUP + "/HHHH",
        "epsg": crs, "pixelM": 20, "seed": list(SEED), "waterCells": int(selected.sum()),
        "areaKm2": area(selected), "sensitivityKm2": [area(masks[0]), area(masks[-1])],
        "thresholdDb": threshold, "thresholdSweepDb": 1,
        "shoreValidFraction": round(float(valid[shore].mean()), 4),
        "windowValidFraction": round(float(valid.mean()), 4), "medianLooks": round(float(np.median(looks[selected])), 2),
        "corners": [[west, north], [east, north], [east, south], [west, south]],
        "image": "/data/radar/petrov-gcov-water.png", "imageSha256": digest(image),
        "geojson": "/data/petrov-water.geojson", "geojsonSha256": digest(geojson),
        "sentinel2": comparison,
    }
    (out / "petrov_gcov.json").write_text(json.dumps(payload, indent=2) + "\n")
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()

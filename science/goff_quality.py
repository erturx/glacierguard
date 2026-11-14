"""Summarize GOFF matching quality within a reproducible Lake Merzbacher window."""

import argparse
import hashlib
import json
from pathlib import Path

import h5py
import numpy as np
from PIL import Image
from pyproj import Transformer
from rasterio.transform import from_bounds
from rasterio.warp import Resampling, reproject, transform_bounds

from discover import ROOT

AOI = (79.81, 42.186, 79.96, 42.268)
GROUP = "/science/LSAR/GOFF/grids/frequencyA/pixelOffsets"
LAYER = "HH/layer3"
EXPECTED_ID = (
    "NISAR_L2_PR_GOFF_031_135_D_067_032_2000_SH_"
    "20260927T134411_20260927T134446_20261009T134412_20261009T134446_P05023_N_F_J_001"
)


def read_window(path):
    with h5py.File(path, "r") as file:
        identity = file["/science/LSAR/identification"]
        def identifier(key):
            return identity[key].asstr()[()]

        granule = identifier("granuleId").removesuffix(".h5")
        if granule != EXPECTED_ID:
            raise ValueError(f"Unexpected GOFF granule: {granule}")
        group = file[GROUP]
        layer = group[LAYER]
        epsg = int(layer["projection"][()])
        x0, y0, x1, y1 = transform_bounds("EPSG:4326", f"EPSG:{epsg}", *AOI)
        x, y = layer["xCoordinates"][:], layer["yCoordinates"][:]
        cols = np.flatnonzero((x >= x0) & (x <= x1))
        rows = np.flatnonzero((y >= y0) & (y <= y1))
        window = np.s_[rows[0]: rows[-1] + 1, cols[0]: cols[-1] + 1]
        longitude, latitude = Transformer.from_crs(epsg, 4326, always_xy=True).transform(
            *np.meshgrid(x[cols], y[rows])
        )
        west, south, east, north = AOI
        inside = (longitude >= west) & (longitude <= east) & (latitude >= south) & (latitude <= north)
        correlation = layer["correlationSurfacePeak"][window]
        snr = layer["snr"][window]
        along = layer["alongTrackOffset"][window]
        slant = layer["slantRangeOffset"][window]
        mask = group["mask"][window]
        dx, dy = abs(float(x[1] - x[0])), abs(float(y[1] - y[0]))
        raster_bounds = (x[cols[0]] - dx / 2, y[rows[-1]] - dy / 2,
                         x[cols[-1]] + dx / 2, y[rows[0]] + dy / 2)
        metadata = {
            "granule": granule, "reference": identifier("referenceZeroDopplerStartTime"),
            "secondary": identifier("secondaryZeroDopplerStartTime"),
            "lookDirection": identifier("lookDirection"),
            "epsg": epsg, "pixelSpacingM": [dx, dy], "path": GROUP + "/" + LAYER,
        }
    return metadata, inside, correlation, snr, along, slant, mask, raster_bounds


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("hdf5", type=Path)
    args = parser.parse_args()
    metadata, inside, peak, snr, along, slant, mask, raster_bounds = read_window(args.hdf5)
    paired = inside & np.isfinite(along) & np.isfinite(slant)
    valid = paired & np.isfinite(peak) & (peak >= 0) & (peak <= 1) & np.isfinite(snr) & (snr > 0)
    if not valid.any():
        raise ValueError("The study window has no valid correlation samples")
    # Exploratory bins chosen to visualize the distribution. They are not pass/fail rules.
    limits = [0.0, 0.25, 0.50, 0.75, 1.0]
    colors = [(226, 108, 105), (245, 179, 93), (110, 185, 196), (43, 150, 158)]
    counts, _ = np.histogram(peak[valid], bins=limits)
    classes = np.zeros(inside.shape, dtype=np.uint8)
    classes[valid] = np.digitize(peak[valid], limits[1:-1]) + 1
    target = np.zeros((256, 384), dtype=np.uint8)
    reproject(
        source=classes, destination=target, src_crs=metadata["epsg"], dst_crs="EPSG:4326",
        src_transform=from_bounds(*raster_bounds, inside.shape[1], inside.shape[0]),
        dst_transform=from_bounds(*AOI, target.shape[1], target.shape[0]),
        src_nodata=0, dst_nodata=0, resampling=Resampling.nearest,
    )
    rgba = np.array([(0, 0, 0, 0)] + [(*color, 230) for color in colors], dtype=np.uint8)
    out = ROOT / "public" / "data"
    image = out / "radar" / "merzbacher-goff-quality.png"
    image.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba[target]).save(image, optimize=True)
    with args.hdf5.open("rb") as raw:
        sha = hashlib.file_digest(raw, "sha256").hexdigest()
    codes, frequency = np.unique(mask[inside], return_counts=True)
    west, south, east, north = AOI
    metadata.update({
        "bounds": list(AOI), "corners": [[west, north], [east, north], [east, south], [west, south]],
        "hdf5Sha256": sha, "cellCenters": int(inside.sum()), "pairedOffsets": int(paired.sum()),
        "validQuality": int(valid.sum()), "medianPeak": round(float(np.median(peak[valid])), 3),
        "bins": [{"min": lo, "max": hi, "count": int(n), "color": "#%02x%02x%02x" % color}
                 for lo, hi, n, color in zip(limits, limits[1:], counts, colors)],
        "maskCodes": {int(k): int(n) for k, n in zip(codes, frequency)},
        "image": f"/data/radar/{image.name}", "assetSha256": hashlib.sha256(image.read_bytes()).hexdigest(),
    })
    (out / "goff_quality.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: metadata[key] for key in ("cellCenters", "pairedOffsets", "validQuality", "medianPeak", "bins")}))


if __name__ == "__main__":
    main()

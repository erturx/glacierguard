# glacierguard

An interactive NASA–ISRO NISAR observatory for glacial lakes in Kyrgyzstan, built for NASA Space Apps Challenge 2026.

## Run the demo

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm dev
```

Open the URL printed by Next.js. For production, run `pnpm build` and serve `out/` with a static HTTP host. Next.js App Router and TypeScript power the interface, MapLibre displays the rasters, and Python produces the cached datasets. The official satellite overlays and statistics are served with the application. The Esri contextual basemap requires an internet connection.

## Candidate selection

NASA CMR point-intersection searches covered acquisitions through 14 November 2026 in Asia/Bishkek. The table shows raw collection counts and deduplicated metadata. Each geometry group shares track, direction, frame, mode, maturity and processing release.

| Candidate | Validated | Provisional | Beta | Retained | Largest geometry group | Decision |
|---|---:|---:|---:|---:|---:|---|
| Lake Merzbacher | 1 | 29 | 0 | 30 | 10 | Dynamic, ice-dammed lake with strong historical relevance. Independent GOFF quality diagnostic available. Motion and water need different analyses. |
| Petrov Lake | 2 | 27 | 0 | 29 | 10 | Primary GCOV site. A large proglacial target with published optical and long-term research and two accessible validated browse images. |
| Tez-Tor Lake | 3 | 39 | 0 | 41 | 10 | Small, intermittent lake. Check the water body’s dimensions against the actual raster grid before estimating area. |
| Uchitel Lake | 3 | 39 | 0 | 41 | 10 | Smaller and seasonally variable. Check shoreline resolution, terrain and seasonal ice first. |

CMR intersection establishes that the reported footprint intersects one documented reference point. Valid-data fraction, shoreline coverage, native GCOV grid spacing and seasonal water/ice separability were not inspected. The analysis uses collection metadata for maturity. Validated maturity does not imply lake segmentation has been validated.

## Evidence and limits

- **Petrov Lake GCOV.** Official ASF browse scenes `G4408360790-ASF` and `G4411720636-ASF` were acquired on 25 and 28 October 2026 UTC on tracks 026 ascending and 063 descending. Their georeferenced browse composites are qualitative previews with a coarse display grid. The tracks differ, and the science HDF5 requires Earthdata login. Area, area change and drainage classification are unavailable.
- **Lake Merzbacher GOFF.** A reproducible window around the lake was analyzed from the original provisional HDF5, track 135, frame 067, left-looking, 27 September to 9 October 2026 UTC. Of 17,622 80 m cell centers, 16,459 passed the basic screen. Their median normalized correlation peak is 0.708. The denominator is a geographic window containing terrain and ice, and the result describes radar offset matching quality. No lake extent or glacier velocity is derived from this diagnostic.
- **Validation.** Tests cover catalog eligibility, source linkage, georeferencing, output checksums and GOFF histogram accounting. Independent Sentinel validation remains pending. Published work informed study selection and historical context.

## Reproduce the evidence

```sh
python -m pip install -r science/requirements.txt
python science/discover.py
python science/browse.py
python science/goff_quality.py "<path to original NISAR GOFF HDF5>"
pnpm test
```

Before running `browse.py`, save the two `browse` and `kml` URLs from the relevant Petrov records in `public/data/scene_inventory.json` under `.cache/<id>.png` and `.cache/<id>.kml`. Follow ASF redirects. `browse.json` records the raw PNG and KML SHA-256 values and the exported crop checksums. Repeated CMR queries may return revised records as the archive evolves.

The GOFF granule ID, source hash, spatial window, full dataset path and statistics are in `public/data/goff_quality.json`. Obtain that granule via [NASA Earthdata Search](https://search.earthdata.nasa.gov/search). `layer3` stores raw offset pairs in radar geometry. Finite along-track and slant-range offsets, a normalized correlation peak in [0, 1] and positive finite SNR define a basic screen. Statistics run on the original UTM grid. The RGBA map uses nearest-neighbor reprojection. The four correlation bins are descriptive.

The code is MIT licensed. Satellite products and third-party basemap imagery retain their original terms and attribution.

## Sources

- [NASA CMR catalog](https://cmr.earthdata.nasa.gov/search/)
- [ASF GCOV guide](https://nisar-docs.asf.alaska.edu/gcov/) and [GOFF guide](https://nisar-docs.asf.alaska.edu/goff/)
- [ASF Earthdata access setup](https://asfopensarlab.github.io/NISAR_Cookbook/set-up-earthdata-login/)
- [Petrov Lake historical satellite study](https://www.sciencedirect.com/science/article/pii/S0034425724004632)
- [Teztor and Uchitel study](https://nhess.copernicus.org/articles/26/733/2026/)
- [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9)

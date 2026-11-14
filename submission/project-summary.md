# glacierguard

glacierguard helps researchers, educators and disaster management teams inspect what NASA–ISRO radar observations can tell them about Kyrgyzstan’s glacial lakes. A reproducible NASA catalog search screened four candidate sites. The interactive map shows two georeferenced ASF radar previews over Petrov Lake and a measurement quality diagnostic derived directly from NISAR GOFF over the Lake Merzbacher area.

In the Merzbacher study window, 16,459 of 17,622 cell centers passed basic offset matching checks. Their median normalized correlation peak was 0.708. These measurements help identify where a radar pair produced interpretable matching diagnostics. Positive correlation and finite offsets alone are insufficient evidence for glacier speed, lake area change or a flood event.

## NASA data usage

The Petrov display uses NISAR L2 GCOV granules [G4408360790-ASF](https://search.earthdata.nasa.gov/search/granules?p=C3622241360-ASF&g=G4408360790-ASF) and [G4411720636-ASF](https://search.earthdata.nasa.gov/search/granules?p=C3622241360-ASF&g=G4411720636-ASF). ASF’s LATLON PNGs and KML were cropped in geographic coordinates and cached for the demo. The two tracks have different geometries. Quantitative comparison requires calibrated data and matching acquisition geometry.

Merzbacher analysis uses frequency A, HH, layer 3 of the original NISAR L2 GOFF granule `NISAR_L2_PR_GOFF_031_135_D_067_032_2000_SH_20260927T134411_20260927T134446_20261009T134412_20261009T134446_P05023_N_F_J_001`. Python counted valid samples on the native 80 m grid and exported a quality map and correlation histogram.

## AI disclosure

AI assisted with software development and communication. Deterministic Python code produced every published measurement. The demo has no runtime AI inference.

## 90-second demo

1. Open Petrov Lake. Explain how the source catalog narrows four candidate lakes to one GCOV study site.
2. Switch between the 25 and 28 October acquisitions. Point out the tracks and the original ASF source links.
3. Switch to Merzbacher. Show the 0.708 median, the four correlation bins and their locations on the map.
4. Open the methodology panel to show the granule ID, pixel size and downloadable quality report.
5. Explain the remaining work. Use comparable calibrated backscatter to measure water extent and check the shoreline with independent optical data.

## References

See the [repository README](../README.md) for the catalog, product guides, baseline literature, software and reproducibility commands.

# glacierguard

glacierguard helps researchers, educators and disaster management teams inspect what NASA–ISRO radar observations can tell them about Kyrgyzstan’s glacial lakes. A reproducible NASA catalog search screened four candidate sites. Over Petrov Lake, a 25 October 2026 UTC NISAR GCOV acquisition yielded an exploratory water extent of **4.27 km²**, with **4.09–4.61 km²** across a ±1 dB threshold sweep. The mask overlaps a 23 October Sentinel-2 water classification at **94.5% intersection over union** in shared valid pixels.

In the Merzbacher study window, 16,459 of 17,622 cell centers passed basic offset matching checks. Their median normalized correlation peak was 0.708. These measurements help identify where a radar pair produced interpretable matching diagnostics. Positive correlation and finite offsets alone are insufficient evidence for glacier speed, lake area change or a flood event.

## NASA data usage

The Petrov analysis uses frequency A HH gamma-naught from the original 20 m NISAR L2 GCOV HDF5. The water mask contains 10,676 contiguous radar-dark cells. The estimate remains under review because ice, shadow and the time gap with Sentinel-2 can affect interpretation. The 28 October GCOV scene is a qualitative ASF preview from a different track. The app reports a single-date estimate. [Analyzed GCOV granule](https://search.earthdata.nasa.gov/search/granules?p=C3622241360-ASF&g=G4408360790-ASF) · [28 October preview](https://search.earthdata.nasa.gov/search/granules?p=C3622241360-ASF&g=G4411720636-ASF)

Merzbacher analysis uses frequency A, HH, layer 3 of the original NISAR L2 GOFF granule `NISAR_L2_PR_GOFF_031_135_D_067_032_2000_SH_20260927T134411_20260927T134446_20261009T134412_20261009T134446_P05023_N_F_J_001`. Python counted valid samples on the native 80 m grid and exported a quality map and correlation histogram.

## AI disclosure

AI assisted with software development and communication. Deterministic Python code produced every published measurement. The demo has no runtime AI inference.

## 90-second demo

1. Open Petrov Lake. Explain how the source catalog narrows four candidate lakes to one GCOV study site.
2. Show the 4.27 km² NISAR result, threshold sensitivity and Sentinel-2 overlap. Switch to 28 October to show how the demo labels a browse-only observation.
3. Switch to Merzbacher. Show the 0.708 median, the four correlation bins and their locations on the map.
4. Open the methodology panel to show the granule ID, pixel size and downloadable quality report.
5. Explain what a second comparable NISAR acquisition would add. Change and drainage require supporting evidence across dates.

## References

See the [repository README](../README.md) for the catalog, product guides, baseline literature, software and reproducibility commands.

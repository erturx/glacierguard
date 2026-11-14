"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { Coordinates } from "maplibre-gl";
import inventory from "../public/data/scene_inventory.json";
import browse from "../public/data/browse.json";
import goff from "../public/data/goff_quality.json";
import gcov from "../public/data/petrov_gcov.json";

const RadarMap = dynamic(() => import("./map"), { ssr: false });
const petrov = inventory.lakes.find((lake) => lake.slug === "petrov")!;
const merzbacher = inventory.lakes.find((lake) => lake.slug === "merzbacher")!;
const scenes = browse.map((asset) => ({
  ...petrov.scenes.find((record) => record.id === asset.id)!,
  image: asset.image,
  corners: asset.corners as Coordinates,
  cropSize: asset.cropSize,
}));
const qualityOverlay = { ...goff, corners: goff.corners as Coordinates };
const waterOverlay = { ...gcov, corners: gcov.corners as Coordinates };
const earthdata = "https://search.earthdata.nasa.gov/search/granules";
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));
const number = (value: number) => new Intl.NumberFormat("en").format(value);
const validPercent = (100 * goff.validQuality / goff.cellCenters).toFixed(1);

export default function Dashboard() {
  const [mode, setMode] = useState<"gcov" | "goff">("gcov");
  const [selectedScene, setSelectedScene] = useState(0);
  const [layer, setLayer] = useState(true);
  const [opacity, setOpacity] = useState(92);
  const isGcov = mode === "gcov";
  const lake = isGcov ? petrov : merzbacher;
  const scene = scenes[selectedScene];
  const measured = scene.id === gcov.scene;
  const overlay = isGcov ? (measured ? waterOverlay : scene) : qualityOverlay;
  const sceneLink = `${earthdata}?p=${inventory.collections[scene.collection as keyof typeof inventory.collections][0]}&g=${scene.id}`;

  return <>
    <header className="topbar">
      <div className="topbar-inner">
        <a className="brand" href="#" aria-label="glacierguard home"><span className="brand-mark" aria-hidden="true">△</span>glacierguard<span className="brand-period">.</span></a>
        <nav aria-label="Page"><a href="#explorer">Explorer</a><a href="#method">Methodology</a></nav>
        <span className="mission"><span /> NASA–ISRO NISAR</span>
      </div>
    </header>
    <main>
      <section className="intro" id="explorer">
        <div className="eyebrow"><span /> TIEN SHAN, KYRGYZSTAN</div>
        <h1>Glacial Lake Observatory</h1>
        <p>Explore a radar-derived water extent at Petrov Lake and inspect NISAR measurement quality around Lake Merzbacher.</p>
      </section>
      <div className="view-switch" role="group" aria-label="Study views">
        <button aria-pressed={isGcov} onClick={() => setMode("gcov")}>Petrov Lake <span>GCOV imagery</span></button>
        <button aria-pressed={!isGcov} onClick={() => setMode("goff")}>Lake Merzbacher <span>GOFF quality</span></button>
      </div>
      <div className="workspace">
        <section className="panel map-panel" aria-label="Satellite imagery">
          <div className="map-header">
            <div><h2>{lake.name}</h2><span>{Math.abs(lake.center[1]).toFixed(3)}° N · {lake.center[0].toFixed(3)}° E</span></div>
            <label className="layer-control"><input type="checkbox" checked={layer} onChange={(event) => setLayer(event.target.checked)} /> NISAR overlay</label>
          </div>
          <RadarMap center={lake.center as [number, number]} name={lake.name} overlay={overlay} opacity={layer ? opacity / 100 : 0} />
          <div className="map-footer">
            <div><b>{isGcov ? (measured ? "HH backscatter · Teal shows estimated water" : "ASF GCOV browse image") : "GOFF correlation peak"}</b><span>{isGcov ? formatDate(scene.acquired) : "27 Sep – 9 Oct 2026"}</span></div>
            <label>Opacity <input type="range" min="0" max="100" value={opacity} disabled={!layer} onChange={(event) => setOpacity(Number(event.target.value))} aria-label="Radar overlay opacity" /></label>
          </div>
        </section>
        <aside className="panel analysis" aria-live="polite">
          {isGcov ? <>
            <div className="eyebrow"><span /> NISAR L2 GCOV</div>
            <h2>Radar observations</h2>
            <p>Choose an acquisition to inspect its imagery and available measurements.</p>
            {measured && <div className="metrics">
              <div><strong>{gcov.areaKm2.toFixed(2)} km²</strong><span>Estimated open water · Review</span></div>
              <div><strong>{gcov.sensitivityKm2.map((n) => n.toFixed(2)).join("–")}</strong><span>Threshold sensitivity (km²)</span></div>
            </div>}
            <div className="observations" role="group" aria-label="Acquisition timeline">
              {scenes.map((s, index) => <button key={s.id} aria-pressed={index === selectedScene} onClick={() => setSelectedScene(index)}>
                <span className="timeline-dot" /><span><b>{formatDate(s.acquired)}</b><small>Track {s.track} · {s.direction === "A" ? "Ascending" : "Descending"}</small></span><span className="acquisition-arrow" aria-hidden="true">›</span>
              </button>)}
            </div>
            <dl><div><dt>Collection maturity</dt><dd>{scene.maturity}</dd></div>
              {measured ? <div><dt>Sentinel-2 overlap (IoU)</dt><dd>{(gcov.sentinel2.iou * 100).toFixed(1)}%</dd></div> : <div><dt>Water extent</dt><dd>Unavailable</dd></div>}
            </dl>
            <div className="notice">{measured
              ? "The radar estimate uses a single acquisition. The range shows sensitivity to ±1 dB. The Sentinel-2 comparison uses shared valid pixels from 23 October. Shadows, ice and the time gap limit interpretation."
              : "This image is a qualitative preview from a different track. A change estimate requires two quality-screened, comparable observations."}</div>
            <a className="source-link" href={sceneLink} target="_blank" rel="noreferrer">Open granule in NASA Earthdata ↗</a>
          </> : <>
            <div className="eyebrow"><span /> NISAR L2 GOFF</div>
            <h2>Offset matching quality</h2>
            <p>GOFF layer 3 · Frequency A · HH · Track 135</p>
            <div className="metrics">
              <div><strong>{goff.medianPeak.toFixed(3)}</strong><span>Median correlation peak</span></div>
              <div><strong>{validPercent}%</strong><span>Cells passing the basic screen</span></div>
            </div>
            <div className="histogram" aria-label="Correlation peak distribution">
              {goff.bins.map((bin) => <div className="bin" key={bin.min}>
                <span>{bin.min.toFixed(2)}–{bin.max.toFixed(2)}</span>
                <div><span style={{ width: `${100 * bin.count / Math.max(...goff.bins.map((item) => item.count))}%`, background: bin.color }} /></div>
                <b>{number(bin.count)}</b>
              </div>)}
            </div>
            <div className="notice">{number(goff.validQuality)} of {number(goff.cellCenters)} cell centers had finite offsets, a peak in [0, 1] and positive SNR. This screen describes matching diagnostics across the analysis window. Estimating glacier velocity would require stronger quality control and geometric modeling.</div>
            <a className="source-link" href="https://nisar-docs.asf.alaska.edu/goff/" target="_blank" rel="noreferrer">Read the ASF GOFF guide ↗</a>
          </>}
        </aside>
      </div>
      <section className="panel method" id="method">
        <div><div className="eyebrow"><span /> SCIENTIFIC TRANSPARENCY</div><h2>Data and methodology</h2></div>
        <details open>
          <summary>{isGcov ? "GCOV scene provenance" : "GOFF granule provenance"}</summary>
          <p className="granule">{isGcov ? scene.name : goff.granule}</p>
          {isGcov ? (measured ? <>
            <p>Frequency A HH terrain-corrected gamma-naught from the original HDF5. Local Otsu threshold at {gcov.thresholdDb.toFixed(1)} dB on a 3×3 median-filtered grid. Area uses {number(gcov.waterCells)} seed-connected cells on the native {gcov.pixelM} m grid.</p>
            <p>Valid samples covered {(100 * gcov.shoreValidFraction).toFixed(0)}% of the candidate outer shoreline band. This checks data availability. Ice, wind and terrain shadow may still affect classification.</p>
            <p className="dataset-links"><a href={gcov.geojson} download>Download water extent ↓</a><a href="/data/petrov_gcov.json" download>Download GCOV report ↓</a><a href={gcov.sentinel2.stac} target="_blank" rel="noreferrer">Sentinel-2 source ↗</a></p>
          </> : <p>ASF LATLON browse imagery was cropped without resampling using its KML georeference. Display brightness follows ASF browse rendering.</p>) :
            <p>Read directly from the provisional HDF5. The 80 m UTM grid is used for statistics. The map shows nearest-neighbor reprojection of the correlation classes. Uncolored locations have no sample passing the basic screen.</p>}
          <p className="dataset-links">{isGcov ? <><a href={scene.browse} target="_blank" rel="noreferrer">Original PNG ↗</a><a href={scene.kml} target="_blank" rel="noreferrer">Georeference ↗</a><a href={scene.hdf5} target="_blank" rel="noreferrer">Source HDF5 ↗</a></> : <a href="/data/goff_quality.json" download>Download quality report ↓</a>}</p>
        </details>
        <details>
          <summary>Candidate lake catalog</summary>
          <div className="table-scroll"><table><thead><tr><th>Lake</th><th>Validated</th><th>Provisional</th><th>Beta</th><th>Retained</th></tr></thead>
            <tbody>{inventory.lakes.map((candidate) => <tr key={candidate.slug}><th scope="row">{candidate.name}</th><td>{candidate.counts.NISAR_L2_GCOV_V1}</td><td>{candidate.counts.NISAR_L2_GCOV_PROVISIONAL_V1}</td><td>{candidate.counts.NISAR_L2_GCOV_BETA_V1}</td><td>{candidate.scenes.length}</td></tr>)}</tbody>
          </table></div>
          <p>{inventory.searchMethod}. Records are filtered through 14 November 2026 in Bishkek. Catalog intersections describe footprint coverage at a reference point.</p>
          <p className="dataset-links"><a href="/data/scene_inventory.json" download>Download scene inventory ↓</a></p>
        </details>
      </section>
    </main>
    <footer><b>glacierguard.</b><span>NASA Space Apps Challenge 2026 · Kyrgyzstan</span><a href="#explorer">Back to explorer ↑</a></footer>
  </>;
}

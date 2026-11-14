import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../public${file}`, import.meta.url));
const data = (name) => JSON.parse(read(`/data/${name}.json`));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const inventory = data("scene_inventory");

test("four documented lake searches retain unique scene IDs through the study cutoff", () => {
  assert.deepEqual(inventory.lakes.map(({ slug }) => slug), ["merzbacher", "petrov", "teztor", "uchitel"]);
  for (const lake of inventory.lakes) {
    assert.ok(lake.locationSource.startsWith("https://"));
    const ids = lake.scenes.map(({ id }) => id);
    assert.equal(new Set(ids).size, ids.length);
    for (const [key, ids] of Object.entries(lake.catalogIds)) {
      assert.equal(ids.length, lake.counts[key]);
    }
    for (const scene of lake.scenes) {
      assert.ok(Date.parse(scene.acquired) <= Date.parse(inventory.through));
      assert.ok(lake.catalogIds[scene.collection].includes(scene.id));
    }
  }
});

test("real ASF previews cover the Petrov reference point and map to catalog records", () => {
  const lake = inventory.lakes.find(({ slug }) => slug === "petrov");
  const assets = data("browse");
  assert.equal(assets.length, 2);
  for (const asset of assets) {
    const scene = lake.scenes.find(({ id }) => id === asset.id);
    assert.equal(scene.maturity, "Validated");
    assert.ok(scene.browse.endsWith("_LATLON.png"));
    assert.ok(scene.kml.endsWith("_LATLON.kml"));
    assert.equal(hash(read(asset.image)), asset.assetSha256);
    const west = asset.corners[0][0];
    const north = asset.corners[0][1];
    const [east, south] = asset.corners[2];
    assert.ok(lake.center[0] > west && lake.center[0] < east);
    assert.ok(lake.center[1] > south && lake.center[1] < north);
  }
});

test("GOFF chart counts match the screening denominator and the real HDF5 artifact", () => {
  const report = data("goff_quality");
  assert.equal(report.hdf5Sha256, "3d66a6d81ee617f202f08ecf882cc4f11468f4458694922484992f9081f45898");
  assert.equal(report.cellCenters, 17622);
  assert.equal(report.validQuality, 16459);
  assert.deepEqual(report.bins.map(({ count }) => count), [144, 1898, 8055, 6362]);
  assert.equal(report.bins.reduce((sum, bin) => sum + bin.count, 0), report.validQuality);
  assert.ok(report.validQuality <= report.pairedOffsets && report.pairedOffsets <= report.cellCenters);
  assert.deepEqual(report.pixelSpacingM, [80, 80]);
  assert.equal(report.epsg, 32644);
  assert.equal(hash(read(report.image)), report.assetSha256);
});

test("Petrov extent and Sentinel comparison match the exported artifacts", () => {
  const result = data("petrov_gcov");
  const lake = inventory.lakes.find(({ slug }) => slug === "petrov");
  const scene = lake.scenes.find(({ id }) => id === result.scene);
  assert.equal(result.granule, scene.name);
  assert.equal(result.acquired, scene.acquired);
  assert.equal(result.status, "REVIEW");
  assert.equal(result.areaKm2, 4.2704);
  assert.equal(result.waterCells * result.pixelM ** 2 / 1e6, result.areaKm2);
  assert.ok(result.sensitivityKm2[0] < result.areaKm2 && result.areaKm2 < result.sensitivityKm2[1]);
  assert.ok(Math.abs(result.sentinel2.iou - result.sentinel2.intersectionCells / result.sentinel2.unionCells) < 0.00005);
  assert.equal(hash(read(result.image)), result.imageSha256);
  assert.equal(hash(read(result.geojson)), result.geojsonSha256);
  const geometry = JSON.parse(read(result.geojson)).features[0].geometry;
  assert.equal(geometry.type, "Polygon");
  assert.deepEqual(geometry.coordinates[0][0], geometry.coordinates[0].at(-1));
});

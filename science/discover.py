"""Cache official NASA CMR GCOV records for the four Kyrgyz study sites."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CMR = "https://cmr.earthdata.nasa.gov/search/"
END = "2026-11-14T17:59:59Z"  # End of November 14 in Asia/Bishkek.
SITES = (
    ("merzbacher", "Lake Merzbacher", 79.8810, 42.2267, "https://www.openstreetmap.org/way/27426748"),
    ("petrov", "Petrov Lake", 78.2390, 41.9047, "https://silkadv.com/en/content/lake-petrov-ak-shyirak-ridge"),
    ("teztor", "Tez-Tor Lake", 74.4282, 42.5379, "https://www.openstreetmap.org/way/173783276"),
    ("uchitel", "Uchitel Lake", 74.5405556, 42.5277778, "https://nhess.copernicus.org/articles/26/733/2026/"),
)
COLLECTIONS = {
    "NISAR_L2_GCOV_V1": "Validated",
    "NISAR_L2_GCOV_PROVISIONAL_V1": "Provisional",
    "NISAR_L2_GCOV_BETA_V1": "Beta",
}


def get(path, params):
    url = CMR + path + "?" + urlencode(params)
    request = Request(url, headers={"User-Agent": "GlacierGuard/1.0 (scientific discovery)"})
    with urlopen(request, timeout=25) as response:
        return json.load(response)["feed"]["entry"], response.headers


def query(site, collection):
    _, _, lon, lat, _ = site
    params = {
        "short_name": collection,
        "provider": "ASF",
        "point": f"{lon},{lat}",
        "temporal": f",{END}",
        "page_size": 2000,
    }
    entries, headers = get("granules.json", params)
    if len(entries) != int(headers["CMR-Hits"]):
        raise RuntimeError("CMR response was incomplete")
    scenes = []
    for entry in entries:
        name = entry["producer_granule_id"] if "producer_granule_id" in entry else entry["title"]
        parts = name.split("_")
        links = [link["href"] for link in entry["links"] if link["href"].startswith("https://nisar.asf.earthdatacloud.nasa.gov/")]
        hdf5 = next((url for url in links if url.endswith(f"/{name}.h5")), None)
        browse = next((url for url in links if url.endswith("_LATLON.png")), None)
        kml = next((url for url in links if url.endswith("_LATLON.kml")), None)
        rings = []
        for group in entry.get("polygons", []):
            for ring in group:
                values = list(map(float, ring.split()))
                points = [[lon, lat] for lat, lon in zip(values[::2], values[1::2])]
                if points and points[0] != points[-1]:
                    points.append(points[0])
                if len(points) >= 4:
                    rings.append(points)
        scenes.append({
            "id": entry["id"], "name": name, "collection": collection,
            "maturity": COLLECTIONS[collection], "acquired": entry["time_start"],
            "end": entry.get("time_end"), "track": parts[5],
            "direction": parts[6], "frame": parts[7], "mode": parts[9],
            "crid": parts[13], "revision": parts[-1], "hdf5": hdf5,
            "browse": browse, "kml": kml, "rings": rings,
        })
    return scenes


def preferred(scenes):
    """Keep a record for each acquisition and nominal geometry, in maturity order."""
    priority = {name: i for i, name in enumerate(COLLECTIONS)}
    ordered = sorted(scenes, key=lambda s: (
        -priority[s["collection"]], s["crid"], s["revision"],
    ), reverse=True)
    uniques = {}
    for s in ordered:
        key = tuple(s[k] for k in ("acquired", "track", "direction", "frame", "mode"))
        uniques.setdefault(key, s)
    return sorted(uniques.values(), key=lambda s: s["acquired"], reverse=True)


def main():
    with ThreadPoolExecutor(max_workers=8) as pool:
        checks = {name: pool.submit(get, "collections.json", {"short_name": name, "provider": "ASF"}) for name in COLLECTIONS}
        concept_ids = {}
        for name, task in checks.items():
            entries, _ = task.result()
            concept_ids[name] = [entry["id"] for entry in entries]
        queries = {
            (site[0], name): pool.submit(query, site, name)
            for site in SITES for name in COLLECTIONS if concept_ids[name]
        }
        lakes = []
        for slug, name, lon, lat, source in SITES:
            records = {key: queries[slug, key].result() if (slug, key) in queries else [] for key in COLLECTIONS}
            scenes = preferred([s for group in records.values() for s in group])
            lakes.append({
                "slug": slug, "name": name, "center": [lon, lat], "locationSource": source,
                "counts": {key: len(group) for key, group in records.items()},
                "catalogIds": {key: [s["id"] for s in group] for key, group in records.items()},
                "scenes": scenes,
            })

    output = ROOT / "public" / "data" / "scene_inventory.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": CMR, "checkedAt": datetime.now(timezone.utc).isoformat(), "through": END,
        "searchMethod": "ASF GCOV catalog footprint intersects a documented lake reference point",
        "collections": concept_ids, "lakes": lakes,
    }
    output.write_text(json.dumps(payload, separators=(",", ":")) + "\n", encoding="utf-8")
    for lake in lakes:
        print(lake["name"], list(lake["counts"].values()), len(lake["scenes"]), "retained")


if __name__ == "__main__":
    main()

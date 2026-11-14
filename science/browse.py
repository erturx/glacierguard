"""Prepare cropped, georeferenced ASF browse images for qualitative inspection."""

import hashlib
import io
import json
import math
import xml.etree.ElementTree as ET

from PIL import Image

from discover import ROOT

OUT = ROOT / "public" / "data"
CACHE = ROOT / ".cache"
SCENES = ("G4408360790-ASF", "G4411720636-ASF")
PETROV_VIEW = (78.174, 41.872, 78.307, 41.94)


def prepare(scene):
    raw = (CACHE / (scene["id"] + ".png")).read_bytes()
    kml = (CACHE / (scene["id"] + ".kml")).read_bytes()
    root = ET.fromstring(kml)
    coordinates = root.find(".//{http://www.google.com/kml/ext/2.2}LatLonQuad/coordinates")
    corners = [tuple(map(float, pair.split(",")[:2])) for pair in coordinates.text.split()]
    (west, south), (east, se_y), (ne_x, north), (nw_x, nw_y) = corners
    if (east, south, west, north) != (ne_x, se_y, nw_x, nw_y):
        raise ValueError("Expected an axis-aligned ASF LATLON image")
    image = Image.open(io.BytesIO(raw)).convert("RGB")
    dx, dy = (east - west) / image.width, (north - south) / image.height
    x0, y0, x1, y1 = PETROV_VIEW
    left, right = math.floor((x0 - west) / dx), math.ceil((x1 - west) / dx)
    top, bottom = math.floor((north - y1) / dy), math.ceil((north - y0) / dy)
    if not (0 <= left < right <= image.width and 0 <= top < bottom <= image.height):
        raise ValueError("Requested crop is outside the source image")
    crop = image.crop((left, top, right, bottom))
    if crop.getextrema() == ((0, 0),) * 3:
        raise ValueError("Source crop is empty")
    left_lon, right_lon = west + left * dx, west + right * dx
    top_lat, bottom_lat = north - top * dy, north - bottom * dy
    asset = OUT / "radar" / (scene["id"] + ".png")
    asset.parent.mkdir(parents=True, exist_ok=True)
    crop.save(asset, optimize=True)
    return {
        "id": scene["id"], "image": f"/data/radar/{asset.name}",
        "corners": [[left_lon, top_lat], [right_lon, top_lat],
                    [right_lon, bottom_lat], [left_lon, bottom_lat]],
        "sourceSize": list(image.size), "cropSize": list(crop.size),
        "sourceSha256": hashlib.sha256(raw).hexdigest(),
        "georeferenceSha256": hashlib.sha256(kml).hexdigest(),
        "assetSha256": hashlib.sha256(asset.read_bytes()).hexdigest(),
    }


def main():
    data = json.loads((OUT / "scene_inventory.json").read_text(encoding="utf-8"))
    petrov = next(lake for lake in data["lakes"] if lake["slug"] == "petrov")
    scenes = {scene["id"]: scene for scene in petrov["scenes"]}
    assets = [prepare(scenes[scene_id]) for scene_id in SCENES]
    (OUT / "browse.json").write_text(json.dumps(assets, indent=2) + "\n", encoding="utf-8")
    for asset in assets:
        print(asset["id"], asset["sourceSize"], "->", asset["cropSize"])


if __name__ == "__main__":
    main()

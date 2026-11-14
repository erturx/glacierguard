import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [runtimeModules, skillDir, python] = process.argv.slice(2);
const { Presentation, PresentationFile } = await import(pathToFileURL(path.join(runtimeModules, "@oai/artifact-tool/dist/artifact_tool.mjs")));
const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir, "container_tools/artifact_tool_utils.mjs")));
const workspaceDir = process.cwd();
const staging = path.join(workspaceDir, ".cache", "deck");
const output = path.join(workspaceDir, "submission", "glacierguard.pptx");
const font = "Segoe UI";
const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const source = "https://cmr.earthdata.nasa.gov/search/";
const gcovGuide = "https://nisar-docs.asf.alaska.edu/gcov/";
const goffGuide = "https://nisar-docs.asf.alaska.edu/goff/";
const assets = JSON.parse(await fs.readFile("public/data/browse.json", "utf8"));
const quality = JSON.parse(await fs.readFile("public/data/goff_quality.json", "utf8"));

function box(slide, text, left, top, width, height, fontSize, color, bold = false) {
  const shape = slide.shapes.add({
    name: text.slice(0, 55), geometry: "textbox", position: { left, top, width, height },
    fill: "none", line: { fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = { typeface: font, fontSize, color, bold, verticalAlignment: "top", insets: { left: 0, right: 0, top: 0, bottom: 0 } };
}

function page(title, notes, dark = false) {
  const slide = deck.slides.add();
  slide.background.fill = dark ? "#102E28" : "#F2F4ED";
  if (title) box(slide, title, 84, 70, 1110, 80, 55, dark ? "#F4FAEF" : "#132E28", true);
  slide.speakerNotes.text = notes;
  return slide;
}

function lines(slide, entries, color = "#2A5146") {
  entries.forEach(([heading, details], index) => {
    const y = 185 + index * 140;
    box(slide, heading, 85, y, 1110, 44, 33, color, true);
    box(slide, details, 85, y + 48, 1100, 78, 26, color);
  });
}

async function image(slide, asset, label, left, top, width, height) {
  slide.images.add({
    blob: await fs.readFile("public" + asset), contentType: "image/png", alt: label, fit: "contain",
    position: { left, top, width, height },
  });
}

{
  const slide = page(null, `NASA Space Apps Challenge 2026 presentation. Background evidence: ${gcovGuide}`, true);
  box(slide, "glacierguard", 82, 214, 1090, 145, 109, "#F4FAEF", true);
  box(slide, "NISAR observations of Kyrgyzstan’s glacial lakes", 85, 369, 1080, 75, 35, "#A9D9B8");
  box(slide, "NASA Space Apps Challenge 2026 · Dancing with the SARs", 85, 613, 1100, 40, 22, "#D1E2D9");
}
{
  const slide = page("Glacial lake monitoring in the Tien Shan",
    "Kyrgyzstan context and documented historical impacts: https://nhess.copernicus.org/articles/26/733/2026/\nPetrov evolution: https://www.sciencedirect.com/science/article/pii/S0034425724004632");
  lines(slide, [
    ["Glacier-fed lakes can fill, expand or drain", "Repeated observations help assess when a change deserves closer investigation."],
    ["Radar complements optical observations", "NISAR observes through clouds and at night. Ice and radar geometry can complicate interpretation."],
    ["The prototype makes the source inspectable", "Each displayed acquisition links to the original product or a reproducible quality report."],
  ]);
}
{
  const slide = page("Petrov Lake was selected for GCOV",
    `Source: ${source}\nPoint intersections through 14 November 2026 local time. The largest same-track, same-mode and same-release geometry group has 10 records.\nPetrov history: https://www.sciencedirect.com/science/article/pii/S0034425724004632`);
  lines(slide, [
    ["Four candidate lakes", "Merzbacher 30 · Petrov 29 · Tez-Tor 41 · Uchitel 41 retained catalog records."],
    ["Petrov has a large proglacial basin", "Published satellite studies provide context. Two validated ASF scene previews were accessible."],
    ["Coverage still needs a pixel-level check", "A footprint intersection shows that the catalog scene reaches the reference point."],
  ]);
}
{
  const slide = page("Two GCOV views of Petrov Lake",
    `ASF LATLON PNG and KML for G4408360790-ASF and G4411720636-ASF. Source: ${gcovGuide}\nhttps://search.earthdata.nasa.gov/search/granules?p=C3622241360-ASF&g=G4408360790-ASF\nhttps://search.earthdata.nasa.gov/search/granules?p=C3622241360-ASF&g=G4411720636-ASF`);
  await image(slide, assets[0].image, "Official GCOV browse crop over Petrov Lake, ascending", 85, 180, 510, 350);
  await image(slide, assets[1].image, "Official GCOV browse crop over Petrov Lake, descending", 680, 180, 510, 350);
  box(slide, "25 Oct 2026 · Track 026 ascending", 85, 545, 510, 38, 24, "#2A5146", true);
  box(slide, "28 Oct 2026 · Track 063 descending", 680, 545, 510, 38, 24, "#2A5146", true);
  box(slide, "Calibrated backscatter and shoreline checks are required to estimate water extent.", 85, 622, 1090, 56, 24, "#2A5146");
}
{
  const slide = page("Merzbacher GOFF correlation quality",
    `Source: ${quality.granule}\nDataset: ${quality.path}/correlationSurfacePeak\nDocumentation: ${goffGuide}`);
  await image(slide, quality.image, "Correlation peak classes surrounding Lake Merzbacher", 638, 183, 565, 376);
  box(slide, quality.medianPeak.toFixed(3), 86, 182, 535, 110, 91, "#1B6654", true);
  box(slide, "Median normalized correlation peak", 86, 295, 520, 52, 29, "#2A5146");
  box(slide, "16,459 of 17,622 cell centers passed the basic screen.", 86, 378, 510, 117, 34, "#132E28", true);
  box(slide, "27 Sep–9 Oct 2026 · HH layer 3 · 80 m grid", 86, 533, 535, 53, 22, "#2A5146");
  box(slide, "Warm colors mark lower correlation. Blank areas had no sample passing the screen.", 638, 570, 545, 63, 22, "#2A5146");
}
{
  const slide = page("What the current evidence supports", `Product documentation: ${gcovGuide} and ${goffGuide}.`);
  lines(slide, [
    ["GCOV shows the radar response of the basin", "Water area and change remain unmeasured. The two browse images use different tracks."],
    ["GOFF shows how strongly pixels matched", "Finite offsets and positive SNR support a basic screen. Glacier speed requires stronger quality controls and geometry."],
    ["Independent validation is pending", "A future comparison needs compatible GCOV data and an optical shoreline check."],
  ]);
}
{
  const slide = page("Interactive demo and reproducibility",
    "Code and reproduction commands: https://github.com/erturx/glacierguard\nCatalog source: https://cmr.earthdata.nasa.gov/search/", true);
  lines(slide, [
    ["Explore the radar views", "Select a Petrov acquisition, then switch to the Merzbacher correlation map."],
    ["Inspect the evidence", "Open scene provenance and download the catalog inventory and quality report."],
    ["Reproduce the result", "github.com/erturx/glacierguard · Python produced the published measurements. AI assisted development."],
  ], "#D1E2D9");
}

await fs.mkdir(staging, { recursive: true });
const candidatePath = path.join(staging, "candidate.pptx");
await (await PresentationFile.exportPptx(deck)).save(candidatePath);
for (const [index, slide] of deck.slides.items.entries()) {
  const png = await deck.export({ slide, format: "png", scale: 0.65 });
  await fs.writeFile(path.join(staging, `slide-${index + 1}.png`), new Uint8Array(await png.arrayBuffer()));
}
await finalizePresentation({
  workspaceDir, candidatePath, finalPath: output, pythonExecutable: python,
  explicitTotalSlideCount: 7, fontPolicy: { basis: "design", families: [font] },
  integrityValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(skillDir, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-heading-fit"],
  verifyArtifactToolImport: true,
  receiptPath: path.join(staging, "validation.json"),
});

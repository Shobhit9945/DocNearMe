import { readFile, writeFile } from "fs/promises";
import { join, basename, extname } from "path";
import sharp from "sharp";

const imageFiles = ["public/dnm.png", "public/docdaisy.png", "public/applogo.png"];

const qualityByFile: Record<string, number> = {
  "dnm.png": 55,
  "docdaisy.png": 60,
  "applogo.png": 60,
};

async function convertImage(relativePath: string) {
  const inputPath = join(process.cwd(), relativePath);
  const outputPath = inputPath.replace(new RegExp(`${extname(inputPath)}$`), ".avif");
  const source = await readFile(inputPath);
  const fileName = basename(inputPath);
  const quality = qualityByFile[fileName] ?? 60;

  const output = await sharp(source)
    .avif({ quality, effort: 6 })
    .toBuffer();

  await writeFile(outputPath, output);
  console.log(`Converted ${relativePath} -> ${outputPath.replace(process.cwd() + "/", "")} (${output.length} bytes)`);
}

async function main() {
  for (const imageFile of imageFiles) {
    await convertImage(imageFile);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
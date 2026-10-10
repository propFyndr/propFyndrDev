const fs = require('fs');
const path = require('path');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) results = results.concat(getFiles(filePath));
    else if (file.endsWith('.json')) results.push(filePath);
  });
  return results;
}

const files = getFiles(path.join(__dirname, '../../Projects'));
console.log(`Found ${files.length} dossier JSON files in Projects/`);

let singleProjectCount = 0;
let arrayProjectCount = 0;
const surveyedProjects = [];

for (const f of files) {
  try {
    const raw = fs.readFileSync(f, 'utf8');
    const data = JSON.parse(raw);
    if (data.project) {
      singleProjectCount++;
      surveyedProjects.push({
        sourceFile: f,
        project: data.project,
        builder: data.builder,
        unit_types: data.unit_types,
        amenities: data.amenities,
        connectivity: data.connectivity
      });
    } else if (Array.isArray(data)) {
      data.forEach(item => {
        if (item.project) {
          arrayProjectCount++;
          surveyedProjects.push({
            sourceFile: f,
            project: item.project,
            builder: item.builder,
            unit_types: item.unit_types,
            amenities: item.amenities,
            connectivity: item.connectivity
          });
        }
      });
    }
  } catch (e) {
    console.error(`Error reading ${f}:`, e.message);
  }
}

console.log(`Total individual surveyed projects: ${surveyedProjects.length} (${singleProjectCount} single + ${arrayProjectCount} array items)`);

// Check sample
console.log('\nSample surveyed project:');
const sample = surveyedProjects[0];
console.log({
  name: sample.project.name,
  slug: sample.project.slug,
  rera: sample.project.rera_number,
  towers: sample.project.total_towers,
  units: sample.project.total_units,
  lat: sample.project.lat,
  lng: sample.project.lng,
  unitCount: sample.unit_types ? sample.unit_types.length : 0,
  amenitiesCount: sample.amenities ? sample.amenities.length : 0
});

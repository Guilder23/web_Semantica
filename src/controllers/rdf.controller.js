const rdfService = require('../services/rdfService');
const dbpediaService = require('../services/dbpediaService');
const fusekiService = require('../services/fusekiService');

exports.search = async (req, res) => {
  try {
    const { q } = req.query;
    const results = await rdfService.searchDiseases(q);
    res.render('search-results', {
      title: `Resultados para "${q}"`,
      query: q,
      diseases: results,
      isEmpty: results.length === 0
    });
  } catch (err) {
    res.status(500).render('error', {
      title: 'Error',
      message: 'La búsqueda RDF falló',
      error: err
    });
  }
};

exports.diseaseDetails = async (req, res) => {
  try {
    const { uri } = req.params;
    const decodedUri = decodeURIComponent(uri);
    const disease = await rdfService.getDiseaseDetails(decodedUri);
    res.render('disease-detail', {
      title: disease['http://www.w3.org/2000/01/rdf-schema#label'] || 'Detalles de la Enfermedad',
      disease
    });
  } catch (err) {
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load disease details',
      error: err
    });
  }
};

// (b) Poblar ontología: descargar datos desde DBpedia y subirlos a Fuseki
// GET /rdf/populate?q=testing&limit=10&class=EntidadCalidadSoftware
exports.populate = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const limit = Number(req.query.limit || 10);
    const lang = req.lang || 'es';
    const targetClass = (req.query.class || 'EntidadCalidadSoftware').trim();

    if (!q) {
      return res.status(400).json({
        ok: false,
        message: 'Falta el parámetro q'
      });
    }

    const results = await dbpediaService.searchDiseases(q, lang);
    const selected = results.slice(0, Math.max(1, Math.min(limit, 50)));

    const base = process.env.ONTOLOGY_BASE_URI || 'http://www.semanticweb.org/user/ontologies/2026/2/calidad_software.owl#';

    // Construimos triples Turtle sin cabeceras (se insertan en INSERT DATA)
    const escapeLiteral = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');

    const triples = selected
      .filter(r => r && r.uri && (r.name || r.description))
      .map(r => {
        const id = 'DBpedia_' + Buffer.from(r.uri).toString('base64').replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        const subject = `<${base}${id}>`;
        const label = r.name ? `;\n  <http://www.w3.org/2000/01/rdf-schema#label> "${escapeLiteral(r.name)}"@${lang}` : '';
        const comment = r.description ? `;\n  <http://www.w3.org/2000/01/rdf-schema#comment> "${escapeLiteral(r.description)}"@${lang}` : '';
        const sameAs = `;\n  <http://www.w3.org/2002/07/owl#sameAs> <${r.uri}>`;
        const type = targetClass ? `  a <${base}${targetClass}>` : `  a <http://www.w3.org/2002/07/owl#Thing>`;

        return `${subject}\n${type}${label}${comment}${sameAs} .`;
      })
      .join('\n\n');

    if (!triples) {
      return res.json({ ok: true, inserted: 0, message: 'DBpedia no devolvió resultados utilizables', results: selected });
    }

    await fusekiService.insertDataTurtle(triples);

    return res.json({
      ok: true,
      inserted: selected.length,
      base,
      targetClass,
      sample: selected.slice(0, 5)
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'Fallo al poblar Fuseki desde DBpedia',
      error: error.message
    });
  }
};

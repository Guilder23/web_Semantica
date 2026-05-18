const dbpediaService = require('../services/dbpediaService');
const fusekiService = require('../services/fusekiService');
const translationService = require('../services/translationService');

exports.home = (req, res) => {
  res.render('index', { 
    title: 'Buscador Semántico de Calidad de Software',
    lang: req.lang || 'es'
  });
};

exports.search = async (req, res) => {
  try {
    const { q } = req.query;
    const lang = req.lang || 'es';
    const source = (req.query.source || 'fuseki').toLowerCase();
    
    let results =
      source === 'dbpedia'
        ? await dbpediaService.searchDiseases(q, lang)
        : await fusekiService.searchConcepts(q, lang);
    
    // Normalizar campos para la vista (la plantilla usa `label`, `abstract`, `dbpediaPage`)
    results = results.map(r => ({
      ...r,
      label: r.name || r.label,
      abstract: r.description || r.abstract,
      dbpediaPage: source === 'dbpedia' ? (r.uri || r.dbpediaPage) : undefined,
      ontologyUri: r.uri
    }));

    if (lang !== 'en') {
      results = await Promise.all(
        results.map(disease => translationService.translateResults(disease, lang))
      );
    }
    
    // Depuración opcional (evita ensuciar logs en ejecución normal)
    if (req.query.debug === '1' || req.query.json === '1') {
      console.log("Full results data:", JSON.stringify(results, null, 2));
    }

    // Si se solicita debug como JSON, devolver los resultados crudos para inspección
    if (req.query.debug === '1' || req.query.json === '1') {
      return res.json(results);
    }
    
    res.render('search-results', { 
      title: `Resultados para "${q}"`,
      query: q,
      diseases: results,
      isEmpty: results.length === 0,
      lang,
      source,
      showDetails: true // Nueva variable para la vista
    });
  } catch (error) {
    res.status(500).render('error', { 
      title: 'Error',
      message: 'Error en la búsqueda médica',
      error,
      lang: req.lang
    });
  }
};

exports.diseaseDetails = async (req, res) => {
  try {
    const { uri } = req.params;
    const lang = req.lang || 'es';
    const source = (req.query.source || 'fuseki').toLowerCase();
    const decodedUri = decodeURIComponent(uri);

    const disease =
      source === 'dbpedia'
        ? await dbpediaService.getDiseaseDetails(decodedUri, lang)
        : await fusekiService.getConceptDetails(decodedUri, lang);
    
    if (!disease) {
      return res.status(404).render('error', {
        title: 'Concepto no encontrado',
        message: 'El concepto solicitado no fue encontrado',
        lang
      });
    }
    
    if (lang !== 'en') {
      const translated = await translationService.translateResults(disease, lang);
      // Mantener propiedades no textuales
      translated.uri = disease.uri;
      translated.types = disease.types;
      translated.triples = disease.triples;
      disease.name = translated.name;
      disease.description = translated.description;
    }
    
    res.render('disease-detail', { 
      title: disease.name,
      disease,
      lang,
      source
    });
  } catch (error) {
    res.status(500).render('error', { 
      title: 'Error',
      message: 'Error al cargar detalles del concepto',
      error,
      lang: req.lang
    });
  }
};
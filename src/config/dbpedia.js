module.exports = {
  // Usa la variable de entorno SPARQL_ENDPOINT si está definida,
  // por defecto conecta a DBpedia.
  endpoint: process.env.DBPEDIA_ENDPOINT || 'https://dbpedia.org/sparql',
  defaultQueryOptions: {
    // Parametros enviados en la query string; mantenemos timeout por defecto
    format: 'json',
    timeout: 30000
  }
};

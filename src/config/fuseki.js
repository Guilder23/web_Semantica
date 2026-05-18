module.exports = {
  // Endpoint de consulta SPARQL (SELECT/CONSTRUCT) del dataset en Fuseki
  queryEndpoint: process.env.FUSEKI_QUERY_ENDPOINT || 'http://localhost:3030/calidadsoft/sparql',

  // Endpoint de carga de datos (subida de Turtle/RDF/XML). En Fuseki suele ser /data
  dataEndpoint: process.env.FUSEKI_DATA_ENDPOINT || 'http://localhost:3030/calidadsoft/data',

  // Endpoint de actualización SPARQL (INSERT/DELETE). En Fuseki suele ser /update
  updateEndpoint: process.env.FUSEKI_UPDATE_ENDPOINT || 'http://localhost:3030/calidadsoft/update'
};

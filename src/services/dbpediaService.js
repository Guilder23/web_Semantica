const axios = require('axios');
const { URL, URLSearchParams } = require('url');
const dbpediaConfig = require('../config/dbpedia');
const { searchDiseases, isSoftwareQualityQuery } = require('../utils/sparqlQueries');

class DBpediaService {
  _getEndpoint() {
    return dbpediaConfig.endpoint;
  }

  async searchDiseases(term, lang = 'es') {
    if (!isSoftwareQualityQuery(term)) {
      return [];
    }

    const endpoint = this._getEndpoint();
    const query = searchDiseases(term, lang);

    try {
      const response = await axios.get(endpoint, {
        params: {
          ...dbpediaConfig.defaultQueryOptions,
          query
        },
        headers: {
          Accept: 'application/sparql-results+json, application/json'
        }
      });

      if (!response.data || !response.data.results) {
        throw new Error('Invalid response structure from DBpedia');
      }

      const rows = response.data.results.bindings;

      // Deduplicar por URI (DBpedia puede devolver varias filas por rdf:type)
      const byUri = new Map();
      for (const r of rows) {
        const uri = r.disease?.value;
        if (!uri) continue;

        const existing = byUri.get(uri);
        const type = r.type?.value;

        if (!existing) {
          byUri.set(uri, {
            uri,
            name: r.label?.value,
            description: r.abstract?.value,
            types: type ? [type] : []
          });
        } else {
          if (type && !existing.types.includes(type)) existing.types.push(type);
          if (!existing.name && r.label?.value) existing.name = r.label?.value;
          if (!existing.description && r.abstract?.value) existing.description = r.abstract?.value;
        }
      }

      return Array.from(byUri.values());
    } catch (error) {
      this._handleError(error);
      return [];
    }
  }

  async getDiseaseDetails(uri, lang = 'es') {
    const endpoint = this._getEndpoint();

    // Detalle genérico (útil para recursos de “calidad de software” en DBpedia)
    const query = `
      PREFIX dbo: <http://dbpedia.org/ontology/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

      SELECT DISTINCT ?label ?abstract ?type ?p ?o WHERE {
        BIND(<${uri}> AS ?s)

        OPTIONAL { ?s rdfs:label ?label . FILTER(LANG(?label) = "${lang}" || LANG(?label) = "en" || LANG(?label) = "") }
        OPTIONAL { ?s dbo:abstract ?abstract . FILTER(LANG(?abstract) = "${lang}" || LANG(?abstract) = "en") }
        OPTIONAL { ?s rdf:type ?type }
        OPTIONAL { ?s ?p ?o }
      }
      LIMIT 300
    `;

    try {
      const response = await axios.get(endpoint, {
        params: {
          ...dbpediaConfig.defaultQueryOptions,
          query
        },
        headers: {
          Accept: 'application/sparql-results+json, application/json'
        }
      });

      const rows = response.data.results.bindings;

      if (!rows || rows.length === 0) {
        return null;
      }

      const base = rows[0];

      const types = Array.from(new Set(rows.map(r => r.type?.value).filter(Boolean)));
      const triples = rows
        .map(r => ({ p: r.p?.value, o: r.o?.value }))
        .filter(t => t.p && t.o);

      return {
        uri,
        name: base.label?.value || uri,
        description: base.abstract?.value,
        types,
        triples
      };
    } catch (error) {
      this._handleError(error);
      return null;
    }
  }

  _handleError(error) {
    console.error('DBpedia Service Error:');
    console.error(`- Message: ${error.message}`);
    if (error.response) {
      console.error(`- Status: ${error.response.status}`);
      console.error(`- Response: ${JSON.stringify(error.response.data)}`);
    }
  }
}

module.exports = new DBpediaService();


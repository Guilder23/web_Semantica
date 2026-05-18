const axios = require('axios');
const fusekiConfig = require('../config/fuseki');

class FusekiService {
  _getQueryEndpoint() {
    return fusekiConfig.queryEndpoint;
  }

  _getDataEndpoint() {
    return fusekiConfig.dataEndpoint;
  }

  _getUpdateEndpoint() {
    return fusekiConfig.updateEndpoint;
  }

  async searchConcepts(term, lang = 'es') {
    if (!term || typeof term !== 'string') return [];

    const escapedTerm = term.replace(/"/g, '\\"');
    const endpoint = this._getQueryEndpoint();

    // Busca recursos por rdfs:label y, si faltan labels, también por el localname del URI.
    // Preferimos el idioma solicitado, con fallback a cualquier label y luego localname.
    const query = `
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

      SELECT DISTINCT ?uri ?label ?comment ?type WHERE {
        ?uri rdf:type ?type .
        BIND(REPLACE(STR(?uri), '^.*[#/]', '') AS ?localName)

        OPTIONAL { ?uri rdfs:label ?labelRaw . }

        FILTER(
          (BOUND(?labelRaw) && CONTAINS(LCASE(STR(?labelRaw)), LCASE("${escapedTerm}")))
          || CONTAINS(LCASE(?localName), LCASE("${escapedTerm}"))
        )

        OPTIONAL {
          ?uri rdfs:label ?labelLang .
          FILTER(LANG(?labelLang) = "${lang}")
        }
        BIND(COALESCE(?labelLang, ?labelRaw, ?localName) AS ?label)

        OPTIONAL {
          ?uri rdfs:comment ?commentRaw .
          FILTER(LANG(?commentRaw) = "${lang}" || LANG(?commentRaw) = "en" || LANG(?commentRaw) = "")
        }
        BIND(?commentRaw AS ?comment)
      }
      LIMIT 50
    `;

    const response = await axios.get(endpoint, {
      params: { query, format: 'json' },
      headers: { Accept: 'application/sparql-results+json, application/json' }
    });

    const rows = response?.data?.results?.bindings || [];

    return rows.map(r => ({
      uri: r.uri?.value,
      label: r.label?.value,
      abstract: r.comment?.value,
      type: r.type?.value
    }));
  }

  async getConceptDetails(uri, lang = 'es') {
    if (!uri) return null;

    const endpoint = this._getQueryEndpoint();

    const query = `
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

      SELECT ?label ?comment ?type ?p ?o WHERE {
        BIND(<${uri}> AS ?s)
        BIND(REPLACE(STR(?s), '^.*[#/]', '') AS ?localName)

        OPTIONAL {
          ?s rdfs:label ?labelRaw .
          FILTER(LANG(?labelRaw) = "${lang}" || LANG(?labelRaw) = "" || LANG(?labelRaw) = "en")
        }
        BIND(COALESCE(?labelRaw, ?localName) AS ?label)

        OPTIONAL {
          ?s rdfs:comment ?commentRaw .
          FILTER(LANG(?commentRaw) = "${lang}" || LANG(?commentRaw) = "" || LANG(?commentRaw) = "en")
        }
        BIND(?commentRaw AS ?comment)

        OPTIONAL { ?s rdf:type ?type }
        OPTIONAL { ?s ?p ?o }
      }
      LIMIT 300
    `;

    const response = await axios.get(endpoint, {
      params: { query, format: 'json' },
      headers: { Accept: 'application/sparql-results+json, application/json' }
    });

    const rows = response?.data?.results?.bindings || [];
    if (rows.length === 0) return null;

    const first = rows[0];

    const types = Array.from(
      new Set(rows.map(r => r.type?.value).filter(Boolean))
    );

    const triples = rows
      .map(r => ({
        p: r.p?.value,
        o: r.o?.value
      }))
      .filter(t => t.p && t.o);

    return {
      uri,
      name: first.label?.value || uri,
      description: first.comment?.value,
      types,
      triples
    };
  }

  async uploadTurtle(turtleText) {
    const endpoint = this._getDataEndpoint();

    // Subida directa de Turtle al dataset
    await axios.post(endpoint, turtleText, {
      headers: {
        'Content-Type': 'text/turtle'
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });
  }

  async insertDataTurtle(turtleTriples) {
    const endpoint = this._getUpdateEndpoint();
    const update = `INSERT DATA {\n${turtleTriples}\n}`;

    await axios.post(endpoint, update, {
      headers: {
        'Content-Type': 'application/sparql-update'
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });
  }
}

module.exports = new FusekiService();

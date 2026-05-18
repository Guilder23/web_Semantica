module.exports = {
  searchDiseases: (term, lang = "es") => {
    if (!term || typeof term !== "string") {
      throw new Error("Invalid search term");
    }

    const escapeForSparql = (s) => String(s).replace(/"/g, '\\"');

    const normalized = term.trim().toLowerCase();
    const phrase = escapeForSparql(normalized);
    const tokens = normalized
      .split(/\s+/)
      .map(t => t.trim())
      .filter(Boolean)
      .slice(0, 5)
      .map(escapeForSparql);

    const labelTokenFilter = tokens
      .map(t => `CONTAINS(LCASE(STR(?labelRaw)), "${t}")`)
      .join(' || ');
    const absTokenFilter = tokens
      .map(t => `CONTAINS(LCASE(STR(?abstractRaw)), "${t}")`)
      .join(' || ');

    const labelFilter = tokens.length
      ? `(CONTAINS(LCASE(STR(?labelRaw)), "${phrase}") || ${labelTokenFilter})`
      : `CONTAINS(LCASE(STR(?labelRaw)), "${phrase}")`;

    const abstractFilter = tokens.length
      ? `(CONTAINS(LCASE(STR(?abstractRaw)), "${phrase}") || ${absTokenFilter})`
      : `CONTAINS(LCASE(STR(?abstractRaw)), "${phrase}")`;

    return `
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX dbo: <http://dbpedia.org/ontology/>
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

      # Búsqueda genérica en DBpedia (útil para “calidad de software”)
      SELECT DISTINCT ?disease ?label ?abstract ?type WHERE {
        ?disease rdfs:label ?labelRaw .
        FILTER(LANG(?labelRaw)="" || LANG(?labelRaw)="en" || LANG(?labelRaw)="${lang}")

        OPTIONAL {
          ?disease rdfs:label ?labelLang .
          FILTER (LANG(?labelLang)="${lang}")
        }

        BIND(COALESCE(?labelLang, ?labelRaw) AS ?label)

        OPTIONAL {
          ?disease dbo:abstract ?abstractRaw .
          FILTER (LANG(?abstractRaw)="${lang}" || LANG(?abstractRaw)="en")
        }
        BIND(?abstractRaw AS ?abstract)

        FILTER (
          ${labelFilter}
          || (BOUND(?abstractRaw) && ${abstractFilter})
        )

        OPTIONAL { ?disease rdf:type ?type }
      }
      LIMIT 50
    `;
  }
};

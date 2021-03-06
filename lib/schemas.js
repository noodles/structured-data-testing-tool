const fs = require('fs')
const path = require('path')
const csv = require('csvtojson')

// Files are included this way to support automatic bundling when compiled with zeit/pkg
const PATH_TO_SCHEMA_JSON = path.join(__dirname, '../schemas.json')
const PATH_TO_SCHEMA_PROPERTIES_CSV = path.join(__dirname, '../schema.org/schema-properties.csv')
const PATH_TO_SCHEMA_PROPERTIES_PENDING_CSV = path.join(__dirname, '../schema.org/ext-pending-properties.csv')

// Load at runtime so is queried once and cached in memory
const schemas = JSON.parse(fs.readFileSync(PATH_TO_SCHEMA_JSON).toString())

async function getSchema(schemaName) {
  return schemas.hasOwnProperty(schemaName) ? await _getSchemaWithProperties(schemaName) : Promise.resolve(null)
}

async function _getSchemaWithProperties(schemaName) {
  return new Promise(async resolve => {
    let schemaProperties = await csv().fromFile(PATH_TO_SCHEMA_PROPERTIES_CSV)

    // Add properties that are pending (not final yet), but with a special flag
    const schemaPropertiesPending = await csv().fromFile(PATH_TO_SCHEMA_PROPERTIES_PENDING_CSV)
    schemaPropertiesPending.forEach(pendingProperty => {
      pendingProperty.pending = true
      //console.log('pendingProperty', pendingProperty)
    })
    schemaProperties = schemaProperties.concat(schemaPropertiesPending)

    let schemaWithProperties = schemas[schemaName]

    // Define default common properties (valid on all schemas)
    schemaWithProperties.properties = {
      "@context": {
        name: "@context",
        expect: /^(http|https):\/\/schema\.org/,
        description: ''
      },
      "@type": {
        name: "@type",
        value: ['http://schema.org/Text'],
        description: ''
      },
      "@id": {
        name: "@id",
        value: ['http://schema.org/Text'],
        description: ''
      }
    }

    // Get all schemas this schema is a subclass of
    _getParentSchemas(schemaName, (schemaNames) =>{
      schemaWithProperties.classes = schemaNames

      // Add all properties belonging to the specified schema AND any schema is a subclass of
      for (const schemaName of schemaNames) {
        for (const schemaProperty of schemaProperties) {
          const schemaUri = `http://schema.org/${schemaName}`
          if (schemaProperty.domainIncludes.split(', ').includes(schemaUri) &&
              !schemaWithProperties.properties[schemaProperty.label]) {

            schemaWithProperties.properties[schemaProperty.label] = {
              name: schemaProperty.label,
              value: schemaProperty.rangeIncludes.split(', '),
              comment: schemaProperty.comment,
              pending: schemaProperty.pending ? true : false
            }

            if (schemaProperty.pending)
              schemaWithProperties.properties[schemaProperty.label].pending = true
          }
        }
      }

      resolve(schemaWithProperties)
    })
  })
}

async function _getParentSchemas(schemaName, callback, schemaClasses) {
  // Get all the parent classes of a schema
  if (!schemaClasses)
    schemaClasses = [schemaName]

  if (schemas[schemaName] && schemas[schemaName].subClassOf) {
    schemaClasses.push(schemas[schemaName].subClassOf)
    _getParentSchemas(schemas[schemaName].subClassOf, callback, schemaClasses)
  } else {
    callback(schemaClasses)
  }
}

module.exports = {
  getSchema,
  schemas
}
#!/usr/bin/env node

import fetch from 'node-fetch';
import { writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Generate Postman collection from OpenAPI specification
 */
async function generatePostmanCollection() {
  const baseUrl = process.env.API_URL || 'http://localhost:3001';
  const outputPath = process.argv[2] || 'autoweave-backend.postman_collection.json';

  try {
    console.log('Fetching OpenAPI specification...');
    
    // Fetch OpenAPI spec
    const response = await fetch(`${baseUrl}/api-docs/openapi.json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch OpenAPI spec: ${response.status}`);
    }
    
    const openApiSpec = await response.json();
    
    console.log('Converting to Postman collection...');
    
    // Create Postman collection
    const collection = {
      info: {
        name: openApiSpec.info.title,
        description: openApiSpec.info.description,
        version: openApiSpec.info.version,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      auth: {
        type: 'bearer',
        bearer: [
          {
            key: 'token',
            value: '{{token}}',
            type: 'string'
          }
        ]
      },
      variable: [
        {
          key: 'baseUrl',
          value: baseUrl,
          type: 'string'
        },
        {
          key: 'token',
          value: '',
          type: 'string'
        }
      ],
      item: []
    };

    // Group endpoints by tags
    const folders = {};
    
    // Process paths
    for (const [path, methods] of Object.entries(openApiSpec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (method === 'parameters') continue;
        
        const tags = operation.tags || ['Other'];
        const tag = tags[0];
        
        if (!folders[tag]) {
          folders[tag] = {
            name: tag,
            description: `${tag} endpoints`,
            item: []
          };
        }
        
        // Create request
        const request = {
          name: operation.summary || `${method.toUpperCase()} ${path}`,
          request: {
            method: method.toUpperCase(),
            header: [
              {
                key: 'Content-Type',
                value: 'application/json',
                type: 'text'
              }
            ],
            url: {
              raw: `{{baseUrl}}${path}`,
              host: ['{{baseUrl}}'],
              path: path.split('/').filter(p => p).map(segment => {
                if (segment.startsWith(':') || (segment.startsWith('{') && segment.endsWith('}'))) {
                  const paramName = segment.replace(/[:{}]/g, '');
                  return `:${paramName}`;
                }
                return segment;
              })
            },
            description: operation.description
          }
        };
        
        // Add query parameters
        if (operation.parameters) {
          const queryParams = operation.parameters
            .filter(p => p.in === 'query')
            .map(p => ({
              key: p.name,
              value: p.example || '',
              description: p.description,
              disabled: !p.required
            }));
          
          if (queryParams.length > 0) {
            request.request.url.query = queryParams;
          }
          
          // Add path variables
          const pathParams = operation.parameters
            .filter(p => p.in === 'path')
            .map(p => ({
              key: p.name,
              value: p.example || `{{${p.name}}}`,
              description: p.description
            }));
          
          if (pathParams.length > 0) {
            request.request.url.variable = pathParams;
          }
        }
        
        // Add request body
        if (operation.requestBody && operation.requestBody.content) {
          const jsonContent = operation.requestBody.content['application/json'];
          if (jsonContent && jsonContent.schema) {
            request.request.body = {
              mode: 'raw',
              raw: JSON.stringify(generateExample(jsonContent.schema, openApiSpec), null, 2),
              options: {
                raw: {
                  language: 'json'
                }
              }
            };
          }
        }
        
        // Add to folder
        folders[tag].item.push(request);
      }
    }
    
    // Add auth folder
    folders['Authentication'] = {
      name: 'Authentication',
      description: 'Authentication endpoints',
      item: [
        {
          name: 'Login',
          event: [
            {
              listen: 'test',
              script: {
                exec: [
                  'if (pm.response.code === 200) {',
                  '    const response = pm.response.json();',
                  '    pm.collectionVariables.set("token", response.token);',
                  '    console.log("Token saved:", response.token);',
                  '}'
                ],
                type: 'text/javascript'
              }
            }
          ],
          request: {
            auth: {
              type: 'noauth'
            },
            method: 'POST',
            header: [
              {
                key: 'Content-Type',
                value: 'application/json',
                type: 'text'
              }
            ],
            body: {
              mode: 'raw',
              raw: JSON.stringify({
                username: 'admin',
                password: 'admin123'
              }, null, 2)
            },
            url: {
              raw: '{{baseUrl}}/api/auth/login',
              host: ['{{baseUrl}}'],
              path: ['api', 'auth', 'login']
            }
          }
        }
      ]
    };
    
    // Add folders to collection
    collection.item = Object.values(folders);
    
    // Save collection
    await writeFile(outputPath, JSON.stringify(collection, null, 2));
    
    console.log(`✅ Postman collection saved to: ${outputPath}`);
    console.log('\nTo use:');
    console.log('1. Import the collection into Postman');
    console.log('2. Set the "baseUrl" variable in the collection');
    console.log('3. Run the "Login" request first to get a token');
    console.log('4. The token will be automatically saved and used for other requests');
    
  } catch (error) {
    console.error('❌ Error generating Postman collection:', error.message);
    process.exit(1);
  }
}

/**
 * Generate example from OpenAPI schema
 */
function generateExample(schema, spec) {
  if (schema.$ref) {
    const refPath = schema.$ref.split('/').slice(1);
    let refSchema = spec;
    for (const part of refPath) {
      refSchema = refSchema[part];
    }
    return generateExample(refSchema, spec);
  }
  
  if (schema.example !== undefined) {
    return schema.example;
  }
  
  switch (schema.type) {
    case 'object':
      const obj = {};
      if (schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          obj[key] = generateExample(prop, spec);
        }
      }
      return obj;
      
    case 'array':
      return [generateExample(schema.items, spec)];
      
    case 'string':
      if (schema.enum) return schema.enum[0];
      if (schema.format === 'date-time') return new Date().toISOString();
      if (schema.format === 'uuid') return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
      if (schema.format === 'email') return 'user@example.com';
      return schema.example || 'string';
      
    case 'number':
    case 'integer':
      return schema.example || 0;
      
    case 'boolean':
      return schema.example || true;
      
    default:
      return null;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generatePostmanCollection();
}
#!/usr/bin/env node

/**
 * Demonstration du système d'intégration robuste
 * Montre les nouvelles fonctionnalités : auto-détection ports, validation santé, résolution conflits
 */

import fetch from 'node-fetch';

const AUTOWEAVE_API = process.env.AUTOWEAVE_API || 'http://localhost:3001';

/**
 * Démo de l'auto-détection des ports
 */
async function demoAutoPortDetection() {
  console.log('\n🔍 Démo: Auto-détection des ports');
  console.log('=' .repeat(50));
  
  try {
    const loginRes = await fetch(`${AUTOWEAVE_API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const { token } = await loginRes.json();
    
    // Test avec port auto-détecté
    const response = await fetch(`${AUTOWEAVE_API}/api/integration/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'service-auto-port',
        type: 'api-service',
        config: {
          apiUrl: 'http://localhost',
          autoDetectPort: true,  // 🚀 Nouvelle fonctionnalité
          skipHealthCheck: true
        }
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Service enregistré avec port auto-détecté');
      console.log(`   ID: ${result.integrationId}`);
      return result.integrationId;
    } else {
      const error = await response.text();
      console.log('❌ Échec:', error);
    }
  } catch (error) {
    console.log('❌ Erreur:', error.message);
  }
}

/**
 * Démo de validation de santé robuste
 */
async function demoHealthValidation() {
  console.log('\n🏥 Démo: Validation de santé robuste');
  console.log('=' .repeat(50));
  
  try {
    const loginRes = await fetch(`${AUTOWEAVE_API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const { token } = await loginRes.json();
    
    // Test avec service existant (Claude Code UI)
    const response = await fetch(`${AUTOWEAVE_API}/api/integration/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'claude-ui-with-health',
        type: 'development-tool',
        config: {
          apiUrl: 'http://localhost:3008',
          skipHealthCheck: false  // 🚀 Validation obligatoire
        }
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Service validé et enregistré');
      console.log(`   ID: ${result.integrationId}`);
      return result.integrationId;
    } else {
      const error = await response.text();
      console.log('❌ Validation échouée:', error);
    }
  } catch (error) {
    console.log('❌ Erreur:', error.message);
  }
}

/**
 * Démo de résolution de conflits de ports
 */
async function demoPortConflictResolution() {
  console.log('\n⚔️  Démo: Résolution de conflits de ports');
  console.log('=' .repeat(50));
  
  try {
    const loginRes = await fetch(`${AUTOWEAVE_API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const { token } = await loginRes.json();
    
    // Essayer d'utiliser le port 3008 (déjà occupé par Claude Code UI)
    const response = await fetch(`${AUTOWEAVE_API}/api/integration/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'service-conflict-port',
        type: 'web-ui',
        config: {
          apiUrl: 'http://localhost:3008',  // Port en conflit
          port: 3008,
          skipHealthCheck: true
        }
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Conflit de port résolu automatiquement');
      console.log(`   ID: ${result.integrationId}`);
      return result.integrationId;
    } else {
      const error = await response.text();
      console.log('❌ Résolution échouée:', error);
    }
  } catch (error) {
    console.log('❌ Erreur:', error.message);
  }
}

/**
 * Démo de support étendu des types
 */
async function demoExtendedTypeSupport() {
  console.log('\n🎯 Démo: Support étendu des types d\'intégration');
  console.log('=' .repeat(50));
  
  const types = [
    { type: 'web-ui', name: 'interface-utilisateur' },
    { type: 'development-tool', name: 'outil-dev' },
    { type: 'api-service', name: 'service-api' },
    { type: 'database', name: 'base-donnees' },
    { type: 'message-queue', name: 'file-messages' }
  ];
  
  try {
    const loginRes = await fetch(`${AUTOWEAVE_API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const { token } = await loginRes.json();
    
    for (const { type, name } of types) {
      try {
        let config = { skipHealthCheck: true };
        
        // Configuration spécifique par type
        switch (type) {
          case 'database':
            config = { host: 'localhost', port: 5432, skipHealthCheck: true };
            break;
          case 'message-queue':
            config = { host: 'localhost', port: 5672, skipHealthCheck: true };
            break;
          default:
            config = { apiUrl: 'http://localhost:8000', skipHealthCheck: true };
        }
        
        const response = await fetch(`${AUTOWEAVE_API}/api/integration/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: `demo-${name}`,
            type,
            config
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log(`✅ Type '${type}' supporté - ID: ${result.integrationId}`);
        } else {
          console.log(`❌ Type '${type}' échoué`);
        }
      } catch (error) {
        console.log(`❌ Type '${type}' erreur:`, error.message);
      }
    }
  } catch (error) {
    console.log('❌ Erreur globale:', error.message);
  }
}

/**
 * Lister toutes les intégrations enregistrées
 */
async function listIntegrations() {
  console.log('\n📋 Intégrations enregistrées');
  console.log('=' .repeat(50));
  
  try {
    const response = await fetch(`${AUTOWEAVE_API}/api/integration/list`);
    
    if (response.ok) {
      const integrations = await response.json();
      
      if (integrations.length === 0) {
        console.log('Aucune intégration trouvée');
      } else {
        integrations.forEach((integration, index) => {
          console.log(`${index + 1}. ${integration.name} (${integration.type})`);
          console.log(`   ID: ${integration.id}`);
          console.log(`   Status: ${integration.status}`);
          console.log(`   Santé: ${integration.healthStatus || 'unknown'}`);
          if (integration.portConflictResolved) {
            console.log(`   ⚠️  Port conflit résolu: ${integration.config.originalPort} → ${integration.config.port}`);
          }
          console.log('');
        });
      }
    } else {
      console.log('❌ Impossible de lister les intégrations');
    }
  } catch (error) {
    console.log('❌ Erreur:', error.message);
  }
}

/**
 * Exécution de la démo complète
 */
async function runDemo() {
  console.log('🚀 DÉMO DU SYSTÈME D\'INTÉGRATION ROBUSTE');
  console.log('═'.repeat(60));
  console.log('Nouvelles fonctionnalités :');
  console.log('• Auto-détection des ports disponibles');
  console.log('• Validation de santé préalable');
  console.log('• Résolution automatique des conflits');
  console.log('• Support étendu des types d\'intégration');
  console.log('• Monitoring de santé en temps réel');
  console.log('═'.repeat(60));
  
  // Attendre que le backend soit prêt
  console.log('\n⏳ Vérification de la disponibilité du backend...');
  try {
    const healthRes = await fetch(`${AUTOWEAVE_API}/health`);
    if (!healthRes.ok) {
      throw new Error('Backend non disponible');
    }
    console.log('✅ Backend AutoWeave disponible');
  } catch (error) {
    console.log('❌ Backend non disponible:', error.message);
    console.log('\n💡 Assurez-vous que AutoWeave Backend est démarré :');
    console.log('   npm run dev:quick');
    return;
  }
  
  // Exécuter les démos
  await demoAutoPortDetection();
  await demoHealthValidation();
  await demoPortConflictResolution();
  await demoExtendedTypeSupport();
  await listIntegrations();
  
  console.log('\n🎉 Démo terminée !');
  console.log('\n📈 Améliorations apportées au module :');
  console.log('• ✅ 8 types d\'intégration supportés (vs 5 avant)');
  console.log('• ✅ Auto-détection ports avec range 3000-9999');
  console.log('• ✅ Validation santé avec retry automatique');
  console.log('• ✅ Résolution conflits avec ports alternatifs');
  console.log('• ✅ Configuration flexible par type');
  console.log('• ✅ Monitoring santé temps réel');
  console.log('• ✅ Métriques détaillées par intégration');
  console.log('• ✅ Support mode développement/production');
}

// Lancer la démo
runDemo().catch(error => {
  console.error('❌ Démo échouée:', error.message);
  process.exit(1);
});
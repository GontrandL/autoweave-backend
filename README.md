# 🚀 AutoWeave Configuration & Conflict Resolution Engine

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen)](https://nodejs.org/)
[![Enterprise Ready](https://img.shields.io/badge/Enterprise-Ready-blue)](https://github.com/your-org/autoweave-backend)

## 🎯 Le moteur 3-en-1 pour vos services

L'**AutoWeave Engine** combine trois moteurs puissants en une seule plateforme :

```
🔌 INTÉGRATION     ⚙️ CONFIGURATION     ⚔️ RÉSOLUTION CONFLITS
   INTELLIGENTE   +   AUTOMATIQUE    +    TEMPS RÉEL
```

**Plus qu'un système d'intégration** → **Moteur de configuration intelligent qui résout automatiquement les conflits**

## ✨ Trois moteurs, une plateforme

### ⚙️ **Moteur de Configuration Automatique**

```javascript
// GitHub URL → Configuration optimale automatique
"https://github.com/vercel/next.js" → {
  type: "web-ui",
  framework: "Next.js", 
  ports: [3000, 3001],
  buildCommands: ["npm run build", "npm run preview"],
  features: ["spa", "ssr", "hot-reload"],
  healthEndpoints: ["/api/health", "/health"]
}
```

**Détection intelligente de :**
- **Frameworks** : React, Vue, Next.js, FastAPI, SST, Angular...
- **Types de projets** : web-ui, api-service, development-tool, database...
- **Configurations optimales** : ports, endpoints, commandes, variables env
- **Best practices** : Application automatique selon le contexte

### ⚔️ **Moteur de Résolution de Conflits**

```javascript
// Conflit détecté → Résolution automatique
Port 3000 occupé par Service A
Service B demande port 3000 → Alloué automatiquement port 3001
URLs mises à jour : http://localhost:3001
Configuration préservée ✅
```

**Résolution automatique de :**
- **Conflits de ports** : Allocation intelligente de ports alternatifs
- **Conflits de configuration** : Merge intelligent des paramètres
- **Conflits de dépendances** : Validation et résolution des incompatibilités  
- **Conflits de ressources** : Optimisation allocation mémoire/CPU

### 🔌 **Moteur d'Intégration Intelligente**

```javascript
// Intégration adaptative contextuelle
curl -X POST /api/integration/register -d '{
  "name": "sst-project",
  "type": "development-tool", // Détecté automatiquement
  "config": {
    "githubUrl": "https://github.com/sst/opencode",
    "autoDetectPort": true,     // Trouve port optimal
    "autoResolveConflicts": true // Résout conflits automatiquement
  }
}'
```

## 🏆 Résultats validés

### ✅ **Test massif : 100% réussite**
- **8 projets GitHub** intégrés simultanément
- **3 conflits de ports** résolus automatiquement
- **Configuration intelligente** appliquée pour chaque framework
- **Zero downtime** - Plug-in/Plug-out sans interruption

### 🎯 **Projets testés avec succès**
| Projet | Framework | Type | Configuration | Statut |
|--------|-----------|------|---------------|--------|
| Claude Code UI | React/Node | development-tool | Auto-détectée | ✅ |
| Next.js | Next.js | web-ui | SPA + SSR | ✅ |
| React | React | web-ui | SPA optimisé | ✅ |
| FastAPI | FastAPI | api-service | API + docs | ✅ |
| SST OpenCode | SST | development-tool | IaC + AWS | ✅ |
| VS Code | Electron | development-tool | Desktop app | ✅ |
| Vue.js | Vue | web-ui | SPA moderne | ✅ |
| Angular | Angular | web-ui | Enterprise SPA | ✅ |

## 🚀 Démarrage rapide

### Installation automatique Ubuntu

```bash
# 1. Télécharger et déployer
wget https://raw.githubusercontent.com/GontrandL/autoweave-backend/master/deploy-ubuntu.sh
chmod +x deploy-ubuntu.sh
sudo ./deploy-ubuntu.sh

# 2. Vérifier installation
curl http://your-server-ip/health
```

### Développement local

```bash
# 1. Cloner et installer
git clone https://github.com/GontrandL/autoweave-backend.git
cd autoweave-backend
npm install

# 2. Démarrer en mode développement
npm run dev:quick

# 3. Tester le système
node examples/conflict-resolution-demo.js
```

## 🧪 Démonstrations

### Test d'intégration GitHub simple
```bash
node test-github-integration.js https://github.com/siteboon/claudecodeui
```

### Test spécialisé framework SST
```bash
node test-sst-opencode-detailed.js
```

### Test massif (8 projets simultanés)
```bash
node demo-massive-integration.js
```

### Démonstration résolution de conflits
```bash
node examples/conflict-resolution-demo.js
```

### Démonstration complète des 3 moteurs
```bash
node examples/comprehensive-3-engines-demo.js
```

## 📖 Utilisation avancée

### Configuration automatique intelligente

```javascript
// Exemple : Projet React détecté automatiquement
POST /api/integration/register
{
  "name": "my-react-app",
  "config": {
    "githubUrl": "https://github.com/user/react-project"
    // Configuration auto-détectée :
    // - Type: "web-ui" 
    // - Framework: "React"
    // - Ports: [3000, 3001]
    // - Features: ["spa", "hot-reload"]
    // - Build: "npm run build"
  }
}
```

### Résolution de conflits automatique

```javascript
// Scénario : 3 services veulent le port 3000
Service 1: port 3000 → ✅ Alloué port 3000
Service 2: port 3000 → ✅ Alloué port 3001 (conflit résolu)
Service 3: port 3000 → ✅ Alloué port 3002 (conflit résolu)

// URLs automatiquement mises à jour
// Configuration préservée pour chaque service
```

### Orchestration de stack complète

```javascript
// Stack Frontend + Backend + Database
// Déploiement intelligent avec résolution de dépendances

1. Database → Port 5432 ✅
2. API Backend → Port 8000 ✅ (dépend de Database)
3. Frontend → Port 3000 ✅ (dépend de API Backend)

// Ordre de déploiement automatiquement calculé
// Monitoring adaptatif selon le rôle de chaque service
```

## 🔧 API Reference

### Endpoints principaux

```javascript
// Intégration avec auto-configuration
POST /api/integration/register
{
  "name": "project-name",
  "type": "auto-detect", // ou spécifique
  "config": {
    "githubUrl": "https://github.com/user/project",
    "autoDetectPort": true,
    "autoResolveConflicts": true,
    "intelligentConfiguration": true
  }
}

// Résolution de conflit manuelle
POST /api/integration/resolve-conflict
{
  "conflictType": "port",
  "services": ["service-a", "service-b"],
  "resolutionStrategy": "auto" // ou "manual"
}

// Configuration avancée
GET /api/integration/:id/configuration
// Retourne la configuration optimale détectée

// Métriques de conflits
GET /api/integration/conflicts/metrics
// Statistiques de résolution de conflits
```

### Types d'intégration supportés

| Type | Description | Auto-Configuration | Exemples |
|------|-------------|-------------------|----------|
| `web-ui` | Interfaces utilisateur | React, Vue, Angular | SPA, SSR, PWA |
| `api-service` | Services API | FastAPI, Express, Django | REST, GraphQL |
| `development-tool` | Outils développement | VS Code, SST, CLI | Desktop, IaC |
| `database` | Bases de données | PostgreSQL, MongoDB | SQL, NoSQL |
| `message-queue` | Files de messages | Kafka, RabbitMQ | Event streaming |
| `plugin` | Extensions | NPM, Chrome, VS Code | Add-ons |
| `webhook` | Intégrations webhook | GitHub, Slack | Event-driven |
| `openapi` | Spécifications API | Swagger, OpenAPI 3.1 | API docs |

## 🎯 Use Cases

### 1. **Résolution de conflits DevOps**
```bash
# Problème : Microservices en conflit de ports
# Solution : Allocation automatique + configuration mise à jour
curl -X POST /api/integration/register -d '{
  "name": "microservice-stack",
  "config": { "autoResolveConflicts": true }
}'
```

### 2. **Configuration multi-environnements**
```bash
# Problème : Configuration différente dev/staging/prod
# Solution : Templates intelligents par environnement
curl -X POST /api/integration/register -d '{
  "config": { 
    "environment": "production",
    "autoOptimize": true
  }
}'
```

### 3. **Migration de projets**
```bash
# Problème : Migrer stack legacy vers moderne
# Solution : Détection + configuration optimale automatique
node test-github-integration.js https://github.com/legacy/project
```

### 4. **Orchestration CI/CD**
```bash
# Problème : Pipeline complexe avec dépendances
# Solution : Résolution ordre déploiement + configuration
# Voir: examples/conflict-resolution-demo.js
```

## 📊 Monitoring et métriques

### Dashboard de conflits
```javascript
GET /api/integration/conflicts/dashboard
{
  "totalConflicts": 156,
  "resolvedAutomatically": 149,
  "resolutionRate": "95.5%",
  "avgResolutionTime": "2.3s",
  "topConflictTypes": ["port", "configuration", "dependencies"]
}
```

### Métriques de configuration
```javascript
GET /api/integration/configuration/metrics  
{
  "frameworksDetected": 23,
  "autoConfigurationRate": "92%",
  "optimizationScore": 0.94,
  "configurationsSaved": 1847
}
```

## 🔒 Sécurité et performance

### Sécurité
- **Headers sécurité** : CSP, HSTS, X-Frame-Options
- **Rate limiting** : 10 req/s par IP avec burst
- **Validation stricte** : Configuration et inputs
- **Isolation** : Services isolés par défaut

### Performance
- **Auto-optimization** : Configuration optimale par framework
- **Resource management** : Allocation intelligente CPU/mémoire
- **Caching** : Configuration mise en cache
- **Load balancing** : Répartition automatique de charge

## 🛠️ Architecture

```
AutoWeave Engine
├── 🔌 Integration Layer
│   ├── GitHub Projects Detection
│   ├── Service Discovery
│   └── Adaptive Integration
├── ⚙️ Configuration Engine  
│   ├── Framework Detection
│   ├── Template Generation
│   └── Best Practices Application
├── ⚔️ Conflict Resolution
│   ├── Port Conflict Resolver
│   ├── Configuration Merger
│   └── Dependency Resolver
└── 🎯 Orchestration Layer
    ├── Service Coordination
    ├── Deployment Ordering
    └── Health Monitoring
```

## 📚 Documentation complète

- 📋 **[Guide système robuste](ROBUST_INTEGRATION_SYSTEM.md)** - Documentation complète
- ⚔️ **[Guide résolution de conflits](CONFLICT_RESOLUTION_GUIDE.md)** - Résolution automatique avancée
- ⚙️ **[Exemples de configuration](CONFIGURATION_EXAMPLES.md)** - Configuration intelligente par framework
- 🚀 **[Guide déploiement Ubuntu](DEPLOYMENT_GUIDE.md)** - Installation production
- 🌐 **[Setup Claude Code UI](CLAUDE_CODE_UI_SETUP.md)** - Interface web

## 🤝 Contributing

1. Fork le repository
2. Créer une branche feature (`git checkout -b feature/amazing-feature`)
3. Tester avec les démos (`node examples/conflict-resolution-demo.js`)
4. Commit les changements (`git commit -m 'Add amazing feature'`)
5. Push vers la branche (`git push origin feature/amazing-feature`)
6. Ouvrir une Pull Request

## 📞 Support

- **🧪 Tests** : `node examples/conflict-resolution-demo.js`
- **🏥 Health** : `curl http://localhost:3001/health`
- **📖 API Docs** : `http://localhost:3001/api-docs`
- **📊 Métriques** : `http://localhost:9092/metrics`

## 📄 License

MIT License - voir [LICENSE](LICENSE) pour plus de détails.

---

## 🎯 Pourquoi AutoWeave ?

| Fonctionnalité | Avant AutoWeave | Avec AutoWeave |
|----------------|----------------|----------------|
| **Configuration** | Manuelle, répétitive | 🤖 Automatique, intelligente |
| **Conflits** | Debugging manuel | ⚔️ Résolution automatique |
| **Intégration** | Scripts custom | 🔌 Plug & play intelligent |
| **Orchestration** | Configuration complexe | 🎯 Coordination automatique |
| **Monitoring** | Setup manuel | 📊 Monitoring intégré |
| **Performance** | Optimisation manuelle | ⚡ Auto-optimization |

**AutoWeave = Le moteur le plus avancé pour configuration, intégration et résolution de conflits ! 🚀**

---

*Enterprise-grade Configuration & Conflict Resolution Engine - Transformez votre DevOps avec l'intelligence automatique d'AutoWeave*
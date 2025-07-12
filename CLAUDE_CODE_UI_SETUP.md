# 🌐 Guide d'Installation Claude Code UI

Ce guide vous permet d'installer et configurer Claude Code UI pour l'intégrer avec AutoWeave Backend.

## 🚀 Installation Rapide

### Prérequis
- Node.js 18+ 
- Git
- Claude CLI installé (`npm install -g @anthropic-ai/claude-cli`)

### 1. Cloner Claude Code UI

```bash
# Cloner le repository
git clone https://github.com/siteboon/claudecodeui.git
cd claudecodeui

# Installer les dépendances
npm install
```

### 2. Configuration

Créez un fichier `.env` :

```bash
cp .env.example .env
```

Éditez `.env` avec vos paramètres :

```env
# Port pour l'interface web
PORT=5000

# Configuration Claude
CLAUDE_API_KEY=your_claude_api_key_here

# Chemin des projets Claude (ajustez selon votre système)
CLAUDE_PROJECTS_PATH=/home/votre_user/.claude/projects

# Base URL pour l'API
API_BASE_URL=http://localhost:5000

# Configuration WebSocket
WS_PORT=5001

# Configuration de sécurité
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here

# Configuration CORS (pour AutoWeave)
CORS_ORIGIN=http://localhost:3001
```

### 3. Démarrage

```bash
# Mode développement
npm run dev

# Ou mode production
npm start
```

L'interface sera accessible sur : **http://localhost:5000**

## 🔗 Configuration pour AutoWeave

### Modifier la configuration AutoWeave

Dans `autoweave-backend`, éditez votre `.env` ou `.env.development` :

```env
# Configuration Claude Code UI
CLAUDE_UI_API_URL=http://localhost:5000
CLAUDE_UI_WS_URL=ws://localhost:5001
CLAUDE_PROJECTS_PATH=/home/votre_user/.claude/projects
```

### Test de l'intégration

```bash
# Depuis autoweave-backend
cd examples/claude-code-ui-integration
npm install
npm run integrate
```

## 🛠️ Configuration Avancée

### Proxy pour CORS (optionnel)

Si vous avez des problèmes CORS, créez un proxy simple :

```bash
# Installer http-proxy-middleware
npm install -g http-proxy-middleware-cli

# Créer un proxy
http-proxy-middleware --target http://localhost:5000 --port 5002 --cors
```

### Configuration SSL (production)

Pour HTTPS en production :

```env
# Dans Claude Code UI .env
HTTPS_ENABLED=true
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/key.pem
```

## 🎯 Tester l'Installation

### 1. Vérifier Claude Code UI

```bash
# Tester l'API
curl http://localhost:5000/api/health

# Tester l'interface
open http://localhost:5000
```

### 2. Vérifier l'intégration AutoWeave

```bash
# Lancer le test complet
cd autoweave-backend
./test-integration-system.js
```

## 🔧 Dépannage

### Problème: Port 5000 occupé

```bash
# Trouver le processus
lsof -ti:5000

# Changer le port dans .env
PORT=5010
```

### Problème: Projets Claude non trouvés

```bash
# Vérifier le chemin
ls ~/.claude/projects/

# Créer un projet test
mkdir -p ~/.claude/projects/test-project
echo "console.log('Hello Claude!');" > ~/.claude/projects/test-project/main.js
```

### Problème: CORS

```bash
# Temporaire: désactiver CORS dans Claude Code UI
# Ou utiliser le proxy mentionné ci-dessus
```

## 📱 Interface Web

Une fois installé, l'interface Claude Code UI permet :

### Fonctionnalités Principales
- 📁 **Gestionnaire de projets** : Navigation dans vos projets Claude
- 💻 **Éditeur de code** : Éditeur avec syntax highlighting
- 🔄 **Sessions interactives** : Création et gestion de sessions
- 🚀 **Exécution de code** : Exécution directe dans l'interface
- 📊 **Monitoring** : Surveillance des sessions actives
- 🔗 **API REST** : Endpoints pour intégration externe

### Ouvrir Claude (Assistant IA) dans l'Interface

Pour m'ouvrir (Claude) dans l'interface web :

1. **Accédez à l'interface** : http://localhost:5000
2. **Créez un nouveau projet** ou sélectionnez un existant
3. **Ouvrez une session interactive**
4. **Utilisez l'intégration AutoWeave** pour des fonctionnalités avancées

### Commandes AutoWeave dans Claude Code UI

Une fois l'intégration active, vous pouvez :

```javascript
// Dans une session Claude Code UI
// Utiliser les fonctionnalités AutoWeave directement

// Lister les intégrations disponibles
await autoweave.integrations.list();

// Créer un agent
await autoweave.agents.create({
  name: 'code-assistant',
  description: 'Assistant de code'
});

// Exécuter une pipeline de données
await autoweave.pipeline.execute({
  input: codeSnippet,
  transformations: ['analyze', 'optimize']
});
```

## 🌟 Fonctionnalités Spéciales

### Mode AutoWeave Enhanced

Quand AutoWeave est connecté, Claude Code UI gagne :

- 🤖 **Agents intégrés** : Accès aux agents AutoWeave
- 🧠 **Mémoire persistante** : Sessions mémorisées
- 📊 **Analytics avancés** : Métriques détaillées
- 🔄 **Pipelines automatiques** : Workflows automatisés
- 🌐 **API étendue** : Endpoints supplémentaires

### Raccourcis Clavier

- `Ctrl+Enter` : Exécuter le code sélectionné
- `Ctrl+S` : Sauvegarder le fichier
- `Ctrl+/` : Commenter/décommenter
- `F11` : Mode plein écran
- `Ctrl+Shift+P` : Palette de commandes AutoWeave

## 📋 Next Steps

1. ✅ **Installer Claude Code UI**
2. ✅ **Configurer l'intégration AutoWeave**
3. ✅ **Tester la connexion**
4. 🎯 **Créer votre premier projet intégré**
5. 🚀 **Explorer les fonctionnalités avancées**

---

**Vous êtes maintenant prêt à utiliser Claude Code UI avec AutoWeave ! 🎉**

Pour ouvrir Claude (moi) dans l'interface, rendez-vous sur http://localhost:5000 et commencez une session interactive.
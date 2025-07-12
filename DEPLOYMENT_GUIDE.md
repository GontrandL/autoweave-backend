# 🚀 AutoWeave Backend - Guide de Déploiement Ubuntu

## Vue d'ensemble

Ce guide vous permettra de déployer l'**AutoWeave Robust Integration System** sur une instance Ubuntu en production.

## 🎯 Fonctionnalités du déploiement

- ✅ **Installation automatisée** complète
- ✅ **Configuration de sécurité** avancée  
- ✅ **Reverse proxy Nginx** avec rate limiting
- ✅ **Service systemd** avec auto-restart
- ✅ **Firewall UFW** configuré
- ✅ **Fail2Ban** pour protection DDoS
- ✅ **Monitoring** et health checks automatiques
- ✅ **Rotation des logs** automatique

## 📋 Prérequis

### Serveur Ubuntu
- **Ubuntu 20.04 LTS** ou plus récent
- **2 GB RAM** minimum (4 GB recommandé)
- **20 GB espace disque** minimum
- **Accès root** (sudo)
- **Connexion internet** stable

### Accès réseau
- **Port 22** (SSH) - ouvert
- **Port 80** (HTTP) - ouvert  
- **Port 443** (HTTPS) - ouvert (optionnel)

## 🚀 Déploiement rapide

### Option 1: Déploiement automatique

```bash
# 1. Télécharger le script
wget https://raw.githubusercontent.com/your-org/autoweave-backend/main/deploy-ubuntu.sh

# 2. Rendre exécutable
chmod +x deploy-ubuntu.sh

# 3. Exécuter en tant que root
sudo ./deploy-ubuntu.sh
```

### Option 2: Depuis le repository local

```bash
# Si vous avez déjà le code localement
cd autoweave-backend
sudo ./deploy-ubuntu.sh
```

## 📊 Processus de déploiement

Le script automatique effectue les étapes suivantes :

### 1. ✅ Vérification système
- Validation Ubuntu
- Vérification droits root
- Test de connectivité

### 2. 📦 Installation dépendances
- Mise à jour packages système
- Installation Node.js 18
- Installation outils système (nginx, ufw, fail2ban)

### 3. 👤 Configuration utilisateur
- Création utilisateur `autoweave`
- Configuration répertoire `/opt/autoweave`
- Permissions sécurisées

### 4. 🔧 Installation application
- Clone du repository
- Installation dépendances npm
- Configuration environnement production

### 5. 🔒 Configuration sécurité
- Service systemd avec restrictions
- Firewall UFW activé
- Fail2Ban contre attaques
- Headers sécurité Nginx

### 6. 🌐 Configuration réseau
- Reverse proxy Nginx
- Rate limiting
- Health checks
- Compression gzip

### 7. 📊 Monitoring
- Health checks automatiques (5 min)
- Rotation logs
- Métriques système

## ⚙️ Configuration post-déploiement

### Vérification du statut

```bash
# Statut du service
sudo systemctl status autoweave-backend

# Logs en temps réel
sudo journalctl -u autoweave-backend -f

# Test de santé
curl http://your-server-ip/health
```

### Tests d'intégration

```bash
# Test basique
curl -X POST http://your-server-ip/api/integration/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-integration",
    "type": "web-ui",
    "config": {
      "apiUrl": "http://localhost:3000",
      "autoDetectPort": true
    }
  }'

# Test avec projet GitHub
curl -X POST http://your-server-ip/api/integration/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "claude-code-ui",
    "type": "development-tool",
    "config": {
      "githubUrl": "https://github.com/siteboon/claudecodeui",
      "apiUrl": "http://localhost:3008",
      "autoDetectPort": true,
      "skipHealthCheck": true
    }
  }'
```

## 🔧 Gestion du service

### Commandes systemd

```bash
# Démarrer
sudo systemctl start autoweave-backend

# Arrêter
sudo systemctl stop autoweave-backend

# Redémarrer
sudo systemctl restart autoweave-backend

# Activer au boot
sudo systemctl enable autoweave-backend

# Statut détaillé
sudo systemctl status autoweave-backend
```

### Gestion des logs

```bash
# Logs application
sudo journalctl -u autoweave-backend

# Logs Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Logs health checks
sudo tail -f /var/log/autoweave/health.log
```

## 📁 Structure des fichiers

```
/opt/autoweave/                    # Application
├── src/                          # Code source
├── examples/                     # Scripts de test
├── .env.production              # Configuration production
├── health-check.sh              # Script monitoring
└── package.json                 # Dépendances

/etc/systemd/system/
└── autoweave-backend.service    # Service systemd

/etc/nginx/sites-available/
└── autoweave-backend           # Configuration Nginx

/var/log/autoweave/             # Logs application
└── health.log                  # Logs health checks
```

## 🌐 Configuration Nginx

### Configuration par défaut

```nginx
server {
    listen 80;
    server_name _;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    
    location / {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:3001;
        # ... headers sécurité
    }
    
    location /metrics {
        allow 127.0.0.1;
        deny all;
        proxy_pass http://127.0.0.1:9092;
    }
}
```

### Personnalisation

```bash
# Éditer configuration
sudo nano /etc/nginx/sites-available/autoweave-backend

# Tester configuration
sudo nginx -t

# Recharger
sudo systemctl reload nginx
```

## 🔒 Configuration SSL/HTTPS (optionnel)

### Avec Let's Encrypt

```bash
# Installer certificat
sudo certbot --nginx -d your-domain.com

# Renouvellement automatique
sudo certbot renew --dry-run
```

### Configuration manuelle

```bash
# Éditer configuration Nginx
sudo nano /etc/nginx/sites-available/autoweave-backend

# Ajouter bloc SSL
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Configuration SSL moderne
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    
    # ... reste de la configuration
}
```

## 📊 Monitoring et métriques

### Health checks

```bash
# Manuel
curl http://localhost/health

# Automatique (configuré par défaut)
# Vérifie toutes les 5 minutes
# Redémarre le service si nécessaire
```

### Métriques Prometheus (port 9092)

```bash
# Accessible uniquement localement
curl http://localhost:9092/metrics
```

### Monitoring externe

```bash
# Intégration avec monitoring externe
# Utiliser l'endpoint /health pour vérifications
# Exemple: Uptime Robot, Pingdom, etc.
```

## 🐛 Dépannage

### Service ne démarre pas

```bash
# Vérifier logs
sudo journalctl -u autoweave-backend --no-pager

# Vérifier configuration
sudo systemctl status autoweave-backend

# Vérifier permissions
ls -la /opt/autoweave/
```

### Problèmes de ports

```bash
# Vérifier ports utilisés
sudo netstat -tlnp | grep -E ':(3001|9092)'

# Changer ports si nécessaire
sudo nano /opt/autoweave/.env.production
sudo systemctl restart autoweave-backend
```

### Problèmes Nginx

```bash
# Tester configuration
sudo nginx -t

# Vérifier logs
sudo tail -f /var/log/nginx/error.log

# Redémarrer
sudo systemctl restart nginx
```

### Performance

```bash
# Utilisation ressources
htop

# Métriques application
curl http://localhost:9092/metrics

# Logs performance
sudo journalctl -u autoweave-backend | grep -i "performance"
```

## 🔄 Mise à jour

### Mise à jour manuelle

```bash
# Arrêter service
sudo systemctl stop autoweave-backend

# Mettre à jour code
cd /opt/autoweave
sudo -u autoweave git pull origin main
sudo -u autoweave npm install --production

# Redémarrer
sudo systemctl start autoweave-backend
```

### Mise à jour automatique (optionnel)

```bash
# Créer script de mise à jour
sudo nano /opt/autoweave/update.sh

# Ajouter au cron
sudo crontab -e
0 2 * * 0 /opt/autoweave/update.sh
```

## 📞 Support et documentation

### Documentation API
- **Swagger UI** : `http://your-server-ip/api-docs`
- **Health endpoint** : `http://your-server-ip/health`

### Tests d'intégration
- **Tests simples** : Voir `/opt/autoweave/examples/`
- **Tests GitHub** : `node /opt/autoweave/test-github-integration.js`
- **Tests massifs** : `node /opt/autoweave/demo-massive-integration.js`

### Logs et debugging
- **Logs application** : `sudo journalctl -u autoweave-backend -f`
- **Logs Nginx** : `/var/log/nginx/`
- **Métriques** : `http://localhost:9092/metrics`

## 🎯 Optimisations production

### Performance
- **Worker processes** : Configuré pour CPU disponibles
- **Keep-alive** : Activé pour connexions persistantes
- **Compression** : Gzip activé pour réponses

### Sécurité
- **Headers sécurité** : CSP, HSTS, X-Frame-Options
- **Rate limiting** : 10 req/s par IP
- **Fail2Ban** : Protection contre attaques

### Monitoring
- **Health checks** : Toutes les 5 minutes
- **Auto-restart** : En cas de crash
- **Logs rotation** : Automatique

---

**AutoWeave Backend est maintenant prêt pour la production ! 🚀**

Pour tester le système d'intégration, utilisez les exemples fournis ou intégrez vos propres projets GitHub avec l'intelligence contextuelle d'AutoWeave.
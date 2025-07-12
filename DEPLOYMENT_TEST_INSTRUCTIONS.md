# 🚀 Instructions de Test de Déploiement - AutoWeave Backend

**Destinataire** : Instance de test Ubuntu  
**Objectif** : Valider le déploiement complet et la production-readiness  
**Date de création** : $(date '+%Y-%m-%d %H:%M:%S')  
**Status** : ⏳ EN ATTENTE DE TESTS

---

## 📋 Checklist de Déploiement à Tester

### Phase 1: Installation et Configuration (20 min)
- [ ] **Prérequis système vérifiés**
  - Node.js 18.0.0+ installé
  - Docker et Docker Compose fonctionnels
  - Ports disponibles (3001, 3003, 9091, 9093, 9100)
  
- [ ] **Clone et installation**
  ```bash
  git clone <repo-url>
  cd autoweave-backend
  npm install
  ```
  
- [ ] **Configuration environnement**
  ```bash
  cp .env.example .env
  # Vérifier que .env contient les bonnes valeurs par défaut
  ```

### Phase 2: Démarrage des Services (15 min)
- [ ] **Démarrage backend principal**
  ```bash
  npm start
  # ✅ Doit démarrer sur http://localhost:3001
  # ✅ /health doit retourner {"status":"healthy"}
  # ✅ /api-docs doit être accessible
  ```

- [ ] **Démarrage monitoring**
  ```bash
  npm run monitoring:start
  # ✅ Prometheus: http://localhost:9091
  # ✅ Grafana: http://localhost:3003 (admin/admin123)
  # ✅ AlertManager: http://localhost:9093
  ```

### Phase 3: Tests d'API (25 min)
- [ ] **Test d'authentification**
  ```bash
  # Login avec utilisateur par défaut
  curl -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}'
  
  # ✅ Doit retourner un token JWT valide
  ```

- [ ] **Test quick-start example**
  ```bash
  cd examples/01-quick-start
  npm install
  # Modifier le token dans example.js avec celui obtenu
  npm start
  # ✅ Doit s'exécuter sans erreur et afficher "Quick start completed successfully!"
  ```

- [ ] **Test des services principaux**
  ```bash
  # Test service registration
  # Test analytics tracking
  # Test health endpoints
  # Utiliser les exemples dans examples/01-quick-start/
  ```

### Phase 4: Tests de Monitoring (15 min)
- [ ] **Vérification métriques Prometheus**
  ```bash
  curl http://localhost:3001/metrics
  # ✅ Doit retourner des métriques Prometheus formatées
  ```

- [ ] **Vérification dashboards Grafana**
  - Accéder à http://localhost:3003
  - Login admin/admin123
  - Vérifier "AutoWeave Backend Overview" dashboard
  - ✅ Les métriques doivent s'afficher

- [ ] **Test des alertes**
  - Vérifier http://localhost:9091/alerts
  - ✅ Les règles d'alerte doivent être chargées

### Phase 5: Tests d'Intégration (20 min)
- [ ] **Test authentification complète**
  ```bash
  cd examples/02-authentication
  npm install
  npm start
  # ✅ Doit tester JWT, API keys, et permissions
  ```

- [ ] **Test monitoring setup**
  ```bash
  cd examples/09-monitoring
  # Suivre les instructions du README
  # ✅ Métriques custom doivent apparaître
  ```

### Phase 6: Tests de Performance (10 min)
- [ ] **Load test basique**
  ```bash
  # Test de charge simple
  for i in {1..100}; do
    curl -s http://localhost:3001/health > /dev/null &
  done
  wait
  # ✅ Le système doit rester stable
  ```

- [ ] **Vérification ressources**
  ```bash
  docker stats
  # ✅ Utilisation CPU/mémoire raisonnable
  ```

---

## 🔍 Points Critiques à Vérifier

### Sécurité
- [ ] Mots de passe par défaut fonctionnels mais changés en production
- [ ] CORS configuré correctement
- [ ] Rate limiting actif
- [ ] Headers de sécurité présents

### Performance
- [ ] Temps de réponse API < 200ms pour /health
- [ ] Temps de démarrage < 30 secondes
- [ ] Utilisation mémoire < 512MB au démarrage
- [ ] Pas de fuites mémoire observées

### Stabilité
- [ ] Redémarrage graceful avec SIGTERM
- [ ] Gestion d'erreur appropriée
- [ ] Logs structurés et informatifs
- [ ] Services récupèrent après crash

### Documentation
- [ ] README.md clair et complet
- [ ] TUTORIAL.md fonctionnel
- [ ] Exemples exécutables sans modification
- [ ] API docs complètes et accessibles

---

## 📊 Rapport de Test à Compléter

### Informations Système
```
OS: [À compléter]
Node.js version: [À compléter]
Docker version: [À compléter]
RAM disponible: [À compléter]
CPU: [À compléter]
```

### Résultats des Tests

#### ✅ Tests Réussis
```
[Lister ici tous les tests qui ont passé]
```

#### ❌ Tests Échoués
```
[Lister ici tous les tests qui ont échoué avec détails]
```

#### ⚠️ Avertissements/Améliorations
```
[Lister ici les points d'attention ou suggestions]
```

### Métriques de Performance
```
Temps de démarrage backend: [X] secondes
Temps de démarrage monitoring: [X] secondes
Réponse moyenne /health: [X] ms
Utilisation mémoire au démarrage: [X] MB
Utilisation CPU au repos: [X] %
```

### Logs d'Erreurs (s'il y en a)
```
[Coller ici les logs d'erreur rencontrés]
```

---

## 💬 Communication de Retour

### 📁 Fichier de Rapport
**Créer ce fichier avec vos résultats** : `DEPLOYMENT_TEST_RESULTS.md`

### 📍 Emplacement du Rapport
**Placer le fichier ici** : `/home/gontrand/autoweave-repos/autoweave-backend/DEPLOYMENT_TEST_RESULTS.md`

### 📋 Template du Rapport de Résultats
```markdown
# Rapport de Test de Déploiement - AutoWeave Backend

**Testeur** : Instance Ubuntu Test
**Date de test** : [DATE]
**Durée totale** : [X] minutes
**Status global** : [✅ SUCCÈS / ❌ ÉCHEC / ⚠️ SUCCÈS AVEC RÉSERVES]

## Résumé Exécutif
[Résumé en 2-3 phrases de l'état général]

## Détails des Tests
[Copier et compléter chaque section de la checklist ci-dessus]

## Recommandations
[Vos suggestions d'amélioration]

## Validation Finale
- [ ] Le système est prêt pour la production
- [ ] Des modifications mineures sont nécessaires
- [ ] Des modifications importantes sont nécessaires
- [ ] Le système n'est pas prêt pour la production

**Signature** : Instance Ubuntu Test - [DATE]
```

---

## 🆘 Support et Escalation

### En cas de problème bloquant :
1. **Documenter l'erreur** dans le rapport
2. **Capturer les logs** : `docker-compose logs > error-logs.txt`
3. **Prendre des screenshots** si interface graphique
4. **Indiquer le contexte** (étape, commande, environnement)

### Informations à inclure pour debug :
```bash
# Informations système
uname -a
node --version
docker --version
docker-compose --version

# Status des services
docker ps
netstat -tlnp | grep -E ':(3001|3003|9091|9093|9100)'

# Logs récents
tail -n 50 logs/combined.log
```

---

## ⏰ Timeline Estimé

| Phase | Durée | Priorité |
|-------|-------|----------|
| Phase 1 | 20 min | Critique |
| Phase 2 | 15 min | Critique |
| Phase 3 | 25 min | Critique |
| Phase 4 | 15 min | Importante |
| Phase 5 | 20 min | Importante |
| Phase 6 | 10 min | Optionnelle |
| **Total** | **~105 min** | |

---

**🎯 Objectif : Valider que AutoWeave Backend est 100% production-ready !**

Bon test ! 🚀
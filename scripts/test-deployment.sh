#!/bin/bash

# AutoWeave Backend - Script de Test de Déploiement Automatisé
# Ce script aide à automatiser les tests de déploiement

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonctions utilitaires
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Variables
BACKEND_URL="http://localhost:3001"
GRAFANA_URL="http://localhost:3003"
PROMETHEUS_URL="http://localhost:9091"
TEST_RESULTS_FILE="DEPLOYMENT_TEST_RESULTS.md"
START_TIME=$(date +%s)

# Compteurs de tests
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

# Fonction pour exécuter un test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_result="$3"
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    log_info "Test $TESTS_TOTAL: $test_name"
    
    if eval "$test_command"; then
        log_success "$test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        echo "✅ $test_name" >> test_results_temp.txt
        return 0
    else
        log_error "$test_name"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo "❌ $test_name" >> test_results_temp.txt
        return 1
    fi
}

# Fonction pour vérifier les prérequis
check_prerequisites() {
    log_info "Vérification des prérequis système..."
    
    # Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        log_success "Node.js installé: $NODE_VERSION"
    else
        log_error "Node.js non installé"
        exit 1
    fi
    
    # Docker
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version)
        log_success "Docker installé: $DOCKER_VERSION"
    else
        log_error "Docker non installé"
        exit 1
    fi
    
    # Docker Compose
    if command -v docker-compose &> /dev/null; then
        COMPOSE_VERSION=$(docker-compose --version)
        log_success "Docker Compose installé: $COMPOSE_VERSION"
    else
        log_error "Docker Compose non installé"
        exit 1
    fi
    
    # Ports disponibles
    for port in 3001 3003 9091 9093 9100; do
        if ! netstat -tuln | grep ":$port " > /dev/null 2>&1; then
            log_success "Port $port disponible"
        else
            log_warning "Port $port déjà utilisé"
        fi
    done
}

# Fonction pour tester l'installation
test_installation() {
    log_info "Phase 1: Test d'installation..."
    
    run_test "Fichier package.json existe" "test -f package.json" ""
    run_test "node_modules installé" "test -d node_modules" ""
    run_test "Fichier .env existe" "test -f .env || test -f .env.example" ""
    run_test "Structure de répertoires" "test -d src && test -d examples && test -d monitoring" ""
}

# Fonction pour tester le démarrage des services
test_services_startup() {
    log_info "Phase 2: Test de démarrage des services..."
    
    # Attendre que le backend soit prêt
    log_info "Attente du démarrage du backend..."
    for i in {1..30}; do
        if curl -s "$BACKEND_URL/health" > /dev/null 2>&1; then
            break
        fi
        sleep 2
        if [ $i -eq 30 ]; then
            log_error "Timeout: Backend non accessible après 60 secondes"
            return 1
        fi
    done
    
    run_test "Backend répond sur /health" "curl -s -f $BACKEND_URL/health > /dev/null" ""
    run_test "API docs accessibles" "curl -s -f $BACKEND_URL/api-docs > /dev/null" ""
    run_test "Métriques Prometheus disponibles" "curl -s -f $BACKEND_URL/metrics > /dev/null" ""
}

# Fonction pour tester l'authentification
test_authentication() {
    log_info "Phase 3: Test d'authentification..."
    
    # Test de login
    local login_response=$(curl -s -X POST "$BACKEND_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"username":"admin","password":"admin123"}')
    
    if echo "$login_response" | grep -q "token"; then
        log_success "Login admin réussi"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        
        # Extraire le token pour les tests suivants
        export TEST_TOKEN=$(echo "$login_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
        
        # Test d'accès avec token
        run_test "Accès authentifié aux services" \
            "curl -s -f -H 'Authorization: Bearer $TEST_TOKEN' $BACKEND_URL/api/services > /dev/null" ""
    else
        log_error "Échec du login admin"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
}

# Fonction pour tester les exemples
test_examples() {
    log_info "Phase 4: Test des exemples..."
    
    if [ -d "examples/01-quick-start" ]; then
        cd examples/01-quick-start
        
        if [ -f "package.json" ]; then
            run_test "Installation dépendances quick-start" "npm install --silent" ""
            
            # Modifier le fichier example.js pour utiliser le token de test
            if [ -n "$TEST_TOKEN" ] && [ -f "example.js" ]; then
                # Créer une version de test
                sed "s/const TOKEN = 'your-jwt-token-here';/const TOKEN = '$TEST_TOKEN';/" example.js > example-test.js
                run_test "Exécution example quick-start" "timeout 30 node example-test.js" ""
                rm -f example-test.js
            else
                log_warning "Token non disponible pour test quick-start"
            fi
        else
            log_warning "Package.json non trouvé dans quick-start"
        fi
        
        cd ../..
    else
        log_warning "Répertoire examples/01-quick-start non trouvé"
    fi
}

# Fonction pour tester le monitoring
test_monitoring() {
    log_info "Phase 5: Test du monitoring..."
    
    # Vérifier si le monitoring est démarré
    if curl -s "$PROMETHEUS_URL" > /dev/null 2>&1; then
        run_test "Prometheus accessible" "curl -s -f $PROMETHEUS_URL > /dev/null" ""
        run_test "Prometheus collecte métriques backend" \
            "curl -s '$PROMETHEUS_URL/api/v1/query?query=up{job=\"autoweave-backend\"}' | grep -q '\"value\"'" ""
    else
        log_warning "Prometheus non accessible - monitoring possiblement non démarré"
    fi
    
    if curl -s "$GRAFANA_URL" > /dev/null 2>&1; then
        run_test "Grafana accessible" "curl -s -f $GRAFANA_URL/api/health > /dev/null" ""
    else
        log_warning "Grafana non accessible - monitoring possiblement non démarré"
    fi
}

# Fonction pour test de performance basique
test_performance() {
    log_info "Phase 6: Test de performance basique..."
    
    # Test de charge simple
    log_info "Test de charge: 50 requêtes simultanées..."
    local start_perf=$(date +%s%N)
    
    for i in {1..50}; do
        curl -s "$BACKEND_URL/health" > /dev/null &
    done
    wait
    
    local end_perf=$(date +%s%N)
    local duration_ms=$(( (end_perf - start_perf) / 1000000 ))
    
    if [ $duration_ms -lt 10000 ]; then  # Moins de 10 secondes
        log_success "Test de charge réussi (${duration_ms}ms pour 50 requêtes)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        log_warning "Test de charge lent (${duration_ms}ms pour 50 requêtes)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
}

# Fonction pour générer le rapport
generate_report() {
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    local success_rate=$((TESTS_PASSED * 100 / TESTS_TOTAL))
    
    log_info "Génération du rapport de test..."
    
    cat > "$TEST_RESULTS_FILE" << EOF
# Rapport de Test de Déploiement - AutoWeave Backend

**Testeur** : Script automatisé ($(whoami)@$(hostname))
**Date de test** : $(date '+%Y-%m-%d %H:%M:%S')
**Durée totale** : ${duration} secondes
**Status global** : $([ $success_rate -ge 90 ] && echo "✅ SUCCÈS" || echo "❌ ÉCHEC PARTIEL")

## Résumé Exécutif
Tests automatisés exécutés avec un taux de réussite de ${success_rate}% (${TESTS_PASSED}/${TESTS_TOTAL} tests réussis).

## Informations Système
\`\`\`
OS: $(uname -a)
Node.js version: $(node --version)
Docker version: $(docker --version)
Docker Compose version: $(docker-compose --version)
RAM disponible: $(free -h | grep '^Mem:' | awk '{print $7}')
CPU: $(nproc) cores
\`\`\`

## Métriques de Performance
\`\`\`
Durée totale des tests: ${duration} secondes
Tests exécutés: ${TESTS_TOTAL}
Tests réussis: ${TESTS_PASSED}
Tests échoués: ${TESTS_FAILED}
Taux de réussite: ${success_rate}%
\`\`\`

## Détails des Tests
EOF

    if [ -f "test_results_temp.txt" ]; then
        echo -e "\n### Résultats Détaillés" >> "$TEST_RESULTS_FILE"
        echo '```' >> "$TEST_RESULTS_FILE"
        cat test_results_temp.txt >> "$TEST_RESULTS_FILE"
        echo '```' >> "$TEST_RESULTS_FILE"
        rm -f test_results_temp.txt
    fi

    cat >> "$TEST_RESULTS_FILE" << EOF

## Recommandations
$([ $success_rate -ge 95 ] && echo "- ✅ Système prêt pour la production" || echo "- ⚠️ Quelques améliorations nécessaires")
$([ $TESTS_FAILED -gt 0 ] && echo "- 🔍 Examiner les tests échoués ci-dessus" || echo "- 🎉 Tous les tests sont passés")

## Validation Finale
- [$([ $success_rate -ge 90 ] && echo "x" || echo " ")] Le système est prêt pour la production
- [$([ $success_rate -lt 90 ] && [ $success_rate -ge 70 ] && echo "x" || echo " ")] Des modifications mineures sont nécessaires  
- [$([ $success_rate -lt 70 ] && echo "x" || echo " ")] Des modifications importantes sont nécessaires

**Signature** : Script automatisé - $(date '+%Y-%m-%d %H:%M:%S')
EOF

    log_success "Rapport généré: $TEST_RESULTS_FILE"
}

# Fonction principale
main() {
    log_info "🚀 Démarrage des tests de déploiement AutoWeave Backend"
    log_info "================================================="
    
    # Initialiser le fichier de résultats temporaire
    echo "" > test_results_temp.txt
    
    # Phase 1: Prérequis
    check_prerequisites
    
    # Phase 2: Installation
    test_installation
    
    # Phase 3: Services
    test_services_startup
    
    # Phase 4: Authentification
    test_authentication
    
    # Phase 5: Exemples
    test_examples
    
    # Phase 6: Monitoring
    test_monitoring
    
    # Phase 7: Performance
    test_performance
    
    # Génération du rapport
    generate_report
    
    # Résumé final
    log_info "================================================="
    log_info "🏁 Tests terminés!"
    log_info "   Tests totaux: $TESTS_TOTAL"
    log_success "   Tests réussis: $TESTS_PASSED"
    [ $TESTS_FAILED -gt 0 ] && log_error "   Tests échoués: $TESTS_FAILED" || log_success "   Tests échoués: $TESTS_FAILED"
    log_info "   Rapport: $TEST_RESULTS_FILE"
    
    local success_rate=$((TESTS_PASSED * 100 / TESTS_TOTAL))
    if [ $success_rate -ge 90 ]; then
        log_success "🎉 Déploiement validé avec succès ($success_rate% de réussite)!"
    else
        log_warning "⚠️ Déploiement nécessite des ajustements ($success_rate% de réussite)"
    fi
}

# Gestion des arguments
case "${1:-}" in
    "--help"|"-h")
        echo "Usage: $0 [options]"
        echo "Options:"
        echo "  --help, -h     Afficher cette aide"
        echo "  --quick        Tests rapides uniquement"
        echo "  --full         Tests complets (défaut)"
        exit 0
        ;;
    "--quick")
        log_info "Mode test rapide activé"
        # On pourrait adapter les tests ici
        ;;
esac

# Exécution
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
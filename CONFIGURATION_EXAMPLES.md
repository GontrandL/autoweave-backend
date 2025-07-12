# ⚙️ Guide de Configuration Automatique AutoWeave

## Vue d'ensemble

Le **Moteur de Configuration Automatique d'AutoWeave** détecte intelligemment les frameworks, types de projets et génère automatiquement les configurations optimales. Cette documentation présente des exemples détaillés pour chaque type de projet supporté.

## 🎯 Détection Automatique par Framework

### 1. 📱 **Next.js / React**

**Détection automatique basée sur :**
- `package.json` contient `"next"`
- Présence de `next.config.js`
- Structure de dossiers `pages/` ou `app/`

```javascript
// URL GitHub → Configuration automatique
"https://github.com/vercel/next.js-commerce" → {
  "type": "web-ui",
  "framework": "Next.js",
  "language": "TypeScript",
  "ports": {
    "development": 3000,
    "alternatives": [3001, 3002, 3003],
    "production": 3000
  },
  "commands": {
    "install": "npm install",
    "dev": "npm run dev",
    "build": "npm run build",
    "start": "npm start",
    "test": "npm test"
  },
  "healthEndpoints": [
    "/api/health",
    "/health",
    "/_next/static/health"
  ],
  "features": [
    "spa",
    "ssr",
    "hot-reload",
    "typescript",
    "api-routes",
    "image-optimization"
  ],
  "environmentVars": {
    "NODE_ENV": "development",
    "NEXT_TELEMETRY_DISABLED": "1",
    "PORT": "3000"
  },
  "buildOutput": {
    "directory": ".next",
    "static": ".next/static",
    "serverless": true
  },
  "optimization": {
    "bundleAnalysis": true,
    "imageOptimization": true,
    "caching": "enabled",
    "compression": "gzip"
  }
}
```

### 2. ⚡ **FastAPI / Python**

**Détection automatique basée sur :**
- `requirements.txt` contient `fastapi`
- Présence de `main.py` avec FastAPI imports
- `Pipfile` ou `pyproject.toml`

```javascript
// URL GitHub → Configuration automatique  
"https://github.com/tiangolo/full-stack-fastapi-postgresql" → {
  "type": "api-service",
  "framework": "FastAPI",
  "language": "Python",
  "version": "3.11",
  "ports": {
    "api": 8000,
    "docs": 8000,
    "alternatives": [8001, 8002, 8080]
  },
  "commands": {
    "install": "pip install -r requirements.txt",
    "dev": "uvicorn main:app --reload --host 0.0.0.0 --port 8000",
    "prod": "uvicorn main:app --host 0.0.0.0 --port 8000",
    "test": "pytest",
    "lint": "black . && isort . && flake8"
  },
  "healthEndpoints": [
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json"
  ],
  "features": [
    "rest-api",
    "async-support", 
    "auto-docs",
    "pydantic-validation",
    "dependency-injection",
    "security"
  ],
  "dependencies": {
    "runtime": ["uvicorn", "fastapi", "pydantic"],
    "optional": ["sqlalchemy", "alembic", "redis"],
    "dev": ["pytest", "black", "isort", "mypy"]
  },
  "environmentVars": {
    "PYTHONPATH": ".",
    "ENVIRONMENT": "development",
    "API_V1_STR": "/api/v1",
    "BACKEND_CORS_ORIGINS": "http://localhost:3000"
  },
  "database": {
    "autoDetected": "PostgreSQL",
    "connectionString": "postgresql://user:pass@localhost/db",
    "migrations": "alembic"
  },
  "documentation": {
    "swagger": "/docs",
    "redoc": "/redoc",
    "openapi": "/openapi.json"
  }
}
```

### 3. 🏗️ **SST / Infrastructure as Code**

**Détection automatique basée sur :**
- `sst.config.ts` ou `sst.json`
- Présence de `stacks/` directory
- `package.json` contient `sst`

```javascript
// URL GitHub → Configuration automatique
"https://github.com/sst/opencode" → {
  "type": "development-tool",
  "framework": "SST",
  "language": "TypeScript", 
  "platform": "AWS",
  "ports": {
    "console": 13557,
    "dev": 3000,
    "alternatives": [5173, 8080, 3001]
  },
  "commands": {
    "install": "npm install",
    "dev": "sst dev",
    "deploy": "sst deploy --stage prod",
    "remove": "sst remove",
    "console": "sst console",
    "secrets": "sst secrets"
  },
  "healthEndpoints": [
    "/_sst/health",
    "/health",
    "/api/health"
  ],
  "features": [
    "iac",
    "serverless",
    "typescript",
    "aws-integration",
    "live-lambda",
    "real-time-logging"
  ],
  "capabilities": {
    "supportsIaC": true,
    "supportsServerless": true,
    "supportsAWS": true,
    "supportsTypeScript": true,
    "supportsRealTimeDebugging": true
  },
  "awsServices": [
    "Lambda",
    "API Gateway", 
    "DynamoDB",
    "S3",
    "CloudFormation"
  ],
  "environmentVars": {
    "SST_STAGE": "dev",
    "AWS_REGION": "us-east-1",
    "SST_DEBUG": "true"
  },
  "monitoring": {
    "logs": "CloudWatch",
    "metrics": "CloudWatch",
    "tracing": "X-Ray",
    "alerts": "SNS"
  }
}
```

### 4. 🐍 **Django / Python Web**

**Détection automatique basée sur :**
- `manage.py` présent
- `settings.py` dans un sous-dossier
- `requirements.txt` contient `django`

```javascript
// URL GitHub → Configuration automatique
"https://github.com/django/django-project" → {
  "type": "web-ui",
  "framework": "Django",
  "language": "Python",
  "ports": {
    "web": 8000,
    "admin": 8000,
    "alternatives": [8001, 8080, 9000]
  },
  "commands": {
    "install": "pip install -r requirements.txt",
    "migrate": "python manage.py migrate",
    "dev": "python manage.py runserver 0.0.0.0:8000",
    "test": "python manage.py test",
    "collect-static": "python manage.py collectstatic --noinput"
  },
  "healthEndpoints": [
    "/health/",
    "/admin/",
    "/api/health/"
  ],
  "features": [
    "mvc-framework",
    "admin-interface",
    "orm",
    "template-engine",
    "middleware-support",
    "security-features"
  ],
  "database": {
    "default": "SQLite",
    "production": "PostgreSQL",
    "migrations": "Django ORM"
  },
  "environmentVars": {
    "DJANGO_SETTINGS_MODULE": "project.settings",
    "DEBUG": "True",
    "SECRET_KEY": "auto-generated",
    "ALLOWED_HOSTS": "localhost,127.0.0.1"
  },
  "staticFiles": {
    "root": "static/",
    "media": "media/",
    "collectStatic": true
  }
}
```

### 5. 📊 **Express.js / Node.js API**

**Détection automatique basée sur :**
- `package.json` contient `express`
- Présence de `server.js`, `app.js` ou `index.js`
- Structure typique Express

```javascript
// URL GitHub → Configuration automatique
"https://github.com/expressjs/express-starter" → {
  "type": "api-service",
  "framework": "Express.js",
  "language": "JavaScript",
  "ports": {
    "api": 3000,
    "alternatives": [3001, 8000, 5000]
  },
  "commands": {
    "install": "npm install",
    "dev": "nodemon server.js",
    "start": "node server.js",
    "test": "npm test"
  },
  "healthEndpoints": [
    "/health",
    "/api/health",
    "/status"
  ],
  "features": [
    "rest-api",
    "middleware",
    "routing",
    "template-engine",
    "static-files"
  ],
  "middleware": [
    "cors",
    "morgan",
    "helmet",
    "express-rate-limit"
  ],
  "environmentVars": {
    "NODE_ENV": "development",
    "PORT": "3000",
    "API_VERSION": "v1"
  }
}
```

## 🎛️ Configuration Multi-Environnement

### Development vs Production

```javascript
// Configuration adaptative selon l'environnement
{
  "environments": {
    "development": {
      "debug": true,
      "hotReload": true,
      "sourceMaps": true,
      "compression": false,
      "minification": false,
      "monitoring": "basic"
    },
    "staging": {
      "debug": false,
      "hotReload": false,
      "sourceMaps": true,
      "compression": true,
      "minification": true,
      "monitoring": "enhanced"
    },
    "production": {
      "debug": false,
      "hotReload": false,
      "sourceMaps": false,
      "compression": true,
      "minification": true,
      "monitoring": "full",
      "security": "strict"
    }
  }
}
```

## 🔧 Configuration Avancée

### Templates de Configuration

```javascript
// Template Next.js E-commerce
const nextjsEcommerceTemplate = {
  "extends": "nextjs-base",
  "features": [
    "stripe-integration",
    "product-catalog",
    "shopping-cart",
    "user-authentication",
    "order-management"
  ],
  "additionalPorts": {
    "stripe-webhook": 4242,
    "admin-panel": 3001
  },
  "environmentVars": {
    "STRIPE_PUBLIC_KEY": "pk_test_...",
    "STRIPE_SECRET_KEY": "sk_test_...",
    "DATABASE_URL": "postgresql://..."
  },
  "dependencies": {
    "payment": ["stripe"],
    "database": ["prisma", "@prisma/client"],
    "auth": ["next-auth"],
    "ui": ["@headlessui/react", "tailwindcss"]
  }
};

// Template FastAPI ML/AI
const fastapiMlTemplate = {
  "extends": "fastapi-base",
  "features": [
    "ml-models",
    "model-serving",
    "data-validation",
    "async-processing",
    "model-versioning"
  ],
  "additionalPorts": {
    "model-server": 8001,
    "ml-ops": 8002
  },
  "dependencies": {
    "ml": ["scikit-learn", "tensorflow", "pytorch"],
    "data": ["pandas", "numpy"],
    "serving": ["mlflow", "bentoml"]
  },
  "resources": {
    "memory": "4GB",
    "cpu": "2 cores",
    "gpu": "optional"
  }
};
```

## 📊 API de Configuration

### Endpoint de configuration automatique

```javascript
POST /api/configuration/auto-detect
Authorization: Bearer <token>
Content-Type: application/json

{
  "githubUrl": "https://github.com/user/project",
  "environment": "development",
  "preferences": {
    "portRange": [3000, 9000],
    "enableOptimizations": true,
    "securityLevel": "standard"
  }
}
```

### Réponse de configuration

```javascript
{
  "success": true,
  "configurationId": "config-abc123",
  "detectedFramework": "Next.js",
  "confidence": 0.98,
  "configuration": {
    // Configuration complète générée
  },
  "recommendations": [
    "Consider enabling TypeScript for better type safety",
    "Add ESLint for code quality",
    "Configure Husky for git hooks"
  ],
  "optimizations": {
    "bundleSize": "Webpack Bundle Analyzer recommended",
    "performance": "Image optimization enabled",
    "security": "Security headers configured"
  }
}
```

## 🎯 Exemples d'Utilisation

### Configuration Batch (Plusieurs Projets)

```bash
# Configuration automatique de 5 projets différents
curl -X POST /api/configuration/batch-detect \
  -H "Content-Type: application/json" \
  -d '{
    "projects": [
      {
        "name": "frontend",
        "githubUrl": "https://github.com/company/react-app",
        "type": "web-ui"
      },
      {
        "name": "api",
        "githubUrl": "https://github.com/company/fastapi-backend", 
        "type": "api-service"
      },
      {
        "name": "database",
        "githubUrl": "https://github.com/company/postgres-setup",
        "type": "database"
      },
      {
        "name": "infrastructure", 
        "githubUrl": "https://github.com/company/terraform-aws",
        "type": "development-tool"
      },
      {
        "name": "monitoring",
        "githubUrl": "https://github.com/company/grafana-dashboards",
        "type": "monitoring"
      }
    ],
    "globalSettings": {
      "environment": "development",
      "autoResolveConflicts": true,
      "enableMonitoring": true
    }
  }'
```

### Migration de Configuration

```bash
# Migration automatique React 16 → React 18
curl -X POST /api/configuration/migrate \
  -H "Content-Type: application/json" \
  -d '{
    "sourceConfig": {
      "framework": "React",
      "version": "16.14.0"
    },
    "targetConfig": {
      "framework": "React", 
      "version": "18.2.0"
    },
    "migrationOptions": {
      "preserveCustomConfig": true,
      "updateDependencies": true,
      "runTests": true
    }
  }'
```

## 📈 Métriques de Configuration

### Dashboard de Performance

```javascript
GET /api/configuration/metrics

{
  "detectionStats": {
    "totalConfigurations": 2847,
    "successRate": "96.8%",
    "avgDetectionTime": "1.4s",
    "frameworksDetected": {
      "React/Next.js": 1205,
      "FastAPI": 487,
      "Django": 332,
      "Express.js": 298,
      "SST": 156,
      "Other": 369
    }
  },
  "optimizationImpact": {
    "buildTimeReduction": "34%",
    "memoryUsageOptimization": "22%", 
    "startupTimeImprovement": "28%"
  },
  "userSatisfaction": {
    "configurationAccuracy": 4.7,
    "timeToDeployment": 4.5,
    "overallExperience": 4.6
  }
}
```

---

**Le Moteur de Configuration Automatique d'AutoWeave transforme n'importe quel projet GitHub en service optimisé et prêt à la production ! ⚙️**
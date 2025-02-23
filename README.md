# 🚀 Installation et démarrage d'une application AdonisJS

## 📦 Prérequis

Avant de commencer, assurez-vous d'avoir installé :

- **Node.js** (v16 ou supérieur) : [Télécharger ici](https://nodejs.org/)  
- **npm** (fourni avec Node.js) ou **yarn**  
- **AdonisJS CLI** (facultatif)  

## 📥 Installation du projet

Clonez le dépôt et installez les dépendances :

```sh
git clone https://github.com/votre-repo/adonis-app.git
cd adonis-app
npm install  # ou yarn install
```

## ⚙️ Configuration de l'environnement

Copiez le fichier `.env.example` en `.env` et ajustez les valeurs selon votre configuration :

```sh
cp .env.example .env
```

Générez la clé d'application :

```sh
node ace generate:key
```

## 🏗️ Lancer le serveur de développement

Démarrez l'application avec :

```sh
node ace serve --watch
```

Par défaut, l'application sera accessible à l'adresse :  
🔗 `http://127.0.0.1:3333`

## 🗃️ Exécuter les migrations (si base de données)

Si votre projet utilise une base de données, exécutez :

```sh
node ace migration:run
```

## ✅ Vérification

Testez l'API en accédant à :

```sh
curl http://127.0.0.1:3333
```

## 📜 Scripts utiles

| Commande                 | Description                                |
|--------------------------|--------------------------------------------|
| `node ace serve --watch` | Démarrer le serveur en mode développement |
| `node ace migration:run` | Exécuter les migrations                   |
| `node ace list`          | Voir toutes les commandes disponibles     |

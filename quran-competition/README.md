# 🕌 Système de Compétition Nationale de Récitation du Coran
## Édition 9 — Warsh & Hafs

---

## 📋 Structure du Projet

```
quran-competition/
├── server.js              ← Serveur Node.js principal
├── package.json           ← Dépendances
├── data/
│   ├── users.json         ← Comptes utilisateurs
│   └── results.json       ← Participants, notes, état
└── public/
    ├── index.html         ← Page principale (SPA)
    ├── css/
    │   └── style.css      ← Styles complets
    ├── js/
    │   └── app.js         ← Application client
    └── quran/             ← ⚠️ CRÉER CE DOSSIER et y mettre vos images
        ├── page_001.jpg
        ├── page_002.jpg
        └── ...page_604.jpg
```

---

## 🖥️ INSTALLATION SUR WINDOWS

### 1. Installer Node.js
- Télécharger depuis https://nodejs.org (version LTS recommandée)
- Installer avec les options par défaut

### 2. Installer les dépendances
```bash
# Ouvrir un terminal (cmd ou PowerShell) dans le dossier du projet
cd quran-competition
npm install
```

### 3. Ajouter les images du Coran
- Créer le dossier `public/quran/`
- Y placer vos images nommées exactement:
  - `page_001.jpg` → Page 1
  - `page_002.jpg` → Page 2
  - ...jusqu'à `page_604.jpg`
- Format recommandé: JPG, résolution 800x1100px minimum

### 4. Démarrer le serveur
```bash
npm start
```

### 5. Trouver l'adresse IP du serveur
```bash
ipconfig
# Chercher "Adresse IPv4" → ex: 192.168.1.100
```

### 6. Accéder depuis n'importe quel appareil
- Même réseau WiFi requis
- Ouvrir un navigateur et aller sur: `http://192.168.1.100:3000`

---

## 📱 ACCÈS SUR ANDROID

1. Connecter le téléphone au même réseau WiFi
2. Ouvrir Chrome ou Firefox
3. Entrer l'adresse: `http://[IP_DU_SERVEUR]:3000`
4. Se connecter avec les identifiants

**Astuce:** Pour un mode plein écran sur Android:
- Chrome → Menu (⋮) → "Ajouter à l'écran d'accueil"

---

## 👤 COMPTES PAR DÉFAUT

| Identifiant | Mot de passe | Rôle |
|---|---|---|
| `admin` | `password` | Administrateur |
| `president` | `password` | Président |
| `juge1` | `password` | Juge 1 |
| `juge2` | `password` | Juge 2 |
| `juge3` | `password` | Juge 3 |
| `juge4` | `password` | Juge 4 |
| `public` | `password` | Écran public |

⚠️ **IMPORTANT:** Changer les mots de passe avant la compétition!

---

## 🔐 PERMISSIONS PAR RÔLE

| Fonctionnalité | Admin | Président | Juge | Participant | Public |
|---|:---:|:---:|:---:|:---:|:---:|
| Gestion des comptes | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gestion participants | ✅ | ✅ | ❌ | ❌ | ❌ |
| Contrôle Flipbook | ✅ | ✅ | 👁️ | ✅ | 👁️ |
| Saisie des notes | ✅ | ✅ | ✅ | ❌ | ❌ |
| Contrôle minuterie | ✅ | ✅ | ❌ | 👁️ | 👁️ |
| Voir classement | ✅ | ✅ | ✅ | ❌ | 🔒* |
| Afficher résultats | ✅ | ✅ | ❌ | ❌ | ❌ |
| Urgences | ✅ | ❌ | ❌ | ❌ | ❌ |

*🔒 = Visible uniquement quand le Président/Admin l'autorise

---

## 📊 SYSTÈME DE NOTATION

### Critères (Total: 100 points)
| Critère | Points |
|---|---|
| التجويد — Tajweed | /30 |
| الحفظ — Mémorisation | /30 |
| الصوت — Voix | /20 |
| الإيقاع — Rythme | /10 |
| المخارج — Prononciation | /10 |

### Calcul du classement
- Si 3 juges ou plus: La note la plus haute ET la plus basse sont éliminées
- La moyenne des notes restantes donne le score final

---

## 🎬 DÉROULEMENT TYPE DE LA COMPÉTITION

1. **Admin** crée les comptes juges et participants
2. **Président** ouvre les participants et clique "Réciter" pour le participant actif
3. **Participant** voit le Flipbook sur son appareil
4. **Juges** (4) saisissent chacun leurs notes → confirmation → validation
5. **Président** peut voir les notes en temps réel
6. Répéter pour chaque participant
7. **Président** clique "Afficher au public" pour révéler le classement
8. **Écran public** affiche automatiquement le podium

---

## 🖼️ FLIPBOOK — Sources d'images du Coran

Pour obtenir les images des pages du Coran (Warsh):
- Logiciel Ayat (King Saud University): https://quran.ksu.edu.sa
- Tanzil: https://tanzil.net
- Ou scanner un Mushaf physique (édition Warsh)

Nommer les fichiers exactement: `page_001.jpg` → `page_604.jpg`

---

## 🔧 PERSONNALISATION

### Changer le port
Dans `server.js`, ligne: `const PORT = 3000;`

### Ajouter une nouvelle lecture (ex: Qalun)
1. Créer dossier `public/quran-qalun/`
2. Dans `public/js/app.js`, modifier la sélection du dossier d'images

### Traduction arabe/français
Le système est déjà bilingue (arabe et français). Pour ajouter l'anglais,
chercher les textes dans `public/js/app.js` et `public/css/style.css`.

---

## ❓ RÉSOLUTION DE PROBLÈMES

**Le serveur ne démarre pas:**
- Vérifier que Node.js est installé: `node --version`
- Vérifier que le port 3000 n'est pas utilisé
- Lancer: `npm install` pour réinstaller les dépendances

**Les appareils ne peuvent pas se connecter:**
- Vérifier que tous les appareils sont sur le même réseau WiFi
- Désactiver le pare-feu Windows temporairement (ou autoriser le port 3000)
- Vérifier l'adresse IP avec `ipconfig`

**Le Flipbook n'affiche pas les images:**
- Vérifier que les images sont dans `public/quran/`
- Vérifier le nommage: `page_001.jpg` (3 chiffres avec zéros)
- Tester l'accès direct: `http://localhost:3000/quran/page_001.jpg`

**Les notes ne se synchronisent pas:**
- Vérifier la connexion réseau
- Recharger la page (F5)
- Le statut "EN DIRECT" doit être visible dans l'en-tête

---

## 📞 SUPPORT TECHNIQUE

Pour toute question, vérifier les logs du serveur dans le terminal.
Les logs affichent toutes les connexions et erreurs en temps réel.

---

*Système développé pour la Compétition Nationale de Récitation du Coran — Édition 9*
*بسم الله الرحمن الرحيم*
